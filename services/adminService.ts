// services/adminService.ts
// Console d'administration : validation des revendications de commerces

import { apiClient } from './api/client';

const supabase = apiClient.getSupabase();

// ─── Types publics ────────────────────────────────────────────────────────────

export interface PendingClaim {
  id:                 string;
  name:               string;
  brand:              string;
  address:            string;
  verificationStatus: 'pending_claim';
  ownerId:            string;
  ownerDisplayName:   string;
  ownerEmail:         string | null;
  claimedAt:          string | null; // ISO timestamp
}

export interface ClaimActionResult {
  success: boolean;
  action?:  'approved' | 'rejected';
  error?:   string;
}

// ─── Fonctions ────────────────────────────────────────────────────────────────

/**
 * Récupère toutes les revendications en attente triées par date (plus ancienne d'abord).
 * Deux requêtes : stores pending → profils batch des demandeurs.
 */
export async function getPendingClaims(): Promise<PendingClaim[]> {
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, name, brand, address, owner_id, verification_status, claimed_at')
    .eq('verification_status', 'pending_claim')
    .not('owner_id', 'is', null)
    .order('claimed_at', { ascending: true });

  if (error || !stores || stores.length === 0) return [];

  const ownerIds: string[] = (stores as { owner_id: string }[]).map((s) => s.owner_id);

  // users_profiles contient aussi un champ email dans ce projet
  const { data: profiles } = await supabase
    .from('users_profiles')
    .select('id, display_name, email')
    .in('id', ownerIds);

  const profileMap = new Map<string, { name: string; email: string | null }>(
    ((profiles ?? []) as { id: string; display_name: string | null; email: string | null }[]).map(
      (p) => [p.id, { name: p.display_name ?? 'Utilisateur inconnu', email: p.email ?? null }]
    )
  );

  return (
    stores as {
      id: string; name: string; brand: string; address: string;
      owner_id: string; verification_status: string; claimed_at: string | null;
    }[]
  ).map((row) => {
    const prof = profileMap.get(row.owner_id);
    return {
      id:                 row.id,
      name:               row.name,
      brand:              row.brand,
      address:            row.address,
      verificationStatus: 'pending_claim' as const,
      ownerId:            row.owner_id,
      ownerDisplayName:   prof?.name ?? 'Utilisateur inconnu',
      ownerEmail:         prof?.email ?? null,
      claimedAt:          row.claimed_at,
    };
  });
}

/**
 * Approuve ou rejette une revendication via la RPC SECURITY DEFINER `verify_store_claim`.
 * Nécessite le rôle 'admin' dans users_profiles.
 *
 * @param storeId    UUID du magasin revendiqué
 * @param approve    true = approuver (verified + 50 coins), false = rejeter (owner_id = NULL)
 * @param adminNote  Motif de rejet obligatoire si !approve, optionnel si approve
 */
export async function verifyStoreClaim(
  storeId:   string,
  approve:   boolean,
  adminNote: string = '',
): Promise<ClaimActionResult> {
  const { data, error } = await supabase.rpc('verify_store_claim', {
    p_store_id:   storeId,
    p_approve:    approve,
    p_admin_note: adminNote || null,
  });

  if (error) {
    console.error('[adminService] verifyStoreClaim error:', error.message);
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; action?: string; error?: string };
  return {
    success: result.success,
    action:  result.action as 'approved' | 'rejected' | undefined,
    error:   result.error,
  };
}

// Alias de compatibilité avec le code précédent
export async function verifyClaim(storeId: string, approve: boolean): Promise<boolean> {
  const result = await verifyStoreClaim(storeId, approve);
  return result.success;
}
