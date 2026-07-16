-- supabase/create_promotion_votes_table.sql
--
-- Table de jointure pour les votes "C'est vrai" sur les promotions.
-- Remplace l'ancienne colonne upvotes_count (incrément simple non réversible).
-- Permet le toggle réel vote/dévote avec état persisté par utilisateur.
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promotion_votes (
  promo_id    uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_votes_promo ON promotion_votes(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_votes_user  ON promotion_votes(user_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE promotion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_select_all"  ON promotion_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_own"  ON promotion_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_delete_own"  ON promotion_votes FOR DELETE  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.promotion_votes TO authenticated;

-- ─── Fonction RPC toggle atomique ─────────────────────────────────────────────
-- Retourne { voted: bool, count: int }

CREATE OR REPLACE FUNCTION toggle_promotion_vote(p_promo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_voted   boolean;
  v_count   bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM promotion_votes
    WHERE promo_id = p_promo_id AND user_id = v_user_id
  ) THEN
    DELETE FROM promotion_votes
    WHERE promo_id = p_promo_id AND user_id = v_user_id;
    v_voted := false;
  ELSE
    INSERT INTO promotion_votes(promo_id, user_id) VALUES (p_promo_id, v_user_id);
    v_voted := true;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM promotion_votes WHERE promo_id = p_promo_id;

  RETURN jsonb_build_object('voted', v_voted, 'count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_promotion_vote(uuid) TO authenticated;
