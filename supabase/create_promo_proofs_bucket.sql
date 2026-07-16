-- supabase/create_promo_proofs_bucket.sql
--
-- Bucket Supabase Storage pour les preuves photo de promotions.
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.

-- ─── Bucket public ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promo-proofs',
  'promo-proofs',
  true,
  5242880,   -- 5 Mo max par fichier
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS Storage ──────────────────────────────────────────────────────────────

CREATE POLICY "promo_proofs_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'promo-proofs');

CREATE POLICY "promo_proofs_authenticated_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'promo-proofs' AND auth.uid() IS NOT NULL);

-- ─── RPC : incrément atomique des économies utilisateur ───────────────────────

CREATE OR REPLACE FUNCTION increment_user_savings(amount numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users_profiles
  SET total_savings = COALESCE(total_savings, 0) + amount
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION increment_user_savings(numeric) TO authenticated;
