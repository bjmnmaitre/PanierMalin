// services/savingsService.ts
// Historique des économies par session de course — Offline-First + cloud best-effort

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api/client';

const STORAGE_KEY = '@pm_savings_history_v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavingsSession {
  id:           string;
  sessionDate:  string;   // YYYY-MM-DD
  storeName:    string;
  amountSpent:  number;
  amountSaved:  number;
  itemCount:    number;
}

export interface SavingsSummary {
  totalSaved:    number;
  totalSessions: number;
  avgSavings:    number;
  byMonth:       { month: string; saved: number }[];  // e.g. "2026-07"
}

// ─── Persistance locale ────────────────────────────────────────────────────────

export async function loadSavingsHistory(): Promise<SavingsSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavingsSession[]) : [];
  } catch {
    return [];
  }
}

async function persistHistory(sessions: SavingsSession[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)).catch(() => {});
}

// ─── Sync cloud (best-effort) ─────────────────────────────────────────────────

async function getAuthUserId(): Promise<string | null> {
  try {
    const { data } = await apiClient.getSupabase().auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

async function cloudInsertSession(session: SavingsSession, userId: string): Promise<void> {
  try {
    await apiClient.getSupabase()
      .from('user_savings_history')
      .insert({
        user_id:      userId,
        session_date: session.sessionDate,
        store_name:   session.storeName,
        amount_spent: session.amountSpent,
        amount_saved: session.amountSaved,
        item_count:   session.itemCount,
      });
  } catch {}
}

// Récupère les sessions cloud (fallback si cloud + récent que local)
export async function mergeCloudSavings(): Promise<void> {
  const uid = await getAuthUserId();
  if (!uid) return;

  const { data, error } = await apiClient.getSupabase()
    .from('user_savings_history')
    .select('id, session_date, store_name, amount_spent, amount_saved, item_count, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data || data.length === 0) return;

  interface CloudRow {
    id: string; session_date: string; store_name: string;
    amount_spent: number; amount_saved: number; item_count: number;
  }

  const cloudSessions: SavingsSession[] = (data as CloudRow[]).map((row) => ({
    id:          row.id,
    sessionDate: row.session_date,
    storeName:   row.store_name,
    amountSpent: Number(row.amount_spent),
    amountSaved: Number(row.amount_saved),
    itemCount:   Number(row.item_count),
  }));

  const localSessions = await loadSavingsHistory();
  const localIds      = new Set(localSessions.map((s) => s.id));
  const merged        = [
    ...localSessions,
    ...cloudSessions.filter((s) => !localIds.has(s.id)),
  ].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

  await persistHistory(merged);
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function recordShoppingSession(
  params: Omit<SavingsSession, 'id' | 'sessionDate'>,
): Promise<void> {
  const session: SavingsSession = {
    ...params,
    id:          `ss-${Date.now()}`,
    sessionDate: new Date().toISOString().slice(0, 10),
  };

  const existing = await loadSavingsHistory();
  await persistHistory([session, ...existing]);

  void getAuthUserId().then((uid) => {
    if (uid) void cloudInsertSession(session, uid);
  });
}

export function computeSummary(sessions: SavingsSession[]): SavingsSummary {
  if (sessions.length === 0) {
    return { totalSaved: 0, totalSessions: 0, avgSavings: 0, byMonth: [] };
  }

  const totalSaved    = sessions.reduce((s, x) => s + x.amountSaved, 0);
  const totalSessions = sessions.length;
  const avgSavings    = totalSaved / totalSessions;

  // Agrégation mensuelle (6 derniers mois)
  const monthMap = new Map<string, number>();
  for (const s of sessions) {
    const month = s.sessionDate.slice(0, 7); // YYYY-MM
    monthMap.set(month, (monthMap.get(month) ?? 0) + s.amountSaved);
  }
  const byMonth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, saved]) => ({ month, saved: Math.round(saved * 100) / 100 }));

  return {
    totalSaved:    Math.round(totalSaved * 100) / 100,
    totalSessions,
    avgSavings:    Math.round(avgSavings * 100) / 100,
    byMonth,
  };
}
