-- supabase/create_promotions_table.sql
--
-- Table des promotions partagées par la communauté.
-- Distincte de community_activity : structure riche pour
-- le workflow de validation (pending → verified/rejected).
--
-- À exécuter dans Supabase Dashboard → SQL Editor → New query.

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promotions (
  id               uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid         NOT NULL REFERENCES users_profiles(id) ON DELETE CASCADE,
  product_name     text         NOT NULL,
  ean              text,
  product_id       uuid         REFERENCES products(id) ON DELETE SET NULL,
  store_name       text         NOT NULL,
  store_id         uuid         REFERENCES stores(id) ON DELETE SET NULL,
  original_price   numeric(10,2) NOT NULL CHECK (original_price > 0),
  promo_price      numeric(10,2) NOT NULL CHECK (promo_price >= 0),
  proof_image_url  text,
  status           text         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT price_must_decrease CHECK (promo_price < original_price)
);

CREATE INDEX IF NOT EXISTS idx_promotions_created   ON promotions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_user      ON promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_promotions_product   ON promotions(product_id);
CREATE INDEX IF NOT EXISTS idx_promotions_status    ON promotions(status);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifié peut lire les promos vérifiées
CREATE POLICY "promotions_select_verified"
  ON promotions FOR SELECT
  USING (status = 'verified' OR auth.uid() = user_id);

-- Seul l'auteur peut insérer (statut pending par défaut)
CREATE POLICY "promotions_insert_own"
  ON promotions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── GRANTS ───────────────────────────────────────────────────────────────────

GRANT SELECT          ON public.promotions TO anon, authenticated;
GRANT INSERT          ON public.promotions TO authenticated;
GRANT UPDATE (status) ON public.promotions TO authenticated;
