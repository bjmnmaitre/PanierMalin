-- =============================================================================
-- PanierMalin — Vue admin sécurisée + RLS exhaustif sur toutes les tables
-- À exécuter APRÈS schema.sql, rls_complete.sql, admin_security.sql
--
-- Idempotent : DROP IF EXISTS + CREATE OR REPLACE + IF NOT EXISTS.
-- =============================================================================

-- ===========================================================================
-- 1. VUE ADMIN — admin_users_view
-- ===========================================================================
-- Jointure users_profiles ⨝ auth.users pour exposer l'email aux admins.
-- security_barrier = true → empêche l'optimiseur de "pousser" des prédicats
--   extérieurs à l'intérieur de la vue, évitant les attaques par timing.
-- La clause WHERE public.is_admin() garantit que les non-admins reçoivent
-- un résultat vide (pas d'erreur, pas de fuite).

DROP VIEW IF EXISTS public.admin_users_view;

CREATE VIEW public.admin_users_view
  WITH (security_barrier = true)
AS
SELECT
  up.id,
  up.display_name,
  up.avatar_url,
  up.plan,
  up.malin_coins,
  up.role,
  up.created_at,
  au.email,
  au.last_sign_in_at,
  au.phone
FROM public.users_profiles up
JOIN auth.users au ON au.id = up.id
WHERE public.is_admin();

-- Révoquer tout accès par défaut puis rétablir pour les admins authentifiés
REVOKE ALL ON public.admin_users_view FROM PUBLIC, anon;
GRANT SELECT ON public.admin_users_view TO authenticated;

COMMENT ON VIEW public.admin_users_view IS
  'Vue jointure profils + auth.users, visible uniquement aux admins (WHERE is_admin()).';


-- ===========================================================================
-- 2. RLS — users_profiles
-- ===========================================================================
-- Les profils sont lisibles par tous (leaderboard, avatars publics)
-- mais ne peuvent être modifiés que par leur propriétaire.

ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public"  ON public.users_profiles;
CREATE POLICY "profiles_select_public" ON public.users_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_own"     ON public.users_profiles;
CREATE POLICY "profiles_update_own" ON public.users_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT est géré par le trigger auth.users → pas de politique nécessaire
-- DELETE est interdit côté client (désactivation compte = soft-delete en prod)


-- ===========================================================================
-- 3. RLS — user_favorite_stores
-- ===========================================================================

ALTER TABLE public.user_favorite_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fav_stores_own"       ON public.user_favorite_stores;
CREATE POLICY "fav_stores_own" ON public.user_favorite_stores
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ===========================================================================
-- 4. RLS — shopping_lists
-- ===========================================================================

ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

-- Lecture : propriétaire OU liste partagée (list_collaborators)
DROP POLICY IF EXISTS "lists_select_own_or_shared" ON public.shopping_lists;
CREATE POLICY "lists_select_own_or_shared" ON public.shopping_lists
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.list_collaborators lc
      WHERE lc.list_id = id AND lc.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lists_insert_own"     ON public.shopping_lists;
CREATE POLICY "lists_insert_own" ON public.shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lists_update_own"     ON public.shopping_lists;
CREATE POLICY "lists_update_own" ON public.shopping_lists
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lists_delete_own"     ON public.shopping_lists;
CREATE POLICY "lists_delete_own" ON public.shopping_lists
  FOR DELETE USING (auth.uid() = user_id);


-- ===========================================================================
-- 5. RLS — list_items
-- ===========================================================================

ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- Accès via la liste parente (propriétaire ou collaborateur)
DROP POLICY IF EXISTS "list_items_via_list"  ON public.list_items;
CREATE POLICY "list_items_via_list" ON public.list_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id
        AND (
          sl.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.list_collaborators lc
            WHERE lc.list_id = sl.id AND lc.user_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id AND sl.user_id = auth.uid()
    )
  );


-- ===========================================================================
-- 6. RLS — list_collaborators
-- ===========================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'list_collaborators'
  ) THEN
    ALTER TABLE public.list_collaborators ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "collabs_select_member" ON public.list_collaborators;
    CREATE POLICY "collabs_select_member" ON public.list_collaborators
      FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.shopping_lists sl
          WHERE sl.id = list_id AND sl.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "collabs_insert_owner"  ON public.list_collaborators;
    CREATE POLICY "collabs_insert_owner" ON public.list_collaborators
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.shopping_lists sl
          WHERE sl.id = list_id AND sl.user_id = auth.uid()
        )
      );

    DROP POLICY IF EXISTS "collabs_delete_owner"  ON public.list_collaborators;
    CREATE POLICY "collabs_delete_owner" ON public.list_collaborators
      FOR DELETE USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.shopping_lists sl
          WHERE sl.id = list_id AND sl.user_id = auth.uid()
        )
      );
  END IF;
END $$;


-- ===========================================================================
-- 7. RLS — saved_baskets
-- ===========================================================================

ALTER TABLE public.saved_baskets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_baskets_own"    ON public.saved_baskets;
CREATE POLICY "saved_baskets_own" ON public.saved_baskets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ===========================================================================
-- 8. RLS — saved_basket_items
-- ===========================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'saved_basket_items'
  ) THEN
    ALTER TABLE public.saved_basket_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "basket_items_via_basket" ON public.saved_basket_items;
    CREATE POLICY "basket_items_via_basket" ON public.saved_basket_items
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.saved_baskets sb
          WHERE sb.id = basket_id AND sb.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.saved_baskets sb
          WHERE sb.id = basket_id AND sb.user_id = auth.uid()
        )
      );
  END IF;
