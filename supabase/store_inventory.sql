-- supabase/store_inventory.sql
-- Migration : table store_inventory + RPC de recherche produit
-- À appliquer via le SQL Editor Supabase ou Supabase CLI

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.store_inventory (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_name     text        NOT NULL,
  barcode          text,
  price            numeric(10, 2) NOT NULL CHECK (price >= 0),
  confidence_score float       NOT NULL DEFAULT 1.0 CHECK (confidence_score BETWEEN 0 AND 1),
  source           text        NOT NULL DEFAULT 'scan',   -- 'scan' | 'manual' | 'api'
  last_updated     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_source CHECK (source IN ('scan', 'manual', 'api'))
);

-- ═══════════════════════════════════════════════════════════════
-- 2. INDEX
-- ═══════════════════════════════════════════════════════════════

-- Unicité par (magasin, code-barres) — scan successifs du même produit
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_inventory_barcode
  ON public.store_inventory (store_id, barcode)
  WHERE barcode IS NOT NULL;

-- Unicité par (magasin, nom normalisé) — fallback sans code-barres
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_inventory_name
  ON public.store_inventory (store_id, lower(product_name))
  WHERE barcode IS NULL;

-- Recherche rapide full-text sur le nom
CREATE INDEX IF NOT EXISTS idx_store_inventory_name_gin
  ON public.store_inventory USING gin(to_tsvector('french', product_name));

-- Lookup par magasin (jointures fréquentes)
CREATE INDEX IF NOT EXISTS idx_store_inventory_store_id
  ON public.store_inventory (store_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.store_inventory ENABLE ROW LEVEL SECURITY;

-- Lecture publique : tout le monde peut consulter l'inventaire
CREATE POLICY "store_inventory_select_public"
  ON public.store_inventory
  FOR SELECT
  TO public
  USING (true);

-- Écriture : utilisateurs authentifiés seulement
CREATE POLICY "store_inventory_insert_auth"
  ON public.store_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "store_inventory_update_auth"
  ON public.store_inventory
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 4. RPC : search_store_inventory
--    Retourne les prix d'un produit pour une liste de magasins.
--    Utilisée par la carte pour alimenter les Price Pills.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.search_store_inventory(
  p_query    text,
  p_store_ids uuid[]
)
RETURNS TABLE (
  store_id         uuid,
  product_name     text,
  price            numeric,
  confidence_score float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Recherche par TS-vector français, avec fallback ILIKE sur les 6 premiers caractères
  RETURN QUERY
  SELECT DISTINCT ON (si.store_id)
    si.store_id,
    si.product_name,
    si.price,
    si.confidence_score
  FROM public.store_inventory si
  WHERE si.store_id = ANY(p_store_ids)
    AND (
      to_tsvector('french', si.product_name) @@ plainto_tsquery('french', p_query)
      OR si.product_name ILIKE '%' || left(p_query, 8) || '%'
    )
  ORDER BY
    si.store_id,
    -- Préférer les résultats TS, puis trier par confiance décroissante
    (to_tsvector('french', si.product_name) @@ plainto_tsquery('french', p_query)) DESC,
    si.confidence_score DESC,
    si.last_updated DESC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. HOOK dans process_receipt_scan
--    Après upsert vers la table prices, on alimente aussi
--    store_inventory pour enrichir les Price Pills sur la carte.
--    On injecte les lignes matchées avec confiance ≥ 0.6.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_receipt_scan(
  p_store_id  uuid,
  p_raw_lines text[],
  p_scan_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_line          text;
  v_name          text;
  v_price         numeric;
  v_product_id    uuid;
  v_matched       int := 0;
  v_unmatched     int := 0;
  v_total         int := 0;
BEGIN
  FOREACH v_line IN ARRAY p_raw_lines LOOP
    v_total := v_total + 1;

    v_price := public._extract_price(v_line);
    v_name  := public._extract_name(v_line);

    IF v_price IS NULL OR v_name IS NULL OR length(v_name) < 3 THEN
      v_unmatched := v_unmatched + 1;
      CONTINUE;
    END IF;

    -- Recherche produit dans le catalogue
    SELECT id INTO v_product_id
    FROM public.products
    WHERE name ILIKE '%' || left(v_name, 6) || '%'
    LIMIT 1;

    IF v_product_id IS NOT NULL THEN
      -- Upsert dans prices (table existante)
      INSERT INTO public.prices (store_id, product_id, price, date_observed, source)
      VALUES (p_store_id, v_product_id, v_price, p_scan_date, 'scan')
      ON CONFLICT (store_id, product_id) DO UPDATE
        SET price         = EXCLUDED.price,
            date_observed = EXCLUDED.date_observed,
            source        = EXCLUDED.source;

      v_matched := v_matched + 1;
    ELSE
      v_unmatched := v_unmatched + 1;
    END IF;

    -- Upsert dans store_inventory (pour Price Pills carte) — confiance 0.7 pour les scans
    INSERT INTO public.store_inventory
      (store_id, product_name, price, confidence_score, source, last_updated)
    VALUES
      (p_store_id, v_name, v_price, 0.7, 'scan', now())
    ON CONFLICT ON CONSTRAINT idx_store_inventory_name
    DO UPDATE SET
      price            = EXCLUDED.price,
      confidence_score = GREATEST(store_inventory.confidence_score, 0.7),
      source           = 'scan',
      last_updated     = now();

  END LOOP;

  RETURN jsonb_build_object(
    'matched',      v_matched,
    'unmatched',    v_unmatched,
    'total_lines',  v_total,
    'match_count',  v_matched
  );
END;
$$;
