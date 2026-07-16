-- =============================================================================
-- PanierMalin — Centre de notifications utilisateur
-- Tables   : user_notifications
-- Triggers : trg_notify_comment_reply
-- À exécuter dans Supabase Dashboard → SQL Editor
-- =============================================================================


-- ─── 1. Table user_notifications ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL,
  type        text        NOT NULL
                CHECK (type IN ('promo_nearby', 'comment_reply', 'badge_earned', 'system')),
  related_id  uuid,        -- promo_id pour la navigation directe au clic
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Accès ultra-rapide aux notifications d'un utilisateur (flux DESC)
CREATE INDEX IF NOT EXISTS idx_user_notif_user_created
  ON user_notifications (user_id, created_at DESC);

-- Comptage rapide des non-lues (badge)
CREATE INDEX IF NOT EXISTS idx_user_notif_unread
  ON user_notifications (user_id, is_read)
  WHERE is_read = false;


-- ─── 2. RLS sur user_notifications ───────────────────────────────────────────

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement ses propres notifications
DROP POLICY IF EXISTS notif_select_own ON user_notifications;
CREATE POLICY notif_select_own ON user_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Mise à jour (is_read) : uniquement ses propres notifications
DROP POLICY IF EXISTS notif_update_own ON user_notifications;
CREATE POLICY notif_update_own ON user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- INSERT réservé au SECURITY DEFINER du trigger (pas de droit direct aux clients)
-- Le trigger se connecte en tant que créateur (SECURITY DEFINER) → pas besoin de policy INSERT.

GRANT SELECT, UPDATE ON user_notifications TO authenticated;


-- ─── 3. Realtime — publication de la table ────────────────────────────────────
-- Permet aux abonnements Supabase Realtime côté client de recevoir les INSERTs
-- filtrés par user_id (Supabase applique RLS sur les events Realtime).

ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;


-- ─── 4. Fonction de notification sur réponse à un commentaire ────────────────

CREATE OR REPLACE FUNCTION notify_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_user_id uuid;
  v_author_name    text;
BEGIN
  -- Déclenche uniquement pour les réponses (pas les commentaires racine)
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Auteur du commentaire parent
  SELECT user_id INTO v_parent_user_id
  FROM promo_comments
  WHERE id = NEW.parent_id;

  -- Pas d'auto-notification ni notification si parent introuvable
  IF v_parent_user_id IS NULL OR v_parent_user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Nom de l'auteur du nouveau commentaire
  SELECT display_name INTO v_author_name
  FROM users_profiles
  WHERE id = NEW.user_id;

  -- Insertion de la notification ; related_id = promo_id pour la navigation
  INSERT INTO user_notifications (user_id, title, body, type, related_id)
  VALUES (
    v_parent_user_id,
    'Nouvelle reponse a votre commentaire',
    COALESCE(v_author_name, 'Un utilisateur') || ' a repondu a votre commentaire sur cette promo.',
    'comment_reply',
    NEW.promo_id
  );

  RETURN NEW;
END;
$$;


-- ─── 5. Trigger AFTER INSERT sur promo_comments ───────────────────────────────

DROP TRIGGER IF EXISTS trg_notify_comment_reply ON promo_comments;
CREATE TRIGGER trg_notify_comment_reply
  AFTER INSERT ON promo_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment_reply();


-- =============================================================================
-- FIN DE MIGRATION
-- =============================================================================
