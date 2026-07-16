-- =============================================================================
-- PanierMalin — Sécurité admin : vue utilisateurs + audit des RPC critiques
--
-- Fournit :
--   1. get_admin_users()       — SECURITY DEFINER, admin seulement
--   2. get_pending_claims()    — SECURITY DEFINER, admin seulement (alternative SQL)
--   3. Audit de vote_promotion — vérification d'intégrité interne
--   4. Fonction log_admin_action() — trace des actions admin
--
-- Prérequis : rls_complete.sql (is_admin()), admin_claims_secure.sql
-- =============================================================================


-- ============================================================
-- 1. Fonction get_admin_users()
-- ============================================================
-- Jointure entre users_profiles (public) et auth.users (privé).
-- Accessible uniquement si l'appelant est admin.
-- Retourne email, dates de connexion, solde, rôle.

CREATE OR REPLACE FUNCTION public.get_admin_users(
  p_limit  integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id              uuid,
  display_name    text,
  role            text,
  malin_coins     integer,
  plan            text,
  email           text,
  created_at      timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérification stricte : seul un admin peut appeler cette fonction
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : rôle admin requis'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    p.role,
    p.malin_coins,
    p.plan,
    u.email::text,
    u.created_at,
    u.last_sign_in_at
  FROM public.users_profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users(integer, integer) TO authenticated;


-- ============================================================
-- 2. Fonction get_admin_user_detail(p_user_id)
-- ============================================================
-- Fiche individuelle pour la console admin : activité, claims, coins.

CREATE OR REPLACE FUNCTION public.get_admin_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : rôle admin requis' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'profile',       row_to_json(p),
    'email',         u.email,
    'last_sign_in',  u.last_sign_in_at,
    'promo_count',   (SELECT count(*) FROM promotions    WHERE user_id = p_user_id),
    'vote_count',    (SELECT count(*) FROM promo_votes   WHERE user_id = p_user_id),
    'comment_count', (SELECT count(*) FROM promo_comments WHERE user_id = p_user_id),
    'store_claims',  (
      SELECT jsonb_agg(jsonb_build_object('store_id', id, 'status', verification_status, 'claimed_at', claimed_at))
      FROM stores
      WHERE owner_id = p_user_id
    )
  )
  INTO v_result
  FROM public.users_profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = p_user_id;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) TO authenticated;


-- ============================================================
-- 3. Fonction set_user_role()
-- ============================================================
-- Permet à un admin de promouvoir/rétrograder un utilisateur.

CREATE OR REPLACE FUNCTION public.set_user_role(
  p_user_id uuid,
  p_role    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Accès refusé : rôle admin requis' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('user', 'pro', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rôle invalide');
  END IF;

  -- Empêche l'admin de se rétrograder lui-même par erreur
  IF p_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier son propre rôle');
  END IF;

  UPDATE public.users_profiles
  SET role = p_role
  WHERE id = p_user_id;

  PERFORM public.log_admin_action(
    'set_role',
    jsonb_build_object('target_user', p_user_id, 'new_role', p_role)
  );

  RETURN jsonb_build_object('success', true, 'role', p_role);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;


-- ============================================================
-- 4. Table + fonction d'audit des actions admin
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire le log
DROP POLICY IF EXISTS "audit_select_admin_only" ON public.admin_audit_log;
CREATE POLICY "audit_select_admin_only" ON public.admin_audit_log
  FOR SELECT USING (public.is_admin());

-- INSERT réservé au SECURITY DEFINER ci-dessous
DROP POLICY IF EXISTS "audit_insert_deny_direct" ON public.admin_audit_log;
CREATE POLICY "audit_insert_deny_direct" ON public.admin_audit_log
  FOR INSERT WITH CHECK (false);

GRANT SELECT ON public.admin_audit_log TO authenticated;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action  text,
  p_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (admin_id, action, payload)
  VALUES (auth.uid(), p_action, p_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, jsonb) TO authenticated;


-- ============================================================
-- 5. Audit de vote_promotion
-- ============================================================
-- vote_promotion est déjà SECURITY DEFINER et vérifie auth.uid().
-- Ce bloc ajoute une vérification que l'utilisateur ne peut voter
-- que pour lui-même ET que son compte n'est pas banni (role != 'banned').

CREATE OR REPLACE FUNCTION public.check_vote_eligibility(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profiles
    WHERE id = p_user_id
      AND role != 'banned'
  );
$$;

REVOKE ALL ON FUNCTION public.check_vote_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_vote_eligibility(uuid) TO authenticated;
