import { apiClient } from './api/client';

const supabase = apiClient.getSupabase();

// ─── Types publics ────────────────────────────────────────────────────────────

export interface DailyViewStat {
  date:  string;
  label: string;
  views: number;
}

export interface ProAnalytics {
  totalViews:     number;
  totalClicks:    number;
  monthViews:     number;
  dailyBreakdown: DailyViewStat[];
}

export interface ClaimResult {
  success: boolean;
  message: string;
}

// ─── Tracking anonyme ─────────────────────────────────────────────────────────

/**
 * Enregistre un événement sur un magasin via la RPC SECURITY DEFINER.
 * Fire-and-forget : n'attend pas la réponse pour ne pas bloquer l'UI.
 */
export function trackStoreEvent(
  storeId:   string,
  eventType: 'view' | 'click' | 'promo_view'
): void {
  supabase
    .rpc('increment_store_analytic', {
      p_store_id:   storeId,
      p_event_type: eventType,
    })
    .then(({ error }) => {
      if (error) console.warn('[proService] trackStoreEvent failed', error.message);
    });
}

// ─── Revendication de commerce ────────────────────────────────────────────────

export async function claimStore(storeId: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_store', { p_store_id: storeId });

  if (error) {
    return { success: false, message: error.message };
  }

  const result = data as { success: boolean; message: string };
  return { success: result.success, message: result.message };
}

// ─── Analytics Pro ────────────────────────────────────────────────────────────

/**
 * Renvoie les statistiques d'un magasin pour le dashboard Pro.
 * Si storeId est null/undefined, résout automatiquement le magasin dont l'utilisateur est propriétaire.
 */
export async function getProAnalytics(storeId?: string | null): Promise<ProAnalytics> {
  let resolvedId = storeId ?? null;

  if (!resolvedId) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return buildEmptyAnalytics();
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', userData.user.id)
      .maybeSingle();
    if (!store) return buildEmptyAnalytics();
    resolvedId = store.id as string;
  }

  const now   = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from('store_analytics')
    .select('event_type, created_at')
    .eq('store_id', resolvedId)
    .gte('created_at', since.toISOString());

  if (error || !data) {
    return buildEmptyAnalytics();
  }

  // Totaux globaux (depuis le début du mois)
  const { data: monthData } = await supabase
    .from('store_analytics')
    .select('event_type')
    .eq('store_id', resolvedId)
    .gte('created_at', monthStart.toISOString());

  const monthViews  = (monthData ?? []).filter((r: { event_type: string }) => r.event_type === 'view').length;
  const totalViews  = data.filter((r) => r.event_type === 'view').length;
  const totalClicks = data.filter((r) => r.event_type === 'click').length;

  // Agrégation par jour (7 derniers jours)
  const dayMap: Record<string, number> = {};
  data
    .filter((r) => r.event_type === 'view')
    .forEach((r) => {
      const day = r.created_at.slice(0, 10);
      dayMap[day] = (dayMap[day] ?? 0) + 1;
    });

  const dailyBreakdown = buildDailyBreakdown(dayMap);

  return { totalViews, totalClicks, monthViews, dailyBreakdown };
}

// ─── Activation de l'abonnement Pro (MVP / optimiste) ────────────────────────

export async function activateProSubscription(): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.rpc('pro_activate_subscription');
  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: "Abonnement Pro activé avec succès" };
}

// ─── Helpers privés ───────────────────────────────────────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function buildEmptyAnalytics(): ProAnalytics {
  return { totalViews: 0, totalClicks: 0, monthViews: 0, dailyBreakdown: buildEmptyDays() };
}

function buildEmptyDays(): DailyViewStat[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date:  d.toISOString().slice(0, 10),
      label: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1],
      views: 0,
    };
  });
}

function buildDailyBreakdown(dayMap: Record<string, number>): DailyViewStat[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      date:  key,
      label: DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1],
      views: dayMap[key] ?? 0,
    };
  });
}
