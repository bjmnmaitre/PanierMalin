-- =============================================================================
-- PanierMalin — Politiques RLS complètes et fonctions helper admin
-- Tables couvertes : promotions, stores (owner update), promo_votes (delete),
--                   favourite_stores, store_claims
-- Fonction : is_admin() — helper SECURITY DEFINER anti-récursion
--
-- Idempotent : DROP IF EXISTS + CREATE OR REPLACE + IF NOT EXISTS.
-- À exécuter après schema.sql, promo_votes.sql, promo_comments.sql,
-- notifications.sql et admin_claims_secure.sql.
-- =============================================================================


-- ============================================================
-- 1. Fonction helper is_admin()
-- ============================================================
-- SECURITY DEFINER : bypass RLS pour lire users_profiles.role
-- sans provoquer de récursion dans les policies qui l'utilisent.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.users_profiles WHERE id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ============================================================
-- 2. RLS : promotions
-- ============================================================
-- La table promotions n'avait pas de politiques RLS actives.

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Lecture publique (anon + authenticated)
DROP POLICY IF EXISTS "promotions_select_all" ON promotions;
CREATE POLICY "promotions_select_all" ON promotions
  FOR SELECT USING (true);

-- Insertion : tout utilisateur authentifié peut signaler une promo
DROP POLICY IF EXISTS "promotions_insert_authenticated" ON promotions;
CREATE POLICY "promotions_insert_authenticated" ON promotions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Mise à jour : auteur ou admin
DROP POLICY IF EXISTS "promotions_update_own_or_admin" ON promotions;
CREATE POLICY "promotions_update_own_or_admin" ON promotions
  FOR UPDATE USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- Suppression : auteur ou admin
DROP POLICY IF EXISTS "promotions_delete_own_or_admin" ON promotions;
CREATE POLICY "promotions_delete_own_or_admin" ON promotions
  FOR DELETE USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

GRANT SELECT                        ON promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON promotions TO authenticated;


-- ============================================================
-- 3. RLS : stores — mise à jour par le propriétaire ou l'admin
-- ============================================================
-- L'INSERT reste réservé aux RPCs SECURITY DEFINER (seed SQL).
-- Le propriétaire (owner_id) peut modifier son magasin revendiqué.

DROP POLICY IF EXISTS "stores_update_owner_or_admin" ON stores;
CREATE POLICY "stores_update_owner_or_admin" ON stores
  FOR UPDATE USING (
    (owner_id IS NOT NULL AND auth.uid() = owner_id)
    OR public.is_admin()
  );

-- L'INSERT est volontairement absent : les stores sont créés par SQL uniquement.
-- Ajout d'un guard si quelqu'un tente quand même un INSERT direct :
DROP POLICY IF EXISTS "stores_insert_admin_only" ON stores;
CREATE POLICY "stores_insert_admin_only" ON stores
  FOR INSERT WITH CHECK (public.is_admin());

-- Suppression admin seulement
DROP POLICY IF EXISTS "stores_delete_admin_only" ON stores;
CREATE POLICY "stores_delete_admin_only" ON stores
  FOR DELETE USING (public.is_admin());

GRANT UPDATE ON stores TO authenticated;


-- ============================================================
-- 4. RLS : favourite_stores (si la table existe)
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'favourite_stores') THEN
    EXECUTE $q$
      ALTER TABLE favourite_stores ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "fav_stores_own" ON favourite_stores;
      CREATE POLICY "fav_stores_own" ON favourite_stores
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

      GRANT SELECT, INSERT, DELETE ON favourite_stores TO authenticated;
    $q$;
  END IF;
END $$;


-- ============================================================
-- 5. RLS : store_claims (si la table existe — admin_claims_secure.sql)
-- ============================================================
-- Les policies sont déjà créées par admin_claims_secure.sql via les stores
-- (owner_id + verification_status). Ce bloc ajoute un garde sur la vue admin.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_claims') THEN
    EXECUTE $q$
      ALTER TABLE store_claims ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "claims_select_own_or_admin" ON store_claims;
      CREATE POLICY "claims_select_own_or_admin" ON store_claims
        FOR SELECT USING (
          auth.uid() = user_id OR public.is_admin()
        );

      DROP POLICY IF EXISTS "claims_insert_own" ON store_claims;
      CREATE POLICY "claims_insert_own" ON store_claims
        FOR INSERT WITH CHECK (auth.uid() = user_id);

      DROP POLICY IF EXISTS "claims_update_admin_only" ON store_claims;
      CREATE POLICY "claims_update_admin_only" ON store_claims
        FOR UPDATE USING (public.is_admin());

      GRANT SELECT, INSERT ON store_claims TO authenticated;
    $q$;
  END IF;
END $$;


-- ============================================================
-- 6. Grants complémentaires pour Realtime
-- ============================================================

GRANT SELECT ON public.promotions TO anon, authenticated;
