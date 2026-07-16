-- =============================================================================
-- PanierMalin — Migration Pro : Stores géospatiaux + Rôles + Promos certifiées
-- À exécuter dans Supabase Dashboard → SQL Editor
-- =============================================================================

-- ─── 0. Extension PostGIS (optionnelle — disponible sur Supabase) ─────────────
-- Si PostGIS est disponible, elle accélère les requêtes de proximité via
-- l'index géographique natif. Si non disponible, on tombe sur les index btree
-- sur latitude/longitude, qui suffisent pour nos volumes actuels.
CREATE EXTENSION IF NOT EXISTS postgis;


-- ─── 1. Table stores (enrichissement) ────────────────────────────────────────

-- Nouvelles colonnes sur la table stores existante
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS tier           integer     NOT NULL DEFAULT 3
    CONSTRAINT stores_tier_check CHECK (tier BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS is_sponsored   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sponsor_banner_url text,
  ADD COLUMN IF NOT EXISTS owner_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL;

-- Commentaires de domaine métier
COMMENT ON COLUMN stores.tier IS
  '1 = Hypermarché/Majeur (visible dès zoom France), 2 = Supermarché (visible dès zoom ville), 3 = Proximité/Petit (visible uniquement zoom quartier)';
COMMENT ON COLUMN stores.is_sponsored IS
  'Vrai si le magasin paie pour être mis en avant (Drive-to-Store Ads)';
COMMENT ON COLUMN stores.sponsor_banner_url IS
  'URL publique (Supabase Storage) de la bannière publicitaire affichée au clic';
COMMENT ON COLUMN stores.owner_id IS
  'UUID du compte Pro qui a revendiqué ce magasin (NULL = non revendiqué)';

-- ─── 1a. Index géospatiaux ────────────────────────────────────────────────────

-- Index btree sur lat/lon pour les requêtes bounding-box (filtre WHERE lat BETWEEN…)
CREATE INDEX IF NOT EXISTS idx_stores_lat  ON stores (latitude);
CREATE INDEX IF NOT EXISTS idx_stores_lon  ON stores (longitude);
-- Index composite pour les requêtes par tier + sponsoring
CREATE INDEX IF NOT EXISTS idx_stores_tier_sponsored ON stores (tier, is_sponsored);

-- Index PostGIS (si l'extension est disponible et qu'une colonne geography existe)
-- On crée la colonne geography de façon sécurisée uniquement si PostGIS est actif.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    -- Ajoute la colonne geography si elle n'existe pas
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'stores' AND column_name = 'geog'
    ) THEN
      ALTER TABLE stores ADD COLUMN geog geography(POINT, 4326);
    END IF;

    -- Remplit geog à partir des colonnes lat/lon existantes
    UPDATE stores SET geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    WHERE geog IS NULL;

    -- Crée l'index GIST spatial
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE tablename = 'stores' AND indexname = 'idx_stores_geog'
    ) THEN
      CREATE INDEX idx_stores_geog ON stores USING GIST (geog);
    END IF;
  END IF;
END;
$$;


-- ─── 2. Table profiles (rôle utilisateur) ────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
    CONSTRAINT profiles_role_check CHECK (role IN ('user', 'pro', 'admin'));

COMMENT ON COLUMN profiles.role IS
  'user = membre standard, pro = enseigne/commerçant vérifié, admin = équipe PanierMalin';

-- Index pour filtrer rapidement les comptes Pro
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role) WHERE role <> 'user';


-- ─── 3. Table promotions (certification Pro) ─────────────────────────────────

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS is_verified_pro boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN promotions.is_verified_pro IS
  'Vrai si la promotion a été postée par un compte Pro certifié (enseigne revendicatrice)';

CREATE INDEX IF NOT EXISTS idx_promotions_verified_pro ON promotions (is_verified_pro) WHERE is_verified_pro = true;


-- ─── 4. Sécurité RLS ─────────────────────────────────────────────────────────

-- Stores : lecture publique, écriture uniquement owner ou admin
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stores_read_all    ON stores;
DROP POLICY IF EXISTS stores_owner_write ON stores;
DROP POLICY IF EXISTS stores_admin_all   ON stores;

CREATE POLICY stores_read_all ON stores
  FOR SELECT USING (true);

CREATE POLICY stores_owner_write ON stores
  FOR ALL USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ─── 5. Fonction RPC : upsert de magasins OSM (cache enrichissement) ─────────
-- Appelée depuis le client React Native pour insérer les stores découverts via OSM.
-- Seuls les champs de base sont écrits ; on ne touche pas aux données Pro existantes.

CREATE OR REPLACE FUNCTION upsert_osm_stores(stores_json jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  store jsonb;
BEGIN
  FOR store IN SELECT * FROM jsonb_array_elements(stores_json)
  LOOP
    INSERT INTO stores (id, name, brand, address, latitude, longitude, hours, tier, is_sponsored)
    VALUES (
      (store->>'id')::text,
      COALESCE(store->>'name', 'Magasin inconnu'),
      COALESCE(store->>'brand', ''),
      COALESCE(store->>'address', ''),
      (store->>'latitude')::double precision,
      (store->>'longitude')::double precision,
      COALESCE(store->>'hours', ''),
      COALESCE((store->>'tier')::integer, 3),
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET
        name    = EXCLUDED.name,
        address = COALESCE(EXCLUDED.address, stores.address),
        hours   = COALESCE(EXCLUDED.hours,   stores.hours)
    WHERE stores.is_sponsored = false AND stores.owner_id IS NULL;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_osm_stores(jsonb) TO authenticated;


-- ─── 6. Vue publique promos certifiées ───────────────────────────────────────

CREATE OR REPLACE VIEW verified_promotions AS
SELECT
  p.*,
  pr.display_name  AS author_name,
  pr.avatar_url    AS author_avatar,
  pr.role          AS author_role
FROM promotions p
LEFT JOIN profiles pr ON pr.id = p.user_id
WHERE p.status = 'verified' OR p.is_verified_pro = true;

-- =============================================================================
-- FIN DE MIGRATION
-- =============================================================================
