// contexts/CartContext.tsx
// Panier Malin virtuel — Offline-First + sync cloud best-effort

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../services/api/client';
import type { CartItem } from '../services/cartService';

export type { CartItem };

const CART_KEY    = '@pm_cart_v1';
const CART_TSKEY  = '@pm_cart_updated_at_v1';
const LOCK_KEY    = '@pm_cart_locked_store_v1';

// ─── Helpers cloud (best-effort) ──────────────────────────────────────────────

async function getAuthUserId(): Promise<string | null> {
  try {
    const { data } = await apiClient.getSupabase().auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

function cloudUpsertCart(items: CartItem[], lockedStore: string | null): void {
  void (async () => {
    const uid = await getAuthUserId();
    if (!uid) return;
    try {
      await apiClient.getSupabase()
        .from('user_active_cart')
        .upsert({
          user_id:      uid,
          items:        items as unknown as Record<string, unknown>[],
          locked_store: lockedStore,
          updated_at:   new Date().toISOString(),
        }, { onConflict: 'user_id' });
    } catch {}
  })();
}

interface CartContextValue {
  items:           CartItem[];
  lockedStore:     string | null;
  addItem:         (productName: string) => void;
  removeItem:      (id: string) => void;
  updateQuantity:  (id: string, qty: number) => void;
  clearCart:       () => void;
  setLockedStore:  (store: string | null) => void;
  totalItems:      number;
}

const CartContext = createContext<CartContextValue | null>(null);

function persistLocal(next: CartItem[]): void {
  AsyncStorage.setItem(CART_KEY, JSON.stringify(next)).catch(() => {});
  AsyncStorage.setItem(CART_TSKEY, new Date().toISOString()).catch(() => {});
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems]           = useState<CartItem[]>([]);
  const [lockedStore, setLockedStoreState] = useState<string | null>(null);
  const lockedStoreRef              = useRef<string | null>(null);

  const setLockedStore = useCallback((store: string | null) => {
    lockedStoreRef.current = store;
    setLockedStoreState(store);
    AsyncStorage.setItem(LOCK_KEY, store ?? '').catch(() => {});
  }, []);

  // Hydratation au démarrage : merge local ↔ cloud
  useEffect(() => {
    (async () => {
      // 1. Charge local en premier (instant)
      const [rawCart, rawLock] = await Promise.all([
        AsyncStorage.getItem(CART_KEY).catch(() => null),
        AsyncStorage.getItem(LOCK_KEY).catch(() => null),
      ]);
      if (rawCart) setItems(JSON.parse(rawCart) as CartItem[]);
      if (rawLock) { setLockedStoreState(rawLock); lockedStoreRef.current = rawLock; }

      // 2. Tente de récupérer le cloud si connecté
      const uid = await getAuthUserId();
      if (!uid) return;
      type CloudCart = { items: unknown; locked_store: string | null; updated_at: string };
      let data: CloudCart | null = null;
      try {
        const res = await apiClient.getSupabase()
          .from('user_active_cart')
          .select('items, locked_store, updated_at')
          .eq('user_id', uid)
          .single();
        data = res.data as unknown as CloudCart;
      } catch {}
      if (!data) return;

      const localTs = await AsyncStorage.getItem(CART_TSKEY).catch(() => null);
      const cloudTs = data?.updated_at ?? '';
      if (!cloudTs) return;
      // Cloud gagne si plus récent
      if (!localTs || cloudTs > localTs) {
        const cloudItems = Array.isArray(data?.items) ? (data.items as CartItem[]) : [];
        const cloudLock  = data?.locked_store ?? null;
        setItems(cloudItems);
        setLockedStoreState(cloudLock);
        lockedStoreRef.current = cloudLock;
        persistLocal(cloudItems);
        AsyncStorage.setItem(LOCK_KEY, cloudLock ?? '').catch(() => {});
        AsyncStorage.setItem(CART_TSKEY, cloudTs).catch(() => {});
      }
    })();
  }, []);

  const addItem = useCallback((productName: string) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productName.toLowerCase() === productName.toLowerCase(),
      );
      const next = existing
        ? prev.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { id: `${Date.now()}-${Math.random()}`, productName, quantity: 1 }];
      persistLocal(next);
      cloudUpsertCart(next, lockedStoreRef.current);
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      persistLocal(next);
      cloudUpsertCart(next, lockedStoreRef.current);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      const next = qty <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => i.id === id ? { ...i, quantity: qty } : i);
      persistLocal(next);
      cloudUpsertCart(next, lockedStoreRef.current);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setLockedStoreState(null);
    lockedStoreRef.current = null;
    AsyncStorage.removeItem(CART_KEY).catch(() => {});
    AsyncStorage.removeItem(LOCK_KEY).catch(() => {});
    cloudUpsertCart([], null);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, lockedStore, addItem, removeItem, updateQuantity, clearCart, setLockedStore, totalItems }),
    [items, lockedStore, addItem, removeItem, updateQuantity, clearCart, setLockedStore, totalItems],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}

// Helper exporté pour les autres services (SmartCartScreen, savingsService)
export function useCartLockedStore(): string | null {
  return useCart().lockedStore;
}
