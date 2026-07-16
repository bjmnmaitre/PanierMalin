-- =============================================================================
-- PanierMalin — Table de remontée d'erreurs applicatives
-- Reçoit les crashs JS capturés par services/errorReporting.ts
-- Les erreurs sont insérables par tous les utilisateurs (auth ou anon)
-- mais lisibles uniquement par les admins.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_errors (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  message     text        NOT NULL,
  stack       text,
  context     jsonb,
  is_fatal    boolean     NOT NULL DEFAULT false,
  platform    text,
  app_version text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_errors_created
  ON public.app_errors (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_errors_fatal
  ON public.app_errors (is_fatal, created_at DESC)
  WHERE is_fatal = true;

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

-- Les clients peuvent insérer leurs propres erreurs (anon inclus — crash avant auth)
DROP POLICY IF EXISTS "errors_insert_any" ON public.app_errors;
CREATE POLICY "errors_insert_any" ON public.app_errors
  FOR INSERT WITH CHECK (true);

-- Seuls les admins peuvent lire les erreurs (via is_admin() de rls_complete.sql)
DROP POLICY IF EXISTS "errors_select_admin" ON public.app_errors;
CREATE POLICY "errors_select_admin" ON public.app_errors
  FOR SELECT USING (public.is_admin());

-- Suppression : admins seulement (purge régulière)
DROP POLICY IF EXISTS "errors_delete_admin" ON public.app_errors;
CREATE POLICY "errors_delete_admin" ON public.app_errors
  FOR DELETE USING (public.is_admin());

-- Grants
GRANT INSERT ON public.app_errors TO anon, authenticated;
GRANT SELECT, DELETE ON public.app_errors TO authenticated;
