// services/inventoryService.ts
// Recherche de prix produits dans store_inventory — utilisée par la carte (Price Pills)

import { apiClient } from './api/client';

// ─── Moteur de Prix Réalistes ─────────────────────────────────────────────────

/** Coefficients tarifaires par type d'enseigne (slug normalisé) */
const BRAND_PRICE_MULTIPLIERS: Record<string, number> = {
  lidl:        0.85,
  aldi:        0.85,
  netto:       0.88,
  leclerc:     0.95,
  intermarche: 0.97,
  carrefour:   1.00,
  auchan:      1.00,
  super_u:     1.02,
  casino:      1.08,
  spar:        1.12,
  franprix:    1.22,
  monoprix:    1.22,
};

export function getBrandCoefficient(brand: string): number {
  return BRAND_PRICE_MULTIPLIERS[brand.toLowerCase()] ?? 1.00;
}

/**
 * Bruit déterministe ±5 % basé sur les IDs (stable à travers les re-renders,
 * unique par paire magasin/produit, reproductible à l'identique).
 */
export function deterministicNoise(storeId: string, productName: string): number {
  const h1 = parseInt(storeId.replace(/-/g, '').slice(0, 8), 16) % 100;
  const h2 = productName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 50;
  return ((h1 + h2) % 100 - 50) / 1000; // -0.05 … +0.049
}

/**
 * Calcule un prix réaliste et persistant pour un magasin et un produit donnés :
 * prix de base × coefficient d'enseigne × (1 + bruit déterministe ±5 %).
 * Arrondi à 2 décimales pour l'affichage.
 */
export function realisticPrice(
  basePriceEuros: number,
  brand:          string,
  storeId:        string,
  productName:    string,
): number {
  const coefficient = getBrandCoefficient(brand);
  const noise       = deterministicNoise(storeId, productName);
  return Math.round(basePriceEuros * coefficient * (1 + noise) * 100) / 100;
}

/** Estimation du prix de base à partir du nom de produit (mots-clés fr/en) */
export function estimateBasePrice(productName: string): number {
  const n = productName.toLowerCase();
  if (/\beau\b|water/i.test(n))          return 0.65;
  if (/baguette|pain\b|bread/i.test(n))   return 1.10;
  if (/lait|milk/i.test(n))               return 1.05;
  if (/beurre|butter/i.test(n))           return 2.70;
  if (/fromage|cheese/i.test(n))          return 3.40;
  if (/yaourt|yogurt/i.test(n))           return 2.10;
  if (/oeuf|oeuf|eggs?/i.test(n))         return 3.20;
  if (/jambon|ham/i.test(n))              return 3.70;
  if (/jus\b|juice/i.test(n))             return 2.10;
  if (/bière|beer/i.test(n))              return 1.70;
  if (/vin\b|wine/i.test(n))              return 6.20;
  if (/café|coffee/i.test(n))             return 4.30;
  if (/pâtes|pasta/i.test(n))             return 1.40;
  if (/riz\b|rice/i.test(n))              return 1.70;
  if (/biscuit|cookie|gâteau/i.test(n))   return 2.40;
  if (/savon|soap|shampoing/i.test(n))    return 3.10;
  if (/dentifrice|toothpaste/i.test(n))   return 2.40;
  if (/déodorant|deodorant/i.test(n))     return 3.50;
  return 2.50;
}

// ─── Types flux inventaire communautaire ─────────────────────────────────────

export interface InventorySignal {
  id:          string;
  productName: string;
  price:       number;
  storeId:     string;
  storeName:   string;
  lastUpdated: string;
  confidence:  number;
  source:      string;
}

// ─── Types Open Food Facts ────────────────────────────────────────────────────

interface OffProduct {
  product_name?:    string;
  product_name_fr?: string;
  code?:            string;
}

interface OffResponse {
  products?: OffProduct[];
}

export interface InventoryPrice {
  storeId:     string;
  productName: string;
  price:       number;
  confidence:  number;
}

/**
 * Recherche un produit dans l'inventaire Supabase pour une liste de magasins.
 * Si aucun résultat local, tente un fallback Open Food Facts (C4).
 * Retourne au plus un prix par magasin (le meilleur match par confiance).
 */
export async function searchInventory(
  query:    string,
  storeIds: string[],
): Promise<InventoryPrice[]> {
  if (!query || query.length < 2 || storeIds.length === 0) return [];

  const supabase = apiClient.getSupabase();
  const { data, error } = await supabase.rpc('search_store_inventory', {
    p_query:     query,
    p_store_ids: storeIds,
  });

  const local: InventoryPrice[] = error || !data
    ? []
    : (data as { store_id: string; product_name: string; price: number; confidence_score: number }[]).map(
        (row) => ({
          storeId:     row.store_id,
          productName: row.product_name,
          price:       Number(row.price),
          confidence:  Number(row.confidence_score),
        }),
      );

  if (local.length > 0) return local;

  // ── Fallback Open Food Facts — produit inconnu en base ──────────────────
  return fetchFromOpenFoodFacts(query, storeIds);
}

/**
 * Signale un prix erroné : baisse le confidence_score via la RPC Supabase.
 * Best-effort — ne lance pas d'exception si le produit n'existe pas encore.
 */
export async function reportInventoryPrice(
  storeId:     string,
  productName: string,
  reason:      string,
): Promise<void> {
  const supabase = apiClient.getSupabase();
  await supabase.rpc('report_store_inventory_price', {
    p_store_id:     storeId,
    p_product_name: productName,
    p_reason:       reason,
  });
}

