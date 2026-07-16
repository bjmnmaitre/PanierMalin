-- =============================================================================
-- PanierMalin — Console Admin : Validation des revendications de commerces
-- À exécuter dans Supabase Dashboard → SQL Editor
-- =============================================================================


-- ─── 1. Colonne verification_status sur stores ────────────────────────────────

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none'
    CONSTRAINT stores_verification_status_check
      CHECK (verification_status IN ('none', 'pending_claim', 'verified'));

COMMENT ON COLUMN stores.verification_status IS
  'none = non revendiqué, pending_claim = en attente de validation admin, verified = certifié';

-- Index dédié au dashboard admin (seule la valeur pending_claim est interrogée)
CREATE INDEX IF NOT EXISTS idx_stores_pending_claims
  ON stores (verification_status, owner_id)
  WHERE verification_status = 'pending_claim' AND owner_id IS NOT NULL;


-- ─── 2. Mise à jour RLS stores ────────────────────────────────────────────────

-- La lecture de verification_status est couverte par la policy SELECT existante.
-- L'UPDATE sur verification_status est réservé à la RPC SECURITY DEFINER ci-dessous :
-- les clients ne peuvent PAS modifier directement ce champ via UPDATE.

-- (Si une policy stores UPDATE large existait, elle doit être remplacée par une
--  version restrictive qui autorise uniquement la mise à jour de owner_id par son
--  propriétaire et NON verification_status.)


-- ─── 3. RPC verify_claim (SECURITY DEFINER) ──────────────────────────────────

CREATE OR REPLACE FUNCTION verify_claim(p_store_id uuid, p_approve boolean)
RETURNS boolean
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
    RAISE EXCEPTION 'Accès refusé : rôle admin requis (caller=%)', auth.uid()
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Récupération de la revendication ────────────────────────────────────────
  SELECT owner_id, name INTO v_owner_id, v_store_name
  FROM stores
  WHERE id = p_store_id AND verification_status = 'pending_claim';

  -- Revendication inexistante ou déjà traitée
  IF v_owner_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_approve THEN
    -- ── Approbation ─────────────────────────────────────────────────────────────
    UPDATE stores
    SET verification_status = 'verified'
    WHERE id = p_store_id;

    -- Notification in-app au commerçant
    INSERT INTO user_notifications (user_id, title, body, type, related_id)
    VALUES (
      v_owner_id,
      'Votre commerce est verifie !',
      'Felicitations ! Votre revendication de « ' || v_store_name ||
        ' » a ete approuvee. Votre badge Commercant Certifie est maintenant actif.',
      'system',
      p_store_id
    );

    -- Bonus MalinCoins pour le commerçant certifié (+100)
    UPDATE users_profiles
    SET malin_coins = malin_coins + 100
    WHERE id = v_owner_id;

  ELSE
    -- ── Rejet ───────────────────────────────────────────────────────────────────
    -- Libère le commerce : remet owner_id à NULL et statut à 'none'
    UPDATE stores
    SET verification_status = 'none',
        owner_id = NULL
    WHERE id = p_store_id;

    -- Notification de rejet
    INSERT INTO user_notifications (user_id, title, body, type, related_id)
    VALUES (
      v_owner_id,
      'Revendication non approuvee',
      'Votre demande de revendication de « ' || v_store_name ||
        ' » n''a pas pu etre approuvee. Contactez le support pour plus d''informations.',
      'system',
      p_store_id
    );
  END IF;

  RETURN true;
END;
$$;

-- Révoke tout droit d'exécution direct (la RPC se charge de l'auth)
REVOKE ALL ON FUNCTION verify_claim(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_claim(uuid, boolean) TO authenticated;


-- ─── 4. Trigger : mettre pending_claim quand owner_id est renseigné ───────────

CREATE OR REPLACE FUNCTION stores_set_pending_on_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quand owner_id passe de NULL à une valeur, on passe en pending_claim
  IF OLD.owner_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.verification_status := 'pending_claim';
  END IF;
  -- Si owner_id redevient NULL, on repasse à none
  IF NEW.owner_id IS NULL THEN
    NEW.verification_status := 'none';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_pending_on_claim ON stores;
CREATE TRIGGER trg_stores_pending_on_claim
  BEFORE UPDATE OF owner_id ON stores
  FOR EACH ROW
  EXECUTE FUNCTION stores_set_pending_on_claim();


-- =============================================================================
-- FIN DE MIGRATION
-- =============================================================================

-- Vérification
SELECT COUNT(*) AS pending_count
FROM stores
WHERE verification_status = 'pending_claim' AND owner_id IS NOT NULL;
