-- supabase/add_promotions_upvotes.sql
--
-- Ajoute le compteur d'upvotes sur la table promotions
-- et une fonction RPC pour l'incrémenter atomiquement.
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.

-- ─── Colonne ──────────────────────────────────────────────────────────────────

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS upvotes_count integer NOT NULL DEFAULT 0;

-- ─── Fonction RPC (incrément atomique) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_promotion_upvotes(promo_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE promotions
  SET upvotes_count = upvotes_count + 1
  WHERE id = promo_id
  RETURNING upvotes_count;
$$;

GRANT EXECUTE ON FUNCTION increment_promotion_upvotes(uuid) TO authenticated;