/**
 * Upsert manuel d'un article dans store_inventory.
 * Si `brand` est fourni, le prix est réajusté avec le coefficient de l'enseigne
 * + bruit déterministe pour être réaliste et persistant.
 */
export async function upsertInventoryItem(
  storeId:     string,
  productName: string,
  price:       number,
  barcode?:    string,
  brand?:      string,
): Promise<void> {
  const finalPrice = brand
    ? realisticPrice(price, brand, storeId, productName)
    : price;

  const supabase = apiClient.getSupabase();
  await supabase.from('store_inventory').upsert(
    {
      store_id:         storeId,
      product_name:     productName,
      price:            finalPrice,
      barcode:          barcode ?? null,
      confidence_score: 1.0,
      source:           'manual',
      last_updated:     new Date().toISOString(),
    },
    {
      onConflict:       barcode ? 'store_id,barcode' : 'store_id,product_name',
      ignoreDuplicates: false,
    },
  );
}

// ─── Flux inventaire communautaire (C3) ──────────────────────────────────────

/**
 * Récupère les contributions récentes à store_inventory triées par date DESC.
 * Utilisé par CommunityFeedScreen quand le flux de promos est vide.
 */
export async function getInventoryFeedSignals(limit = 15): Promise<InventorySignal[]> {
  const supabase = apiClient.getSupabase();
  const { data, error } = await supabase
    .from('store_inventory')
    .select('id, product_name, price, confidence_score, source, last_updated, store_id, stores(name)')
    .in('source', ['user', 'scan', 'off_fallback'])
    .order('last_updated', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as unknown as {
    id: string; product_name: string; price: number; confidence_score: number;
    source: string; last_updated: string; store_id: string;
    stores: { name: string } | { name: string }[] | null;
  }[]).map((row) => ({
    id:          row.id,
    productName: row.product_name,
    price:       Number(row.price),
    storeId:     row.store_id,
    storeName:   (Array.isArray(row.stores) ? row.stores[0]?.name : row.stores?.name) ?? 'Magasin',
    lastUpdated: row.last_updated,
    confidence:  Number(row.confidence_score),
    source:      row.source,
  }));
}

// ─── Substitution Intelligente ───────────────────────────────────────────────

export interface SubstitutionSuggestion {
  originalName:  string;
  altName:       string;
  altPrice:      number;
  originalPrice: number;
  savingsPct:    number;
}

function extractCategory(name: string): string {
  const n = name.toLowerCase();
  if (/beurre/.test(n))            return 'beurre';
  if (/lait/.test(n))              return 'lait';
  if (/fromage/.test(n))           return 'fromage';
  if (/yaourt/.test(n))            return 'yaourt';
  if (/oeuf/.test(n))              return 'oeuf';
  if (/jambon/.test(n))            return 'jambon';
  if (/café/.test(n))              return 'café';
  if (/pâtes/.test(n))             return 'pâtes';
  if (/riz\b/.test(n))             return 'riz';
  if (/pain|baguette/.test(n))     return 'pain';
  if (/shampoing|shampooing/.test(n)) return 'shampoing';
  if (/gel douche|savon/.test(n))  return 'gel douche';
  return n.split(/\s/)[0] ?? n;
}

export async function getSmartSubstitution(
  productName:  string,
  storeId:      string,
  currentPrice: number,
): Promise<SubstitutionSuggestion | null> {
  if (!productName || !storeId || currentPrice <= 0) return null;
  try {
    const category = extractCategory(productName);
    const { data, error } = await apiClient.getSupabase()
      .from('store_inventory')
      .select('product_name, price')
      .eq('store_id', storeId)
      .ilike('product_name', `%${category}%`)
      .neq('product_name', productName)
      .gt('price', 0)
      .order('price', { ascending: true })
      .limit(5);

    if (error || !data || data.length === 0) return null;

    const rows = data as { product_name: string; price: number }[];
    const alt  = rows.find((r) => Number(r.price) < currentPrice * 0.8);
    if (!alt) return null;

    const altPrice = Number(alt.price);
    return {
      originalName:  productName,
      altName:       alt.product_name,
      altPrice,
      originalPrice: currentPrice,
      savingsPct:    Math.round((1 - altPrice / currentPrice) * 100),
    };
  } catch {
    return null;
  }
}

// ─── Fallback Open Food Facts (C4) ───────────────────────────────────────────

const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

async function fetchFromOpenFoodFacts(
  query:    string,
  storeIds: string[],
): Promise<InventoryPrice[]> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 5000);

  try {
    const url  = `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(query)}&json=true&page_size=3&fields=product_name,product_name_fr,code`;
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return [];

    const body     = (await resp.json()) as OffResponse;
    const product  = body.products?.find((p) => p.product_name_fr ?? p.product_name);
    if (!product)  return [];

    const productName = ((product.product_name_fr ?? product.product_name ?? query) as string).slice(0, 100);
    const barcode     = product.code ?? undefined;
    const basePrice   = estimateBasePrice(productName);
    const supabase    = apiClient.getSupabase();
    const results: InventoryPrice[] = [];

    for (const storeId of storeIds.slice(0, 15)) {
      const price = realisticPrice(basePrice, 'default', storeId, productName);
      // Upsert en arrière-plan (best-effort, confidence faible car source OFF)
      void supabase.from('store_inventory').upsert(
        {
          store_id:         storeId,
          product_name:     productName,
          price,
          barcode:          barcode ?? null,
          confidence_score: 0.40,
          source:           'off_fallback',
          last_updated:     new Date().toISOString(),
        },
        { onConflict: barcode ? 'store_id,barcode' : 'store_id,product_name', ignoreDuplicates: true },
      );
      results.push({ storeId, productName, price, confidence: 0.40 });
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
