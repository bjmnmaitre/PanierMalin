-- =============================================================================
-- PanierMalin — Migration Pro Analytics & Revendication de commerce
-- À exécuter dans Supabase Dashboard → SQL Editor
-- =============================================================================


-- ─── 1. Table store_analytics ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_analytics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_type  text        NOT NULL
    CONSTRAINT store_analytics_event_type_check
      CHECK (event_type IN ('view', 'click', 'promo_view')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index principal pour les calculs par magasin (agrégations rapides)
CREATE INDEX IF NOT EXISTS idx_store_analytics_store_id
  ON store_analytics (store_id);

-- Index composite pour les requêtes par magasin + période
CREATE INDEX IF NOT EXISTS idx_store_analytics_store_date
  ON store_analytics (store_id, created_at DESC);


-- ─── 2. RLS sur store_analytics ───────────────────────────────────────────────

ALTER TABLE store_analytics ENABLE ROW LEVEL SECURITY;

-- Toute personne (y compris anonyme) peut enregistrer un événement
DROP POLICY IF EXISTS analytics_public_insert ON store_analytics;
CREATE POLICY analytics_public_insert ON store_analytics
  FOR INSERT WITH CHECK (true);

-- Lecture réservée aux admins et au propriétaire du magasin
DROP POLICY IF EXISTS analytics_owner_read ON store_analytics;
CREATE POLICY analytics_owner_read ON store_analytics
  FOR SELECT USING (
    -- admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- propriétaire du magasin
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = store_analytics.store_id
        AND stores.owner_id = auth.uid()
    )
  );


-- ─── 3. RPC increment_store_analytic ──────────────────────────────────────────
-- SECURITY DEFINER : s'exécute avec les droits du créateur (pas du client).
-- Permet une insertion anonyme ultra-rapide sans exposer la table directement.

CREATE OR REPLACE FUNCTION increment_store_analytic(
  p_store_id   text,
  p_event_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN ('view', 'click', 'promo_view') THEN
    RAISE EXCEPTION 'event_type invalide : %', p_event_type;
  END IF;

  INSERT INTO store_analytics (store_id, event_type)
  VALUES (p_store_id, p_event_type);
END;
$$;

-- Accessibilité publique (y compris utilisateurs non connectés)
GRANT EXECUTE ON FUNCTION increment_store_analytic(text, text) TO anon;
GRANT EXECUTE ON FUNCTION increment_store_analytic(text, text) TO authenticated;


-- ─── 4. RPC claim_store ───────────────────────────────────────────────────────
-- Associe l'utilisateur authentifié comme owner_id du magasin,
-- met à jour son rôle à 'pro' et retourne un résultat JSON.

CREATE OR REPLACE FUNCTION claim_store(p_store_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_owner_id  uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Non connecté');
  END IF;

  -- Vérifie si le magasin existe et récupère son owner actuel
  SELECT owner_id INTO v_owner_id
  FROM stores
  WHERE id = p_store_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Magasin introuvable');
  END IF;

  IF v_owner_id IS NOT NULL AND v_owner_id <> v_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Ce magasin est déjà géré par un autre compte Pro');
  END IF;

  IF v_owner_id = v_user_id THEN
    RETURN json_build_object('success', true, 'message', 'Vous gérez déjà ce magasin');
  END IF;

  -- Revendication : définit owner_id + passe le profil en rôle Pro
  UPDATE stores SET owner_id = v_user_id WHERE id = p_store_id;
  UPDATE profiles SET role = 'pro' WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'message', 'Magasin revendiqué avec succès');
END;
$$;

GRANT EXECUTE ON FUNCTION claim_store(text) TO authenticated;


-- ─── 5. RPC pro_activate_subscription ────────────────────────────────────────
-- Activation optimiste de l'abonnement Pro (phase test / MVP).
-- En production, ce RPC sera déclenché par le webhook Stripe après paiement.

CREATE OR REPLACE FUNCTION pro_activate_subscription()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non connecté';
  END IF;

  UPDATE profiles
  SET role = 'pro'
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION pro_activate_subscription() TO authenticated;


-- ─── 6. Colonne is_subscribed sur profiles (abonnement Pro actif) ─────────────
-- Plus granulaire que le rôle : un commerçant peut avoir le rôle 'pro'
-- sans avoir un abonnement actif (ex : abonnement expiré).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_subscribed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.is_subscribed IS
  'Vrai si le compte Pro a un abonnement PanierMalin Pro actif (29 €/mois)';

-- =============================================================================
-- FIN DE MIGRATION
-- =============================================================================
