// services/habitListService.ts
// Listes d'habitudes — Offline-First + synchronisation cloud best-effort

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api/client';
import type { CartItem } from './cartService';
import { estimateBasePrice, realisticPrice } from './inventoryService';

const STORAGE_KEY   = '@pm_habit_lists_v1';
const STORAGE_TSKEY = '@pm_habit_lists_updated_at_v1';

// ─── Helpers Supabase (best-effort, jamais bloquants) ─────────────────────────

function getSupabase() {
  return apiClient.getSupabase();
}

async function getAuthUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

// Upsert une liste en cloud (non-bloquant)
async function cloudUpsertList(list: HabitList, userId: string): Promise<void> {
  try { await getSupabase()
    .from('user_habit_lists')
    .upsert({
      user_id:    userId,
      local_id:   list.id,
      title:      list.title,
      emoji:      list.emoji,
      items:      list.items as unknown as Record<string, unknown>[],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,local_id' });
  } catch {}
}

// Supprime une liste en cloud (non-bloquant)
async function cloudDeleteList(localId: string, userId: string): Promise<void> {
  try {
    await getSupabase()
      .from('user_habit_lists')
      .delete()
      .eq('user_id', userId)
      .eq('local_id', localId);
  } catch {}
}

// ─── Merge local ↔ cloud basé sur updated_at ─────────────────────────────────

interface CloudRow {
  local_id:   string;
  title:      string;
  emoji:      string;
  items:      unknown;
  updated_at: string;
}

async function fetchCloudLists(userId: string): Promise<HabitList[]> {
  const { data, error } = await getSupabase()
    .from('user_habit_lists')
    .select('local_id, title, emoji, items, updated_at')
    .eq('user_id', userId);
  if (error || !data) return [];
  return (data as CloudRow[]).map((row) => ({
    id:        row.local_id,
    title:     row.title,
    emoji:     row.emoji,
    items:     Array.isArray(row.items) ? (row.items as HabitItem[]) : [],
    lastUsed:  null,
    createdAt: row.updated_at,
  }));
}

export async function mergeWithCloud(): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;

  const [localLists, cloudLists] = await Promise.all([
    loadHabitLists(),
    fetchCloudLists(userId).catch(() => [] as HabitList[]),
  ]);
  if (cloudLists.length === 0) return;

  const localTs  = await AsyncStorage.getItem(STORAGE_TSKEY).catch(() => null);
  const cloudTs  = cloudLists.reduce((max, l) => (l.createdAt > max ? l.createdAt : max), '');

  // Cloud plus récent → remplace le local
  if (!localTs || cloudTs > localTs) {
    const merged = new Map<string, HabitList>();
    for (const l of localLists) merged.set(l.id, l);
    for (const l of cloudLists) merged.set(l.id, l);   // cloud gagne en cas de conflit
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...merged.values()])).catch(() => {});
    await AsyncStorage.setItem(STORAGE_TSKEY, cloudTs).catch(() => {});
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HabitItem {
  id:       string;
  name:     string;
  quantity: number;
}

export interface HabitList {
  id:        string;
  title:     string;
  emoji:     string;
  items:     HabitItem[];
  lastUsed:  string | null;
  createdAt: string;
}

// ─── Listes par défaut (premier lancement) ────────────────────────────────────

