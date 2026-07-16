import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './api/client';
import type { PurchasedVoucher } from '../types';

export type { PurchasedVoucher };

// ─── Clés AsyncStorage ────────────────────────────────────────────────────────

const K = {
  CART:            '@pm/cart_v1',
  FAVORITE_STORES: '@pm/fav_stores_v1',
  PENDING_SAVINGS: '@pm/pending_savings_v1',
  VOUCHERS:        '@pm/purchased_vouchers_v1',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedCartItem {
  id:          string;
  name:        string;
  quantity:    number;
  normalPrice: number;
  paidPrice:   number;
}

// ─── Panier ───────────────────────────────────────────────────────────────────

export async function saveCart(items: CachedCartItem[]): Promise<void> {
  await AsyncStorage.setItem(K.CART, JSON.stringify(items));
}

export async function loadCart(): Promise<CachedCartItem[]> {
  try {
    const raw = await AsyncStorage.getItem(K.CART);
    return raw ? (JSON.parse(raw) as CachedCartItem[]) : [];
  } catch {
    return [];
  }
}

export async function clearCart(): Promise<void> {
  await AsyncStorage.removeItem(K.CART);
}

// ─── Magasins favoris ─────────────────────────────────────────────────────────

export async function saveFavoriteStores(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(K.FAVORITE_STORES, JSON.stringify(ids));
}

/** Retourne null si pas encore en cache (première utilisation). */
export async function loadFavoriteStores(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(K.FAVORITE_STORES);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

// ─── Économies en attente de synchronisation ─────────────────────────────────
// Utilisé quand `incrementUserSavings` échoue (mode avion).
// Les économies sont accumulées localement et ré-envoyées au prochain lancement.

export async function addPendingSavings(amount: number): Promise<void> {
  const raw = await AsyncStorage.getItem(K.PENDING_SAVINGS);
  const prev = raw ? parseFloat(raw) : 0;
  await AsyncStorage.setItem(K.PENDING_SAVINGS, String(prev + amount));
}

/** Lit le montant en attente et le supprime de l'AsyncStorage. */
export async function consumePendingSavings(): Promise<number> {
  const raw = await AsyncStorage.getItem(K.PENDING_SAVINGS);
  if (!raw || parseFloat(raw) === 0) return 0;
  await AsyncStorage.removeItem(K.PENDING_SAVINGS);
  return parseFloat(raw);
}

export async function peekPendingSavings(): Promise<number> {
  const raw = await AsyncStorage.getItem(K.PENDING_SAVINGS);
  return raw ? parseFloat(raw) : 0;
}

// ─── Portefeuille de bons (offline-first) ────────────────────────────────────

export async function savePurchasedVouchers(vouchers: PurchasedVoucher[]): Promise<void> {
  await AsyncStorage.setItem(K.VOUCHERS, JSON.stringify(vouchers));
}

export async function loadPurchasedVouchers(): Promise<PurchasedVoucher[]> {
  try {
    const raw = await AsyncStorage.getItem(K.VOUCHERS);
    return raw ? (JSON.parse(raw) as PurchasedVoucher[]) : [];
  } catch {
    return [];
  }
}

export async function addPurchasedVoucher(voucher: PurchasedVoucher): Promise<void> {
  const existing = await loadPurchasedVouchers();
  const deduped  = existing.filter((v) => v.id !== voucher.id);
  await savePurchasedVouchers([voucher, ...deduped]);
}

// ─── Synchronisation bidirectionnelle avec Supabase ───────────────────────────
// Tente de pousser les données offline vers Supabase.
// Stratégie : optimistic sync, silent fail — si le réseau échoue, on garde
// les données localement sans crasher l'app.

export interface SyncResult {
  synced:  boolean;
  detail:  string;
  errors:  string[];
}

export async function syncOfflineDataWithSupabase(): Promise<SyncResult> {
  const supabase = apiClient.getSupabase();
  const errors: string[] = [];
  const done:   string[] = [];

  // ── Vérification session ──────────────────────────────────────────────────
  let userId: string;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { synced: false, detail: 'Non connecté', errors: [] };
    userId = user.id;
  } catch {
    return { synced: false, detail: 'Impossible de joindre Supabase', errors: ['auth'] };
  }

  // ── 1. Économies en attente ───────────────────────────────────────────────
  const pending = await consumePendingSavings();
  if (pending > 0) {
    try {
      const { error } = await supabase.rpc('increment_user_savings', { amount: pending });
      if (error) throw error;
      done.push(`${pending.toFixed(2)}€ économies`);
    } catch {
      await addPendingSavings(pending); // remet en file d'attente
      errors.push('savings');
    }
  }

  // ── 2. Bons d'achat hors-ligne → user_vouchers (upsert idempotent) ───────
  const localVouchers = await loadPurchasedVouchers();
  if (localVouchers.length > 0) {
    try {
      const rows = localVouchers.map((v) => ({
        id:                 v.id,
        user_id:            userId,
        voucher_id:         v.voucherId,
        voucher_title:      v.title,
        voucher_face_value: v.faceValue,
        voucher_brand:      v.brand,
        voucher_emoji:      v.emoji,
        barcode_code:       v.barcodeCode,
        coins_spent:        v.costCoins,
        purchased_at:       v.purchasedAt,
        expires_at:         v.expiresAt,
        used:               v.used,
      }));

      const { error } = await supabase
        .from('user_vouchers')
        .upsert(rows, { onConflict: 'id' });

      if (error) throw error;
      done.push(`${localVouchers.length} bon(s) d'achat`);
    } catch {
      errors.push('vouchers');
    }
  }

  const detail = done.length > 0
    ? `Synchronisé : ${done.join(' · ')}`
    : 'Rien à synchroniser';

  return { synced: true, detail, errors };
}
