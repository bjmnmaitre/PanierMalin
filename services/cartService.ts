// services/cartService.ts
// Panier Malin virtuel — algorithme d'optimisation multi-enseignes

import { searchInventory } from './inventoryService';

export interface CartItem {
  id:          string;
  productName: string;
  quantity:    number;
}

export interface StoreCandidate {
  id:        string;
  name:      string;
  brand:     string;
  latitude?: number;
  longitude?: number;
}

export interface CartOptimResult {
  bestStore:  StoreCandidate;
  totalPrice: number;
  savings:    number;
}

export interface StoreScore {
  store:      StoreCandidate;
  totalPrice: number;
  itemsFound: number;
  totalItems: number;
  savings:    number;
}

export interface DetailedOptimResult {
  scores:    StoreScore[];   // sorted cheapest first
  bestStore: StoreCandidate;
  maxPrice:  number;
}

/**
 * Pour chaque article du panier, cherche le prix dans store_inventory
 * pour tous les magasins candidats, puis agrège par magasin et retourne
 * le magasin le moins cher avec l'économie réalisée vs le plus cher.
 *
 * On limite à max 20 magasins pour éviter un burst de requêtes réseau.
 */
export async function optimizeCart(
  items:  CartItem[],
  stores: StoreCandidate[],
): Promise<CartOptimResult | null> {
  if (items.length === 0 || stores.length === 0) return null;

  const candidates = stores.slice(0, 20);
  const storeIds   = candidates.map((s) => s.id);

  // Prix total par magasin (storeId → cumul prix×quantité)
  const totals = new Map<string, number>();

  await Promise.all(
    items.map(async (item) => {
      try {
        const results = await searchInventory(item.productName, storeIds);
        for (const r of results) {
          totals.set(r.storeId, (totals.get(r.storeId) ?? 0) + r.price * item.quantity);
        }
      } catch {
        // best-effort : si un article ne matche pas, il est ignoré
      }
    }),
  );

  if (totals.size === 0) return null;

  let bestId    = '';
  let minPrice  = Infinity;
  let maxPrice  = 0;

  for (const [storeId, total] of totals.entries()) {
    if (total < minPrice) { minPrice = total; bestId = storeId; }
    if (total > maxPrice)   maxPrice = total;
  }

  const bestStore = candidates.find((s) => s.id === bestId);
  if (!bestStore) return null;

  return {
    bestStore,
    totalPrice: minPrice,
    savings:    Math.max(0, maxPrice - minPrice),
  };
}

/**
 * Variante détaillée : retourne un score par magasin (trié du moins cher
 * au plus cher) avec le nombre d'articles trouvés et l'économie réalisée
 * par rapport au magasin le plus cher ayant des données.
 */
export async function optimizeCartDetailed(
  items:  CartItem[],
  stores: StoreCandidate[],
): Promise<DetailedOptimResult | null> {
  if (items.length === 0 || stores.length === 0) return null;

  const candidates = stores.slice(0, 20);
  const storeIds   = candidates.map((s) => s.id);

  const totals = new Map<string, number>();
  const found  = new Map<string, number>();

  await Promise.all(
    items.map(async (item) => {
      try {
        const results = await searchInventory(item.productName, storeIds);
        for (const r of results) {
          totals.set(r.storeId, (totals.get(r.storeId) ?? 0) + r.price * item.quantity);
          found.set(r.storeId,  (found.get(r.storeId)  ?? 0) + 1);
        }
      } catch { /* best-effort */ }
    }),
  );

  if (totals.size === 0) return null;

  let maxPrice = 0;
  for (const total of totals.values()) {
    if (total > maxPrice) maxPrice = total;
  }

  const scores: StoreScore[] = candidates
    .filter((s) => totals.has(s.id))
    .map((s) => ({
      store:      s,
      totalPrice: totals.get(s.id)!,
      itemsFound: found.get(s.id) ?? 0,
      totalItems: items.length,
      savings:    Math.max(0, maxPrice - (totals.get(s.id) ?? maxPrice)),
    }))
    .sort((a, b) => a.totalPrice - b.totalPrice);

  if (scores.length === 0) return null;

  return { scores, bestStore: scores[0].store, maxPrice };
}

// ─── Split-Shopping ────────────────────────────────────────────────────────────

export interface SplitResult {
  storeA:         StoreCandidate;
  storeB:         StoreCandidate;
  itemsA:         CartItem[];
  itemsB:         CartItem[];
  totalSplitCost: number;
  netSavings:     number;
}

const SPLIT_TRAVEL_OVERHEAD = 1.50; // € pour le second trajet

/**
 * Teste toutes les paires de magasins parmi les top-5, assigne chaque article
 * au magasin le moins cher, et retourne la paire gagnante si l'économie nette
 * dépasse 5 € OU 15 % par rapport au meilleur magasin unique.
 */
export async function calculateSplitShopping(
  items:            CartItem[],
  topStores:        StoreCandidate[],
  singleBestPrice:  number,
): Promise<SplitResult | null> {
  if (items.length < 2 || topStores.length < 2) return null;

  const candidates = topStores.slice(0, 5);
  const storeIds   = candidates.map((s) => s.id);

  // Matrice de prix : itemId → storeId → prix unitaire
  const matrix = new Map<string, Map<string, number>>();
  for (const item of items) matrix.set(item.id, new Map());

  await Promise.all(
    items.map(async (item) => {
      try {
        const results = await searchInventory(item.productName, storeIds);
        for (const r of results) matrix.get(item.id)!.set(r.storeId, r.price);
      } catch {}
    }),
  );

  let bestSplit: SplitResult | null = null;
  let bestSavings = 0;

  for (let i = 0; i < candidates.length - 1; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const storeA = candidates[i];
      const storeB = candidates[j];
      const itemsA: CartItem[] = [];
      const itemsB: CartItem[] = [];
      let totalCost = SPLIT_TRAVEL_OVERHEAD;

      for (const item of items) {
        const priceA = matrix.get(item.id)?.get(storeA.id) ?? Infinity;
        const priceB = matrix.get(item.id)?.get(storeB.id) ?? Infinity;
        if (priceA <= priceB) {
          itemsA.push(item);
          if (priceA !== Infinity) totalCost += priceA * item.quantity;
        } else {
          itemsB.push(item);
          if (priceB !== Infinity) totalCost += priceB * item.quantity;
        }
      }

      if (itemsA.length === 0 || itemsB.length === 0) continue;

      const savings = singleBestPrice - totalCost;
      const pct     = singleBestPrice > 0 ? savings / singleBestPrice : 0;

      if ((savings > 5 || pct > 0.15) && savings > bestSavings) {
        bestSavings = savings;
        bestSplit = {
          storeA, storeB, itemsA, itemsB,
          totalSplitCost: Math.round(totalCost * 100) / 100,
          netSavings:     Math.round(savings * 100) / 100,
        };
      }
    }
  }

  return bestSplit;
}