const DEFAULT_LISTS: HabitList[] = [
  {
    id: 'default-hebdo', title: 'Essentiels Hebdo', emoji: '🛒',
    createdAt: new Date().toISOString(), lastUsed: null,
    items: [
      { id: 'h1', name: 'Lait',    quantity: 2 },
      { id: 'h2', name: 'Pain',    quantity: 1 },
      { id: 'h3', name: 'Oeufs',   quantity: 1 },
      { id: 'h4', name: 'Beurre',  quantity: 1 },
      { id: 'h5', name: 'Yaourts', quantity: 1 },
    ],
  },
  {
    id: 'default-dejeuner', title: 'Petit Déjeuner', emoji: '☕',
    createdAt: new Date().toISOString(), lastUsed: null,
    items: [
      { id: 'd1', name: 'Café',           quantity: 1 },
      { id: 'd2', name: "Jus d'orange",   quantity: 1 },
      { id: 'd3', name: 'Baguette',       quantity: 1 },
      { id: 'd4', name: 'Confiture',      quantity: 1 },
    ],
  },
  {
    id: 'default-apero', title: 'Apéro entre amis', emoji: '🥂',
    createdAt: new Date().toISOString(), lastUsed: null,
    items: [
      { id: 'a1', name: 'Bière',  quantity: 2 },
      { id: 'a2', name: 'Vin',    quantity: 1 },
      { id: 'a3', name: 'Chips',  quantity: 2 },
      { id: 'a4', name: 'Olives', quantity: 1 },
    ],
  },
];

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function loadHabitLists(): Promise<HabitList[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LISTS));
      return DEFAULT_LISTS;
    }
    return JSON.parse(raw) as HabitList[];
  } catch {
    return DEFAULT_LISTS;
  }
}

export async function saveHabitLists(lists: HabitList[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lists)).catch(() => {});
  await AsyncStorage.setItem(STORAGE_TSKEY, new Date().toISOString()).catch(() => {});
}

export async function createHabitList(
  partial: Pick<HabitList, 'title' | 'emoji' | 'items'>,
): Promise<HabitList> {
  const newList: HabitList = {
    ...partial,
    id:        `habit-${Date.now()}`,
    lastUsed:  null,
    createdAt: new Date().toISOString(),
  };
  const existing = await loadHabitLists();
  await saveHabitLists([...existing, newList]);
  // Sync cloud non-bloquant
  void getAuthUserId().then((uid) => { if (uid) void cloudUpsertList(newList, uid); });
  return newList;
}

export async function deleteHabitList(id: string): Promise<void> {
  const lists = await loadHabitLists();
  await saveHabitLists(lists.filter((l) => l.id !== id));
  void getAuthUserId().then((uid) => { if (uid) void cloudDeleteList(id, uid); });
}

export async function touchLastUsed(id: string): Promise<void> {
  const lists = await loadHabitLists();
  const updated = lists.map((l) => (l.id === id ? { ...l, lastUsed: new Date().toISOString() } : l));
  await saveHabitLists(updated);
  void getAuthUserId().then((uid) => {
    if (uid) {
      const list = updated.find((l) => l.id === id);
      if (list) void cloudUpsertList(list, uid);
    }
  });
}

export function cartItemsToHabitItems(cartItems: CartItem[]): HabitItem[] {
  return cartItems.map((ci) => ({
    id:       `ci-${ci.id}`,
    name:     ci.productName,
    quantity: ci.quantity,
  }));
}

// ─── Optimisation de liste d'habitudes ────────────────────────────────────────

const OPTIM_STORES = [
  { id: 'optim-lidl',        name: 'Lidl',        brand: 'lidl'        },
  { id: 'optim-leclerc',     name: 'Leclerc',     brand: 'leclerc'     },
  { id: 'optim-carrefour',   name: 'Carrefour',   brand: 'carrefour'   },
  { id: 'optim-intermarche', name: 'Intermarché', brand: 'intermarche' },
  { id: 'optim-auchan',      name: 'Auchan',      brand: 'auchan'      },
];

export interface HabitOptimResult {
  bestStore: string;
  totalCost: number;
  savings:   number;
}

export function estimateHabitListOptim(list: HabitList): HabitOptimResult {
  let bestStore = OPTIM_STORES[0].name;
  let bestCost  = Infinity;

  for (const store of OPTIM_STORES) {
    const total = list.items.reduce((sum, item) => {
      const base  = estimateBasePrice(item.name);
      const price = realisticPrice(base, store.brand, store.id, item.name);
      return sum + price * item.quantity;
    }, 0);
    if (total < bestCost) { bestCost = total; bestStore = store.name; }
  }

  const refCost = list.items.reduce(
    (sum, item) => sum + estimateBasePrice(item.name) * item.quantity,
    0,
  );

  return {
    bestStore,
    totalCost: Math.round(bestCost * 100) / 100,
    savings:   Math.round(Math.max(0, refCost - bestCost) * 100) / 100,
  };
}
