-- =============================================================================
-- PanierMalin — Système de commentaires imbriqués sur les promotions
-- Tables  : promo_comments
-- Colonnes: users_profiles.role
-- RPCs    : pin_promo_comment
-- À exécuter dans Supabase Dashboard → SQL Editor
-- =============================================================================


-- ─── 1. Colonne role sur users_profiles ──────────────────────────────────────
-- 'user'  : Sentinelle standard
-- 'pro'   : Commerçant certifié PanierMalin
-- 'admin' : Équipe PanierMalin (modération, épinglage)
-- Idempotent — pas de DROP : update safe si pro_and_analytics.sql a déjà été joué.

ALTER TABLE users_profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'pro', 'admin'));


-- ─── 2. Table promo_comments ─────────────────────────────────────────────────
-- Supporte l'imbrication infinie via parent_id auto-référent.
-- Distinct de promotion_comments (commentaires plats sans threads).

CREATE TABLE IF NOT EXISTS promo_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id    uuid        NOT NULL REFERENCES promotions(id)    ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  parent_id   uuid                 REFERENCES promo_comments(id) ON DELETE CASCADE,
  content     text        NOT NULL
                CHECK (length(trim(content)) >= 1 AND length(content) <= 1000),
  is_pinned   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Charge la discussion : promo_id + tri chronologique
CREATE INDEX IF NOT EXISTS idx_promo_comments_promo
  ON promo_comments (promo_id, created_at ASC);

-- Reconstruction de l'arbre : résoudre rapidement les enfants d'un parent
CREATE INDEX IF NOT EXISTS idx_promo_comments_parent
  ON promo_comments (parent_id)
  WHERE parent_id IS NOT NULL;


-- ─── 3. RLS sur promo_comments ───────────────────────────────────────────────

ALTER TABLE promo_comments ENABLE ROW LEVEL SECURITY;

-- Lecture publique
DROP POLICY IF EXISTS promo_comments_read    ON promo_comments;
CREATE POLICY promo_comments_read    ON promo_comments FOR SELECT USING (true);

-- Insertion : tout utilisateur authentifié peut commenter
DROP POLICY IF EXISTS promo_comments_insert  ON promo_comments;
CREATE POLICY promo_comments_insert  ON promo_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Suppression & mise à jour : auteur uniquement (is_pinned géré via RPC SECURITY DEFINER)
DROP POLICY IF EXISTS promo_comments_delete  ON promo_comments;
CREATE POLICY promo_comments_delete  ON promo_comments FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS promo_comments_update  ON promo_comments;
CREATE POLICY promo_comments_update  ON promo_comments FOR UPDATE
  USING (auth.uid() = user_id);

GRANT SELECT              ON promo_comments TO anon;
GRANT SELECT, INSERT, DELETE, UPDATE ON promo_comments TO authenticated;


-- ─── 4. RPC pin_promo_comment ────────────────────────────────────────────────
-- Seuls les admins et les commerçants propriétaires du magasin associé
-- à la promo peuvent épingler / désépingler un commentaire.
-- SECURITY DEFINER car l'UPDATE de is_pinned ne passe pas la RLS standard.

CREATE OR REPLACE FUNCTION pin_promo_comment(p_comment_id uuid, p_pin boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_user_role      text;
  v_promo_id       uuid;
  v_store_owner_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RETURN false; END IF;

  -- Récupère le rôle de l'appelant
  SELECT role INTO v_user_role
  FROM users_profiles
  WHERE id = v_user_id;

  -- Les admins peuvent toujours épingler
  IF v_user_role = 'admin' THEN
    UPDATE promo_comments SET is_pinned = p_pin WHERE id = p_comment_id;
    RETURN true;
  END IF;

  -- Pour les Pro : vérifie qu'ils sont bien propriétaires du magasin de la promo
  SELECT c.promo_id INTO v_promo_id
  FROM promo_comments c
  WHERE c.id = p_comment_id;

  IF v_promo_id IS NOT NULL THEN
    SELECT s.owner_id INTO v_store_owner_id
    FROM promotions p
    JOIN stores s ON s.id = p.store_id
    WHERE p.id = v_promo_id;

    IF v_store_owner_id = v_user_id THEN
      UPDATE promo_comments SET is_pinned = p_pin WHERE id = p_comment_id;
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION pin_promo_comment(uuid, boolean) TO authenticated;


-- =============================================================================
-- FIN DE MIGRATION
-- =============================================================================
