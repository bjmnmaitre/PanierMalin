-- supabase/report_price.sql
-- RPC de signalement de prix erroné — baisse le confidence_score de 0.15

CREATE OR REPLACE FUNCTION public.report_store_inventory_price(
  p_store_id    uuid,
  p_product_name text,
  p_reason       text DEFAULT 'unknown'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.store_inventory
  SET
    confidence_score = GREATEST(0.0, confidence_score - 0.15),
    last_updated     = now()
  WHERE store_id         = p_store_id
    AND lower(product_name) = lower(p_product_name);
END;
$$;

-- Logs des signalements pour audit (optionnel — crée la table si besoin)
-- CREATE TABLE IF NOT EXISTS public.price_reports (
--   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
--   store_id     uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
--   product_name text NOT NULL,
--   reason       text NOT NULL,
--   reported_at  timestamptz NOT NULL DEFAULT now(),
--   reporter_id  uuid REFERENCES public.users_profiles(id)
-- );
