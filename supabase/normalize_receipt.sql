-- =============================================================================
-- PanierMalin — Normalisation & inventaire automatique après scan de ticket
--
-- Fonction : process_receipt_scan(p_store_id, p_raw_lines, p_scan_date)
--   • Reçoit les lignes brutes du ticket (texte OCR, ex: "NUTE 900 X3  2.49")
--   • Tente une correspondance floue contre la table products (ilike)
--   • Insère ou met à jour les prix dans la table prices pour ce magasin
--   • Retourne le tableau de correspondances (matched + non-matched)
--   • SECURITY DEFINER : l'appelant doit être authentifié (vérifié en tête)
--
-- Idempotent : DROP IF EXISTS avant CREATE OR REPLACE.
-- =============================================================================

-- ── Helper : extrait le prix flottant en fin de ligne ────────────────────────
-- Ex: "NUTE 900 X3  2.49 A"   → 2.49
--     "Coca-Cola 1.5L 1,89 B" → 1.89
--     "TOTAL  18.32"           → 18.32 (filtré côté appelant)

CREATE OR REPLACE FUNCTION public._extract_price(raw_line text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CAST(
    regexp_replace(
      (regexp_match(
        regexp_replace(raw_line, ',', '.', 'g'),
        '(\d+\.\d{1,2})\s*[A-Z]?\s*$'
      ))[1],
      '[^0-9.]', '', 'g'
    ) AS numeric
  );
$$;

-- ── Helper : extrait la portion nom de la ligne (tout sauf le prix en fin) ───

CREATE OR REPLACE FUNCTION public._extract_name(raw_line text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(
    regexp_replace(
      raw_line,
      '\s+\d+[,.]?\d*\s*[A-Z]?\s*$', '', 'g'
    )
  );
$$;

-- ── Fonction principale ───────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.process_receipt_scan(uuid, text[], date);

CREATE OR REPLACE FUNCTION public.process_receipt_scan(
  p_store_id  uuid,
  p_raw_lines text[],
  p_scan_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid  := auth.uid();
  v_line      text;
  v_name      text;
  v_price     numeric;
  v_product   record;
  v_matched   jsonb[] := '{}';
  v_unmatched text[]  := '{}';
BEGIN
  -- Seuls les utilisateurs connectés peuvent soumettre un scan
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié' USING ERRCODE = '42501';
  END IF;

  FOREACH v_line IN ARRAY p_raw_lines
  LOOP
    -- Ignorer les lignes vides ou les totaux
    CONTINUE WHEN v_line IS NULL OR trim(v_line) = '';
    CONTINUE WHEN v_line ~* '^\s*(total|sous.total|tva|remise|fidel)';

    v_name  := public._extract_name(v_line);
    v_price := public._extract_price(v_line);

    -- Ignorer si pas de prix valide ou prix aberrant (> 500 €)
    CONTINUE WHEN v_price IS NULL OR v_price <= 0 OR v_price > 500;
    -- Ignorer si le nom est trop court (bruit OCR)
    CONTINUE WHEN length(v_name) < 3;

    -- Correspondance floue sur la table products (ilike sur name)
    -- On prend le premier résultat ordonné par longueur de nom (le plus précis)
    SELECT id, name, ean INTO v_product
    FROM public.products
    WHERE name ILIKE '%' || left(v_name, 6) || '%'
    ORDER BY length(name) ASC
    LIMIT 1;

    IF v_product.id IS NOT NULL THEN
      -- Upsert dans prices (clé unique store_id + product_id)
      INSERT INTO public.prices (store_id, product_id, price, scanned_at, scanned_by)
      VALUES (p_store_id, v_product.id, v_price, p_scan_date, v_user_id)
      ON CONFLICT (store_id, product_id)
      DO UPDATE SET
        price      = EXCLUDED.price,
        scanned_at = EXCLUDED.scanned_at,
        scanned_by = EXCLUDED.scanned_by;

      v_matched := array_append(
        v_matched,
        jsonb_build_object(
          'raw',         v_line,
          'product_id',  v_product.id,
          'product_name', v_product.name,
          'ean',         v_product.ean,
          'price',       v_price
        )
      );
    ELSE
      v_unmatched := array_append(v_unmatched, v_name);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'matched',      to_jsonb(v_matched),
    'unmatched',    to_jsonb(v_unmatched),
    'total_lines',  array_length(p_raw_lines, 1),
    'match_count',  array_length(v_matched, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_receipt_scan(uuid, text[], date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_receipt_scan(uuid, text[], date) TO authenticated;

COMMENT ON FUNCTION public.process_receipt_scan IS
  'Normalise les lignes OCR d''un ticket de caisse et met à jour l''inventaire de prix du magasin.';

-- ── Table prices : colonne scanned_by si absente ─────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prices' AND column_name = 'scanned_by'
  ) THEN
    ALTER TABLE public.prices ADD COLUMN scanned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE public.prices ADD COLUMN scanned_at date;
  END IF;
END $$;
