-- =============================================================================
-- PanierMalin — Système de vote bidirectionnel sur les promotions
-- Tables : promo_votes
-- RPCs   : vote_promotion
-- À exécuter dans Supabase Dashboard → SQL Editor
-- =============================================================================


-- ─── 1. Colonnes supplémentaires sur promotions ───────────────────────────────
-- reliability_score : score net (up - down), recalculé à chaque vote via RPC.
-- is_active         : false quand le score chute sous -3 (promo auto-désactivée).
-- is_reward_claimed : flag anti-doublon pour le versement de MalinCoins à +5 ups.

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS reliability_score integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active         boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_reward_claimed boolean     NOT NULL DEFAULT false;

-- Index partial sur les promos actives (requêtes carte / flux)
CREATE INDEX IF NOT EXISTS idx_promotions_active
  ON promotions (is_active)
  WHERE is_active = true;

-- Index pour trier par fiabilité
CREATE INDEX IF NOT EXISTS idx_promotions_reliability
  ON promotions (reliability_score DESC);


-- ─── 2. Colonne malin_coins sur users_profiles ────────────────────────────────
-- Ajout idempotent : déjà présente si fix_grants_and_events_rls.sql a été joué.

ALTER TABLE users_profiles
  ADD COLUMN IF NOT EXISTS malin_coins integer NOT NULL DEFAULT 0;


-- ─── 3. Table promo_votes ─────────────────────────────────────────────────────
-- Distinct de promotion_votes (toggle upvote simple).
-- Supporte les deux directions : 'up' (validée) et 'down' (épuisée/fausse).

CREATE TABLE IF NOT EXISTS promo_votes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id   uuid        NOT NULL REFERENCES promotions(id)  ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  vote_type  text        NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_votes_one_per_user UNIQUE (promo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_votes_promo ON promo_votes (promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_votes_user  ON promo_votes (user_id);


-- ─── 4. RLS sur promo_votes ───────────────────────────────────────────────────

ALTER TABLE promo_votes ENABLE ROW LEVEL SECURITY;

-- Lecture publique : l'agrégat de votes est visible par tous
DROP POLICY IF EXISTS promo_votes_read     ON promo_votes;
CREATE POLICY promo_votes_read     ON promo_votes FOR SELECT USING (true);

-- Écriture : seulement son propre vote
DROP POLICY IF EXISTS promo_votes_insert   ON promo_votes;
CREATE POLICY promo_votes_insert   ON promo_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS promo_votes_update   ON promo_votes;
CREATE POLICY promo_votes_update   ON promo_votes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS promo_votes_delete   ON promo_votes;
CREATE POLICY promo_votes_delete   ON promo_votes FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT                       ON promo_votes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON promo_votes TO authenticated;


-- ─── 5. RPC vote_promotion ────────────────────────────────────────────────────
-- Upsert atomique du vote + recalcul du score + gamification.
-- SECURITY DEFINER pour contourner les vérifications RLS sur les UPDATE
-- croisés (promotions, users_profiles).
--
-- Retourne un objet JSON :
--   { success, newScore, upCount, totalVotes, isActive, coinsAwarded }

CREATE OR REPLACE FUNCTION vote_promotion(p_promo_id uuid, p_vote_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         uuid    := auth.uid();
  v_existing_type   text;
  v_new_score       integer;
  v_up_count        bigint;
  v_total_votes     bigint;
  v_promo_user_id   uuid;
  v_reward_claimed  boolean;
  v_coins_awarded   boolean := false;
BEGIN
  -- ── Gardes ──────────────────────────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non connecté';
  END IF;

  IF p_vote_type NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'vote_type invalide : %', p_vote_type;
  END IF;

  -- ── Upsert du vote ───────────────────────────────────────────────────────────
  SELECT vote_type INTO v_existing_type
  FROM promo_votes
  WHERE promo_id = p_promo_id AND user_id = v_user_id;

  IF v_existing_type IS NOT NULL THEN
    IF v_existing_type = p_vote_type THEN
      -- Même direction → toggle off (suppression)
      DELETE FROM promo_votes
      WHERE promo_id = p_promo_id AND user_id = v_user_id;
    ELSE
      -- Direction opposée → changement de vote
      UPDATE promo_votes
      SET vote_type = p_vote_type, created_at = now()
      WHERE promo_id = p_promo_id AND user_id = v_user_id;
    END IF;
  ELSE
    -- Nouveau vote
    INSERT INTO promo_votes (promo_id, user_id, vote_type)
    VALUES (p_promo_id, v_user_id, p_vote_type);
  END IF;

  -- ── Agrégats post-upsert ─────────────────────────────────────────────────────
  SELECT
    COUNT(*) FILTER (WHERE vote_type = 'up'),
    COUNT(*)
  INTO v_up_count, v_total_votes
  FROM promo_votes
  WHERE promo_id = p_promo_id;

  -- Score net : chaque 'up' vaut +1, chaque 'down' vaut -1
  v_new_score := COALESCE(
    (SELECT SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE -1 END)
     FROM promo_votes
     WHERE promo_id = p_promo_id),
    0
  );

  -- ── Mise à jour de la promo ──────────────────────────────────────────────────
  -- is_active passe à false dès que le score atteint -3 (signal fort de fausse promo)
  UPDATE promotions
  SET
    reliability_score = v_new_score,
    is_active         = (v_new_score > -3)
  WHERE id = p_promo_id;

  -- ── Gamification : +50 MalinCoins à la Sentinelle créatrice à +5 ups ─────────
  -- Le flag is_reward_claimed évite le double-versement si quelqu'un retire puis
  -- remet son vote en portant à nouveau le compteur à 5.
  IF v_up_count >= 5 THEN
    SELECT user_id, is_reward_claimed
    INTO v_promo_user_id, v_reward_claimed
    FROM promotions
    WHERE id = p_promo_id;

    IF NOT v_reward_claimed AND v_promo_user_id IS NOT NULL AND v_promo_user_id != v_user_id THEN
      UPDATE users_profiles
      SET malin_coins = COALESCE(malin_coins, 0) + 50
      WHERE id = v_promo_user_id;

      UPDATE promotions
      SET is_reward_claimed = true
      WHERE id = p_promo_id;

      v_coins_awarded := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',      true,
    'newScore',     v_new_score,
    'upCount',      v_up_count,
    'totalVotes',   v_total_votes,
    'isActive',     v_new_score > -3,
    'coinsAwarded', v_coins_awarded
  );
END;
$$;

GRANT EXECUTE ON FUNCTION vote_promotion(uuid, text) TO authenticated;


-- =============================================================================
-- FIN DE MIGRATION
-- =============================================================================
