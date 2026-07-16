-- =============================================================================
-- PanierMalin — Console Admin Sécurisée V2 : Validation des revendications
-- Idempotent — peut être re-exécuté sans risque
-- =============================================================================

-- ─── 1. Mise à jour du CHECK sur verification_status ─────────────────────────
-- Ajoute 'rejected' et 'pending_claim', conserve 'verified' et 'none'.

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_verification_status_check;
ALTER TABLE stores ADD CONSTRAINT stores_verification_status_check
  CHECK (verification_status IN ('none', 'pending_claim', 'verified', 'rejected'));

-- ─── 2. Nouvelles colonnes d'audit ───────────────────────────────────────────

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS claimed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS admin_note  text;

COMMENT ON COLUMN stores.claimed_at IS
  'Timestamp de la demande de revendication (auto-rempli par trigger)';
COMMENT ON COLUMN stores.admin_note IS
  'Note / motif de rejet saisi par l''administrateur lors de la validation';

-- ─── 3. Mise à jour du trigger d'auto-passage en pending_claim ───────────────

CREATE OR REPLACE FUNCTION stores_set_pending_on_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.owner_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.verification_status := 'pending_claim';
    NEW.claimed_at           := now();
    NEW.admin_note           := NULL; -- réinitialise la note précédente
  END IF;
  IF NEW.owner_id IS NULL THEN
    NEW.verification_status := 'none';
    NEW.claimed_at           := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_pending_on_claim ON stores;
CREATE TRIGGER trg_stores_pending_on_claim
  BEFORE UPDATE OF owner_id ON stores
  FOR EACH ROW
  EXECUTE FUNCTION stores_set_pending_on_claim();

-- ─── 4. RPC verify_store_claim (remplace verify_claim) ───────────────────────

CREATE OR REPLACE FUNCTION verify_store_claim(
  p_store_id  uuid,
  p_approve   boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_owner_id    uuid;
  v_store_name  text;
BEGIN
  -- ── Vérification du rôle admin ──────────────────────────────────────────────
  SELECT role INTO v_caller_role
  FROM users_profiles
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Accès refusé : rôle admin requis'
    );
  END IF;

  -- ── Récupération de la revendication ────────────────────────────────────────
  SELECT owner_id, name INTO v_owner_id, v_store_name
  FROM stores
  WHERE id = p_store_id AND verification_status = 'pending_claim';

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Revendication introuvable ou déjà traitée'
    );
  END IF;

  IF p_approve THEN
    -- ── Approbation ─────────────────────────────────────────────────────────────
    UPDATE stores
    SET verification_status = 'verified',
        admin_note          = p_admin_note
    WHERE id = p_store_id;

    -- Bonus MalinCoins +50
    UPDATE users_profiles
    SET malin_coins = malin_coins + 50
    WHERE id = v_owner_id;

    INSERT INTO user_notifications (user_id, title, body, type, related_id)
    VALUES (
      v_owner_id,
      'Votre commerce est verifie !',
      'Felicitations ! Votre revendication de "' || v_store_name ||
        '" a ete approuvee. +50 MalinCoins credits sur votre compte !',
      'system',
      p_store_id
    );

    RETURN jsonb_build_object('success', true, 'action', 'approved');

  ELSE
    -- ── Rejet ───────────────────────────────────────────────────────────────────
    UPDATE stores
    SET verification_status = 'rejected',
        owner_id            = NULL,
        claimed_at          = NULL,
        admin_note          = p_admin_note
    WHERE id = p_store_id;

    INSERT INTO user_notifications (user_id, title, body, type, related_id)
    VALUES (
      v_owner_id,
      'Revendication non approuvee',
      CASE
        WHEN p_admin_note IS NOT NULL AND p_admin_note <> ''
        THEN 'Votre demande pour "' || v_store_name || '" a ete refusee. Motif : ' || p_admin_note
        ELSE 'Votre demande pour "' || v_store_name || '" n''a pas pu etre approuvee. Contactez le support.'
      END,
      'system',
      p_store_id
    );

    RETURN jsonb_build_object('success', true, 'action', 'rejected');
  END IF;
END;
$$;

-- Droits d'exécution
REVOKE ALL ON FUNCTION verify_store_claim(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_store_claim(uuid, boolean, text) TO authenticated;

-- Index mis à jour pour inclure claimed_at dans le tri admin
CREATE INDEX IF NOT EXISTS idx_stores_pending_claimed_at
  ON stores (claimed_at DESC NULLS LAST)
  WHERE verification_status = 'pending_claim' AND owner_id IS NOT NULL;

-- =============================================================================
-- Vérification
SELECT COUNT(*) AS pending FROM stores WHERE verification_status = 'pending_claim';
