import { apiClient } from './api/client';

const supabase = apiClient.getSupabase();

// ─── Types publics ────────────────────────────────────────────────────────────

export type VoteType = 'up' | 'down';

export interface VoteResult {
  success:      boolean;
  newScore:     number;
  upCount:      number;
  totalVotes:   number;
  isActive:     boolean;
  coinsAwarded: boolean;
}

// Réponse JSON brute retournée par la RPC vote_promotion
interface RpcVoteResponse {
  success:      boolean;
  newScore:     number;
  upCount:      number;
  totalVotes:   number;
  isActive:     boolean;
  coinsAwarded: boolean;
}

// ─── Soumettre ou basculer un vote ────────────────────────────────────────────

/**
 * Soumet un vote 'up' ou 'down' sur une promotion.
 * Si l'utilisateur a déjà voté dans la même direction, le vote est annulé (toggle).
 * Si l'utilisateur a voté dans la direction opposée, le vote est mis à jour.
 *
 * La RPC recalcule reliability_score et gère la gamification (+50 MalinCoins à +5 ups).
 */
export async function submitPromoVote(
  promoId:  string,
  voteType: VoteType,
): Promise<VoteResult> {
  const { data, error } = await supabase.rpc('vote_promotion', {
    p_promo_id:  promoId,
    p_vote_type: voteType,
  });

  if (error || !data) {
    return {
      success:      false,
      newScore:     0,
      upCount:      0,
      totalVotes:   0,
      isActive:     true,
      coinsAwarded: false,
    };
  }

  const result = data as RpcVoteResponse;
  return {
    success:      result.success      ?? false,
    newScore:     result.newScore     ?? 0,
    upCount:      result.upCount      ?? 0,
    totalVotes:   result.totalVotes   ?? 0,
    isActive:     result.isActive     ?? true,
    coinsAwarded: result.coinsAwarded ?? false,
  };
}

// ─── Récupérer le vote de l'utilisateur sur une promo ────────────────────────

/**
 * Renvoie le vote en cours de l'utilisateur connecté pour une promotion donnée,
 * ou null si l'utilisateur n'a pas encore voté.
 * Utilisé pour afficher l'état actif des boutons de vote.
 */
export async function getUserVoteForPromo(
  promoId: string,
): Promise<VoteType | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('promo_votes')
    .select('vote_type')
    .eq('promo_id', promoId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  const raw = (data as { vote_type: string }).vote_type;
  return raw === 'up' || raw === 'down' ? raw : null;
}