END $$;


-- ===========================================================================
-- 9. RLS — promotion_comments
-- ===========================================================================

ALTER TABLE public.promotion_comments ENABLE ROW LEVEL SECURITY;

-- Lecture publique : tout utilisateur authentifié peut lire les commentaires
DROP POLICY IF EXISTS "promo_comments_select_all"   ON public.promotion_comments;
CREATE POLICY "promo_comments_select_all" ON public.promotion_comments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "promo_comments_insert_own"   ON public.promotion_comments;
CREATE POLICY "promo_comments_insert_own" ON public.promotion_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "promo_comments_update_own"   ON public.promotion_comments;
CREATE POLICY "promo_comments_update_own" ON public.promotion_comments
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "promo_comments_delete_own"   ON public.promotion_comments;
CREATE POLICY "promo_comments_delete_own" ON public.promotion_comments
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());


-- ===========================================================================
-- 10. RLS — promotion_votes
-- ===========================================================================

ALTER TABLE public.promotion_votes ENABLE ROW LEVEL SECURITY;

-- Lecture publique : nécessaire pour les agrégats de votes sur les promos
DROP POLICY IF EXISTS "promo_votes_select_all"  ON public.promotion_votes;
CREATE POLICY "promo_votes_select_all" ON public.promotion_votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "promo_votes_insert_own"  ON public.promotion_votes;
CREATE POLICY "promo_votes_insert_own" ON public.promotion_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Rétractation possible (downvote retiré)
DROP POLICY IF EXISTS "promo_votes_delete_own"  ON public.promotion_votes;
CREATE POLICY "promo_votes_delete_own" ON public.promotion_votes
  FOR DELETE USING (auth.uid() = user_id);


-- ===========================================================================
-- 11. RLS — promotion_reports
-- ===========================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotion_reports'
  ) THEN
    ALTER TABLE public.promotion_reports ENABLE ROW LEVEL SECURITY;

    -- Seuls les admins voient les signalements (ne pas exposer les reporters)
    DROP POLICY IF EXISTS "reports_select_admin"  ON public.promotion_reports;
    CREATE POLICY "reports_select_admin" ON public.promotion_reports
      FOR SELECT USING (public.is_admin());

    -- Tout utilisateur authentifié peut signaler (la contrainte UNIQUE prévient le spam)
    DROP POLICY IF EXISTS "reports_insert_auth"   ON public.promotion_reports;
    CREATE POLICY "reports_insert_auth" ON public.promotion_reports
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "reports_delete_admin"  ON public.promotion_reports;
    CREATE POLICY "reports_delete_admin" ON public.promotion_reports
      FOR DELETE USING (public.is_admin());
  END IF;
END $$;


-- ===========================================================================
-- 12. RLS — user_notifications
-- ===========================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_notifications'
  ) THEN
    ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

    -- Uniquement ses propres notifications
    DROP POLICY IF EXISTS "notifs_own"           ON public.user_notifications;
    CREATE POLICY "notifs_own" ON public.user_notifications
      FOR SELECT USING (auth.uid() = user_id);

    -- Marquer lu / supprimer : uniquement le destinataire
    DROP POLICY IF EXISTS "notifs_update_own"    ON public.user_notifications;
    CREATE POLICY "notifs_update_own" ON public.user_notifications
      FOR UPDATE USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "notifs_delete_own"    ON public.user_notifications;
    CREATE POLICY "notifs_delete_own" ON public.user_notifications
      FOR DELETE USING (auth.uid() = user_id);

    -- L'insertion est réservée aux triggers / service_role (pas de direct client insert)
  END IF;
END $$;


-- ===========================================================================
-- 13. RLS — products (catalogue public en lecture)
-- ===========================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "products_select_all"  ON public.products;
    CREATE POLICY "products_select_all" ON public.products
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "products_write_auth"  ON public.products;
    CREATE POLICY "products_write_auth" ON public.products
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "products_update_admin" ON public.products;
    CREATE POLICY "products_update_admin" ON public.products
      FOR UPDATE USING (public.is_admin());

    DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
    CREATE POLICY "products_delete_admin" ON public.products
      FOR DELETE USING (public.is_admin());
  END IF;
END $$;


-- ===========================================================================
-- 14. RLS — prices (historique de prix, lecture publique)
-- ===========================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'prices'
  ) THEN
    ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "prices_select_all"   ON public.prices;
    CREATE POLICY "prices_select_all" ON public.prices
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "prices_insert_auth"  ON public.prices;
    CREATE POLICY "prices_insert_auth" ON public.prices
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "prices_update_admin" ON public.prices;
    CREATE POLICY "prices_update_admin" ON public.prices
      FOR UPDATE USING (public.is_admin());

    DROP POLICY IF EXISTS "prices_delete_admin" ON public.prices;
    CREATE POLICY "prices_delete_admin" ON public.prices
      FOR DELETE USING (public.is_admin());
  END IF;
END $$;


-- ===========================================================================
-- 15. GRANTS de complétion
-- ===========================================================================
-- Assure que les tables couvertes ci-dessus sont bien accessibles
-- via l'anon key (lecture publique) ou l'authenticated role.

GRANT SELECT          ON public.admin_users_view TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_favorite_stores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.shopping_lists        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.list_items            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.saved_baskets         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.promotion_comments    TO authenticated;
GRANT SELECT, INSERT, DELETE
  ON public.promotion_votes       TO authenticated;
GRANT SELECT          ON public.users_profiles  TO anon, authenticated;
GRANT UPDATE          ON public.users_profiles  TO authenticated;
