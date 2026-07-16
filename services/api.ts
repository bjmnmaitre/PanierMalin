import { apiClient } from './api/client';
const supabase = apiClient.getSupabase();
import {
  Product,
  ProductWithOffers,
  ProductPrice,
  Store,
  ShoppingList,
  ListItem,
  SavedBasketData,
  OptimizationResult,
  CommunityActivityItem,
  LeaderboardEntry,
  UserProfile,
  EventData,
  OnboardingProfileInput,
  UniversalStoreResult,
} from '../types';

export type { UniversalStoreResult } from '../types';

const USE_MOCK_PRODUCTS = false;
const USE_MOCK_PROFILE = false;
const USE_MOCK_LISTS = false;
const USE_MOCK_BASKETS = false;
const USE_MOCK_OPTIMIZE = false;
const USE_MOCK_FEED = false;
const USE_MOCK_LEADERBOARD = false;
const USE_MOCK_EVENTS = false;
const USE_MOCK_PRICE_ACTIONS = false;

export async function fetchOptimizationData(listId: string): Promise<OptimizationResult> {
  console.log(`[API] Appel fetchOptimizationData pour la liste : ${listId}`);
  return optimizeBasket(listId);
}

export async function updateCrowdsourcedPrice(
  productId: string,
  storeId: string,
  newPrice: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  console.log(`[API] Signalement prix Waze-like - Produit: ${productId}, Prix: ${newPrice}`);

  const { error } = await supabase
    .from('prices')
    .insert([{
      product_id: productId,
      store_id: storeId,
      price: newPrice,
      scanned_by: user.id,
      source: 'user',
      is_verified: false
    }]);

  if (error) throw error;

  await supabase.from('community_activity').insert([{
    user_id: user.id,
    type: 'price_reported',
    message: `a signalé un nouveau prix à ${newPrice}€ via le mode course`,
    related_product_id: productId
  }]);
}

export async function getProductByEan(ean: string): Promise<ProductWithOffers | null> {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('ean', ean)
    .single();

  if (productError || !product) return null;

  const { data: prices, error: pricesError } = await supabase
    .from('prices')
    .select('*, stores(id, name, chain, logo_uri)')
    .eq('product_id', product.id)
    .order('price', { ascending: true });

  if (pricesError) throw pricesError;

  return {
    id: product.id,
    ean: product.ean,
    name: product.name,
    brand: product.brand,
    category: product.category,
    nutriscore: product.nutriscore as any,
    imageUrl: product.image_url,
    offers: (prices ?? []).map((p: any) => ({
      id: p.store_id,
      storeId: p.store_id,
      storeName: p.stores?.name ?? 'Magasin inconnu',
      chain: (p.stores?.chain ?? 'leclerc') as any,
      logoUri: p.stores?.logo_uri ?? '',
      distanceKm: 0,
      price: Number(p.price),
      verifiedAt: p.verified_at || new Date().toISOString(),
      proofImageUri: p.proof_image_url,
      isVerified: p.is_verified,
    })),
  };
}

const storeLookupCache: Record<string, { timestamp: number; stores: Store[] }> = {};
const STORE_CACHE_TTL_MS = 30_000;

function inferBrandFromName(name?: string, fallback?: string): string {
  const source = `${name ?? ''} ${fallback ?? ''}`.toLowerCase();

  const brandPatterns: Array<{ regex: RegExp; brand: string }> = [
    { regex: /\bleclerc\b/i, brand: 'Leclerc' },
    { regex: /\blidl\b/i, brand: 'Lidl' },
    { regex: /\bcarrefour\b/i, brand: 'Carrefour' },
    { regex: /\bintermarch[ée]?\b/i, brand: 'Intermarché' },
    { regex: /\bsuper\s*u\b/i, brand: 'Super U' },
    { regex: /\bauchan\b/i, brand: 'Auchan' },
    { regex: /\baldi\b/i, brand: 'Aldi' },
    { regex: /\bnetto\b/i, brand: 'Netto' },
    { regex: /\bcasino\b/i, brand: 'Casino' },
    { regex: /\bmonoprix\b/i, brand: 'Monoprix' },
    { regex: /\bcora\b/i, brand: 'Cora' },
  ];

  for (const candidate of brandPatterns) {
    if (candidate.regex.test(source)) return candidate.brand;
  }

  return fallback?.trim() || 'Magasin';
}

function extractAddress(tags: Record<string, string>): string {
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:postcode'], tags['addr:city']]
    .filter((value): value is string => Boolean(value && value.trim()));

  return parts.join(' ');
}

function getElementCenter(element: any): { latitude: number; longitude: number } | null {
  if (typeof element?.center?.lat === 'number' && typeof element?.center?.lon === 'number') {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }

  if (typeof element?.lat === 'number' && typeof element?.lon === 'number') {
    return { latitude: element.lat, longitude: element.lon };
  }

  const geometry = Array.isArray(element?.geometry) ? element.geometry : [];
  const points = geometry.filter((point: any) => typeof point?.lat === 'number' && typeof point?.lon === 'number');

  if (points.length > 0) {
    const averageLat = points.reduce((sum: number, point: any) => sum + point.lat, 0) / points.length;
    const averageLon = points.reduce((sum: number, point: any) => sum + point.lon, 0) / points.length;
    return { latitude: averageLat, longitude: averageLon };
  }

  if (element?.bounds) {
    const minLat = Number(element.bounds.minlat);
    const maxLat = Number(element.bounds.maxlat);
    const minLon = Number(element.bounds.minlon);
    const maxLon = Number(element.bounds.maxlon);

    if (Number.isFinite(minLat) && Number.isFinite(maxLat) && Number.isFinite(minLon) && Number.isFinite(maxLon)) {
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
      };
    }
  }

  return null;
}

function isRelevantOverpassStore(tags: Record<string, string | undefined>): boolean {
  const shopValue = (tags.shop ?? '').toLowerCase();
  const amenityValue = (tags.amenity ?? '').toLowerCase();
  const combinedName = `${tags.name ?? ''} ${tags.brand ?? ''} ${tags.operator ?? ''}`.toLowerCase();

  if (amenityValue === 'fuel') {
    return false;
  }

  if (shopValue && !['supermarket', 'convenience'].includes(shopValue)) {
    return false;
  }

  if (/(station|total|avia|esso|shell|eni|elan)/i.test(combinedName)) {
    return false;
  }

  return shopValue === 'supermarket' || shopValue === 'convenience';
}

function mapOverpassElementToStore(element: any): Store | null {
  const tags = element?.tags ?? {};
  const name = tags.name?.trim() || tags.brand?.trim() || 'Magasin';

  if (!isRelevantOverpassStore(tags)) {
    return null;
  }

  const center = getElementCenter(element);
  if (!center) {
    return null;
  }

  const address = extractAddress(tags) || tags['addr:full'] || '';

  return {
    id: `osm-${element?.type}-${element?.id}`,
    name,
    brand: inferBrandFromName(name, tags.brand || tags.operator || tags.shop),
    address,
    latitude: center.latitude,
    longitude: center.longitude,
    hours: tags.opening_hours || 'Horaires non communiqués',
  };
}

// ─── Bounding boxes par département (métropole principale) ──────────────────

const DEPT_BBOX: Record<string, { latMin: number; latMax: number; lngMin: number; lngMax: number }> = {
  '17': { latMin: 45.13, latMax: 46.36, lngMin: -1.62, lngMax: -0.17 }, // Charente-Maritime
  '33': { latMin: 44.19, latMax: 45.57, lngMin: -1.39, lngMax: 0.33 },  // Gironde
  '75': { latMin: 48.81, latMax: 48.90, lngMin: 2.22, lngMax: 2.47 },   // Paris
  '69': { latMin: 45.55, latMax: 46.30, lngMin: 4.53, lngMax: 5.27 },   // Rhône
  '13': { latMin: 43.17, latMax: 43.85, lngMin: 4.78, lngMax: 6.01 },   // Bouches-du-Rhône
};

/**
 * Récupère les magasins d'un département via son code (ex: '17').
 * Interroge directement la base Supabase (table `stores`).
 */
export async function getStoresByDepartment(deptCode: string): Promise<Store[]> {
  const bbox = DEPT_BBOX[deptCode];
  if (!bbox) throw new Error(`Département ${deptCode} non référencé.`);

  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .gte('lat', bbox.latMin)
    .lte('lat', bbox.latMax)
    .gte('lng', bbox.lngMin)
    .lte('lng', bbox.lngMax)
    .order('name');

  if (error) throw error;

  return (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    brand: s.chain ?? s.name,
    address: s.address ?? '',
    latitude: s.lat,
    longitude: s.lng,
    hours: s.hours ?? '',
  }));
}

/**
 * Récupère les magasins Supabase proches d'une position GPS.
 * Utilise un filtre bounding-box approché (1° ≈ 111 km).
 */
export async function getSupabaseNearbyStores(
  lat: number,
  lng: number,
  radiusKm: number = 10
): Promise<Store[]> {
  const delta = radiusKm / 111;
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .gte('lat', lat - delta)
    .lte('lat', lat + delta)
    .gte('lng', lng - delta)
    .lte('lng', lng + delta);

  if (error) throw error;

  return (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    brand: s.chain ?? s.name,
    address: s.address ?? '',
    latitude: s.lat,
    longitude: s.lng,
    hours: s.hours ?? '',
  }));
}

export async function getClosestStores(lat: number, lng: number, radius: number = 5000): Promise<Store[]> {
  const roundedLat = Number(lat.toFixed(4));
  const roundedLng = Number(lng.toFixed(4));
  const cacheKey = `${roundedLat}:${roundedLng}:${Math.round(radius / 1000)}`;
  const now = Date.now();
  const cachedEntry = storeLookupCache[cacheKey];

  if (cachedEntry && now - cachedEntry.timestamp < STORE_CACHE_TTL_MS) {
    return cachedEntry.stores;
  }

  const query = `[out:json][timeout:25];(
    node["shop"~"^(supermarket|convenience)$"](around:${radius},${lat},${lng});
    way["shop"~"^(supermarket|convenience)$"](around:${radius},${lat},${lng});
    relation["shop"~"^(supermarket|convenience)$"](around:${radius},${lat},${lng});
  );out center;`;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams({ data: query }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Overpass request failed with ${response.status}`);
    }

    const data = await response.json();
    const stores = (data?.elements ?? [])
      .map(mapOverpassElementToStore)
      .filter((store: Store | null): store is Store => Boolean(store));

    const uniqueStores = stores.filter(
      (store: Store, index: number, allStores: Store[]) => allStores.findIndex((candidate: Store) => candidate.id === store.id) === index
    );

    const sortedStores = uniqueStores.sort((a: Store, b: Store) => a.name.localeCompare(b.name));

    storeLookupCache[cacheKey] = {
      timestamp: now,
      stores: sortedStores,
    };

    return sortedStores.slice(0, 20);
  } catch (error) {
    console.warn('Overpass lookup failed', error);
    return [];
  }
}

const universalSearchCache: Record<string, { timestamp: number; results: UniversalStoreResult[] }> = {};
const UNIVERSAL_SEARCH_CACHE_TTL_MS = 30_000;
const UNIVERSAL_SEARCH_DEFAULT_RADIUS_METERS = 5000;

const UNIVERSAL_SEARCH_SYNONYMS: Record<string, string[]> = {
  boulangerie: ['bakery'],
  boulanger: ['bakery'],
  patisserie: ['pastry', 'confectionery'],
  patissier: ['pastry', 'confectionery'],
  boucherie: ['butcher'],
  boucher: ['butcher'],
  poissonnerie: ['seafood'],
  fromagerie: ['cheese', 'dairy'],
  primeur: ['greengrocer'],
  epicerie: ['convenience', 'grocery'],
  pharmacie: ['pharmacy'],
  parapharmacie: ['chemist'],
  opticien: ['optician'],
  coiffeur: ['hairdresser'],
  fleuriste: ['florist'],
  librairie: ['books'],
  papeterie: ['stationery'],
  quincaillerie: ['hardware', 'doityourself'],
  bricolage: ['doityourself', 'hardware'],
  cordonnier: ['shoe_repair'],
  pressing: ['dry_cleaning', 'laundry'],
  cbd: ['herbalist', 'cannabis'],
  vape: ['e-cigarette'],
  animalerie: ['pet'],
  bijouterie: ['jewelry'],
  horlogerie: ['watches'],
  vetements: ['clothes'],
  chaussures: ['shoes'],
  sport: ['sports'],
  jouets: ['toys'],
  informatique: ['computer', 'electronics'],
  telephonie: ['mobile_phone', 'electronics'],
  meubles: ['furniture'],
};

const UNIVERSAL_CRAFT_KEYWORDS = ['artisan', 'artisanat', 'ebeniste', 'menuisier', 'plombier', 'electricien', 'serrurier', 'tapissier'];

const UNIVERSAL_CATEGORY_LABELS: Record<string, string> = {
  bakery: 'Boulangerie',
  pastry: 'Pâtisserie',
  confectionery: 'Confiserie',
  butcher: 'Boucherie',
  seafood: 'Poissonnerie',
  cheese: 'Fromagerie',
  dairy: 'Crèmerie',
  greengrocer: 'Primeur',
  convenience: 'Épicerie',
  grocery: 'Épicerie',
  pharmacy: 'Pharmacie',
  chemist: 'Parapharmacie',
  optician: 'Opticien',
  hairdresser: 'Coiffeur',
  florist: 'Fleuriste',
  books: 'Librairie',
  stationery: 'Papeterie',
  hardware: 'Quincaillerie',
  doityourself: 'Bricolage',
  shoe_repair: 'Cordonnerie',
  dry_cleaning: 'Pressing',
  laundry: 'Laverie',
  herbalist: 'Herboristerie / CBD',
  cannabis: 'Boutique CBD',
  'e-cigarette': 'Cigarette électronique',
  pet: 'Animalerie',
  jewelry: 'Bijouterie',
  watches: 'Horlogerie',
  clothes: 'Vêtements',
  shoes: 'Chaussures',
  sports: 'Articles de sport',
  toys: 'Jouets',
  computer: 'Informatique',
  electronics: 'Électronique',
  mobile_phone: 'Téléphonie',
  furniture: 'Meubles',
};

const ACCENT_CHAR_MAP: Record<string, string> = {
  à: 'a', â: 'a', ä: 'a', á: 'a',
  ç: 'c',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  î: 'i', ï: 'i',
  ô: 'o', ö: 'o',
  ù: 'u', û: 'u', ü: 'u',
  ÿ: 'y',
  œ: 'oe',
};

function normalizeKeyword(keyword: string): string {
  return keyword
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => ACCENT_CHAR_MAP[char] ?? char)
    .join('');
}

function escapeOverpassRegex(value: string): string {
  return value.replace(/["\\]/g, '');
}

function computeDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function resolveCategoryLabel(tags: Record<string, string | undefined>): string {
  const rawValue = tags.shop || tags.amenity || tags.craft;
  if (!rawValue) return 'Commerce';

  const label = UNIVERSAL_CATEGORY_LABELS[rawValue.toLowerCase()];
  if (label) return label;

  return rawValue.replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function buildUniversalOverpassQuery(normalizedKeyword: string, lat: number, lng: number, radius: number): string {
  const synonyms = UNIVERSAL_SEARCH_SYNONYMS[normalizedKeyword] ?? [];
  const around = `around:${radius},${lat},${lng}`;
  const clauses: string[] = [];

  synonyms.forEach((tagValue) => {
    clauses.push(`node(${around})["shop"="${tagValue}"];`);
    clauses.push(`node(${around})["amenity"="${tagValue}"];`);
  });

  if (UNIVERSAL_CRAFT_KEYWORDS.includes(normalizedKeyword)) {
    clauses.push(`node(${around})["craft"];`);
  }

  const escaped = escapeOverpassRegex(normalizedKeyword);
  if (escaped) {
    clauses.push(`node(${around})["shop"~"${escaped}",i];`);
    clauses.push(`node(${around})["amenity"~"${escaped}",i];`);
    clauses.push(`node(${around})["craft"~"${escaped}",i];`);
    clauses.push(`node(${around})["name"~"${escaped}",i];`);
  }

  return `[out:json][timeout:25];(${clauses.join('')});out center 40;`;
}

function mapOverpassElementToUniversalStore(element: any, originLat: number, originLng: number): UniversalStoreResult | null {
  const tags = element?.tags ?? {};
  const name = tags.name?.trim() || tags.brand?.trim();

  if (!name) {
    return null;
  }

  const center = getElementCenter(element);
  if (!center) {
    return null;
  }

  return {
    id: `osm-${element?.type}-${element?.id}`,
    name,
    category: resolveCategoryLabel(tags),
    address: extractAddress(tags) || tags['addr:full'] || '',
    latitude: center.latitude,
    longitude: center.longitude,
    distanceKm: computeDistanceKm(originLat, originLng, center.latitude, center.longitude),
    hours: tags.opening_hours,
    phone: tags.phone || tags['contact:phone'],
    website: tags.website || tags['contact:website'],
  };
}

export async function searchUniversalStores(
  keyword: string,
  lat: number,
  lng: number,
  radius: number = UNIVERSAL_SEARCH_DEFAULT_RADIUS_METERS
): Promise<UniversalStoreResult[]> {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return [];
  }

  const roundedLat = Number(lat.toFixed(4));
  const roundedLng = Number(lng.toFixed(4));
  const cacheKey = `${normalizedKeyword}:${roundedLat}:${roundedLng}:${Math.round(radius / 1000)}`;
  const now = Date.now();
  const cachedEntry = universalSearchCache[cacheKey];

  if (cachedEntry && now - cachedEntry.timestamp < UNIVERSAL_SEARCH_CACHE_TTL_MS) {
    return cachedEntry.results;
  }

  const query = buildUniversalOverpassQuery(normalizedKeyword, lat, lng, radius);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: new URLSearchParams({ data: query }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Overpass request failed with ${response.status}`);
    }

    const data = await response.json();
    const results = (data?.elements ?? [])
      .map((element: any) => mapOverpassElementToUniversalStore(element, lat, lng))
      .filter((store: UniversalStoreResult | null): store is UniversalStoreResult => Boolean(store));

    const uniqueResults = results.filter(
      (store: UniversalStoreResult, index: number, allStores: UniversalStoreResult[]) =>
        allStores.findIndex((candidate: UniversalStoreResult) => candidate.id === store.id) === index
    );

    const sortedResults = uniqueResults.sort(
      (a: UniversalStoreResult, b: UniversalStoreResult) => a.distanceKm - b.distanceKm
    );

    universalSearchCache[cacheKey] = {
      timestamp: now,
      results: sortedResults,
    };

    return sortedResults.slice(0, 30);
  } catch (error) {
    console.warn('[API] searchUniversalStores a échoué', error);
    return [];
  }
}

export async function getProductPrices(productId: string): Promise<ProductPrice[]> {
  const { data, error } = await supabase
    .from('best_prices_per_product')
    .select('*')
    .eq('product_id', productId);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    price: Number(row.price),
    proofImageUrl: row.proof_image_url ?? null,
    isVerified: row.is_verified,
    verifiedAt: row.verified_at ?? null,
    storeName: row.store_name ?? null,
  }));
}

export async function searchProducts(query: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or(`name.ilike.%${query}%,brand.ilike.%${query}%`);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    ean: row.ean,
    name: row.name,
    brand: row.brand,
    category: row.category,
    nutriscore: row.nutriscore as any,
    imageUrl: row.image_url,
  }));
}

export async function confirmPriceWithPhoto(
  productId: string,
  storeId: string,
  price: number,
  photoUri: string
): Promise<{ pointsEarned: number; isFirstToday: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { error: priceError } = await supabase
    .from('prices')
    .insert([{
      product_id: productId,
      store_id: storeId,
      price,
      scanned_by: user.id,
      proof_image_url: photoUri,
      source: 'user',
      is_verified: true
    }]);

  if (priceError) throw priceError;

  await supabase.from('community_activity').insert([{
    user_id: user.id,
    type: 'price_confirmed',
    message: 'a confirmé un prix en magasin',
    related_product_id: productId,
    proof_image_url: photoUri
  }]);

  return { pointsEarned: 20, isFirstToday: true };
}

export async function reportDifferentPrice(
  productId: string,
  storeId: string,
  reportedPrice: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { error } = await supabase
    .from('prices')
    .insert([{
      product_id: productId,
      store_id: storeId,
      price: reportedPrice,
      scanned_by: user.id,
      source: 'user',
      is_verified: false
    }]);

  if (error) throw error;

  await supabase.from('community_activity').insert([{
    user_id: user.id,
    type: 'price_reported',
    message: `a signalé un nouveau prix à ${reportedPrice}€`,
    related_product_id: productId
  }]);
}

export async function getMyLists(): Promise<ShoppingList[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { data: sharedBaskets, error: sharedError } = await supabase
    .from('list_collaborators')
    .select('list_id')
    .eq('user_id', user.id);

  if (sharedError) throw sharedError;
  const sharedIds: string[] = (sharedBaskets ?? []).map((b: any) => b.list_id as string);

  const { data: lists, error: listsError } = await supabase
    .from('shopping_lists')
    .select('*')
    .or(`user_id.eq.${user.id},id.in.(${sharedIds.length > 0 ? sharedIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
    .eq('is_archived', false);

  if (listsError) throw listsError;
  if (!lists || lists.length === 0) return [];

  const listIds = lists.map((l: any) => l.id);

  const { data: items, error: itemsError } = await supabase
    .from('list_items')
    .select('list_id, qty, checked, price')
    .in('list_id', listIds);

  if (itemsError) throw itemsError;

  const { data: collaborators, error: collabError } = await supabase
    .from('list_collaborators')
    .select('list_id, user_id, users_profiles(avatar_url)')
    .in('list_id', listIds);

  if (collabError) throw collabError;

  return lists.map((list: any) => {
    const listItems = (items ?? []).filter((it: any) => it.list_id === list.id);
    const itemCount = listItems.length;
    const doneCount = listItems.filter((it: any) => it.checked).length;
    const estimatedTotal = listItems.reduce(
      (sum: number, it: any) => sum + (Number(it.price) || 0) * Number(it.qty),
      0
    );

    const listCollabs = (collaborators ?? []).filter((c: any) => c.list_id === list.id);
    const collaboratorAvatars: string[] = listCollabs
      .map((c: any) => c.users_profiles?.avatar_url)
      .filter((url: unknown): url is string => typeof url === 'string');

    return {
      id: list.id,
      name: list.name,
      itemCount,
      doneCount,
      estimatedTotal,
      isShared: list.is_shared || listCollabs.length > 0,
      isArchived: list.is_archived,
      collaboratorAvatars,
      createdAt: list.created_at,
    };
  });
}

export async function getArchivedLists(): Promise<ShoppingList[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { data: lists, error: listsError } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_archived', true)
    .order('created_at', { ascending: false });

  if (listsError) throw listsError;
  if (!lists || lists.length === 0) return [];

  const listIds = lists.map((l: any) => l.id);

  const { data: items, error: itemsError } = await supabase
    .from('list_items')
    .select('list_id, qty, checked, price')
    .in('list_id', listIds);

  if (itemsError) throw itemsError;

  return lists.map((list: any) => {
    const listItems = (items ?? []).filter((it: any) => it.list_id === list.id);
    const itemCount = listItems.length;
    const doneCount = listItems.filter((it: any) => it.checked).length;
    const estimatedTotal = listItems.reduce(
      (sum: number, it: any) => sum + (Number(it.price) || 0) * Number(it.qty),
      0
    );

    return {
      id: list.id,
      name: list.name,
      itemCount,
      doneCount,
      estimatedTotal,
      isShared: Boolean(list.is_shared),
      isArchived: true,
      collaboratorAvatars: [],
      createdAt: list.created_at,
    };
  });
}

export async function createShoppingList(name: string): Promise<ShoppingList> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert([{ name, user_id: user.id, is_archived: false, is_shared: false }])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    itemCount: 0,
    doneCount: 0,
    estimatedTotal: 0,
    isShared: data.is_shared,
    isArchived: data.is_archived,
    collaboratorAvatars: [],
    collaborators: [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getListItems(listId: string): Promise<ListItem[]> {
  const { data, error } = await supabase
    .from('list_items')
    .select('*, products(name, brand, image_url)')
    .eq('list_id', listId);

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    listId: item.list_id,
    productId: item.product_id,
    customName: item.custom_name ?? item.products?.name ?? null,
    quantity: Number(item.qty),
    qty: Number(item.qty),
    isDone: Boolean(item.checked),
    checked: Boolean(item.checked),
    brand: item.products?.brand,
    imageUrl: item.products?.image_url,
    price: item.price !== null ? Number(item.price) : undefined,
  }));
}

export async function addListItem(listId: string, customName: string, qty: number = 1): Promise<ListItem> {
  const { data, error } = await supabase
    .from('list_items')
    .insert([{ list_id: listId, custom_name: customName, qty, checked: false }])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    listId: data.list_id,
    productId: data.product_id,
    customName: data.custom_name,
    quantity: Number(data.qty),
    qty: Number(data.qty),
    isDone: Boolean(data.checked),
    checked: Boolean(data.checked),
    price: data.price !== null ? Number(data.price) : undefined,
  };
}

export async function toggleItemChecked(itemId: string, currentStatus: boolean): Promise<boolean> {
  const nextStatus = !currentStatus;
  const { error } = await supabase
    .from('list_items')
    .update({ checked: nextStatus })
    .eq('id', itemId);

  if (error) throw error;
  return nextStatus;
}

export async function deleteListItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

export async function getSavedBaskets(): Promise<SavedBasketData[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { data: baskets, error: basketError } = await supabase
    .from('saved_baskets')
    .select('*')
    .eq('user_id', user.id);

  if (basketError) throw basketError;

  const basketIds: string[] = (baskets ?? []).map((b: any) => b.id as string);

  const { data: items, error: itemsError } = await supabase
    .from('saved_basket_items')
    .select('basket_id, qty')
    .in('basket_id', basketIds.length > 0 ? basketIds : ['00000000-0000-0000-0000-000000000000']);

  if (itemsError) throw itemsError;

  const { data: collaborators, error: collabError } = await supabase
    .from('basket_collaborators')
    .select('basket_id, user_id')
    .in('basket_id', basketIds.length > 0 ? basketIds : ['00000000-0000-0000-0000-000000000000']);

  if (collabError) throw collabError;

  return (baskets ?? []).map((b: any) => {
    const basketItems = (items ?? []).filter((it: any) => it.basket_id === b.id);
    const basketCollabs = (collaborators ?? []).filter((c: any) => c.basket_id === b.id);

    return {
      id: b.id,
      userId: b.user_id,
      name: b.name,
      itemCount: basketItems.reduce((sum: number, it: any) => sum + Number(it.qty), 0),
      icon: b.icon,
      isShared: basketCollabs.length > 0,
      collaboratorCount: basketCollabs.length + 1,
      createdAt: b.created_at,
    };
  });
}

interface StoreWithItems {
  id: string;
  name: string;
  chain: any;
  logoUri: string;
  items: Record<string, { price: number; image: string | null }>;
}

export async function optimizeBasket(basketIdOrListId: string): Promise<OptimizationResult> {
  const { data: listItems, error: itemsError } = await supabase
    .from('list_items')
    .select('product_id, qty')
    .eq('list_id', basketIdOrListId)
    .not('product_id', 'is', null);

  if (itemsError) throw itemsError;
  if (!listItems || listItems.length === 0) {
    return {
      totalSavings: 0,
      standardOption: { storeName: 'Aucun magasin', total: 0 },
      optimizedOption: { storeCount: 0, total: 0, breakdown: [] }
    };
  }

  const productIds: string[] = Array.from(
    new Set(listItems.map((item: any) => item.product_id as string))
  );

  const quantities: Record<string, number> = {};
  listItems.forEach((item: any) => {
    const pId: string = item.product_id;
    quantities[pId] = (quantities[pId] || 0) + Number(item.qty);
  });

  const { data: priceRows, error: pricesError } = await supabase
    .from('best_prices_per_product')
    .select('*')
    .in('product_id', productIds);

  if (pricesError) throw pricesError;

  const storeMap: Record<string, StoreWithItems> = {};

  (priceRows || []).forEach((row: any) => {
    const storeId: string = row.store_id;
    const productId: string = row.product_id;

    if (!storeMap[storeId]) {
      storeMap[storeId] = {
        id: storeId,
        name: row.store_name,
        chain: row.chain || 'leclerc',
        logoUri: row.logo_uri || '',
        items: {}
      };
    }
    storeMap[storeId].items[productId] = {
      price: Number(row.price),
      image: row.image_url || null
    };
  });

  const stores: StoreWithItems[] = Object.values(storeMap);
  if (stores.length === 0) {
    throw new Error("Aucun magasin trouvé avec des prix pour ces articles.");
  }

  let bestStandardStore: StoreWithItems = stores[0];
  let lowestStandardTotal = Infinity;

  stores.forEach((store: StoreWithItems) => {
    let currentTotal = 0;
    let missingPenalty = 0;

    productIds.forEach((pId: string) => {
      const qty = quantities[pId];
      if (store.items[pId]) {
        currentTotal += store.items[pId].price * qty;
      } else {
        missingPenalty += 5 * qty;
      }
    });

    const totalWithPenalty = currentTotal + missingPenalty;
    if (totalWithPenalty < lowestStandardTotal) {
      lowestStandardTotal = totalWithPenalty;
      bestStandardStore = store;
    }
  });

  let standardRealTotal = 0;
  productIds.forEach((pId: string) => {
    const qty = quantities[pId];
    standardRealTotal += (bestStandardStore.items[pId]?.price || 3.5) * qty;
  });

  interface ItemDistributionEntry {
    storeId: string;
    storeName: string;
    chain: string;
    logoUri: string;
    subtotal: number;
    count: number;
    thumbs: string[];
  }

  const itemDistribution: Record<string, ItemDistributionEntry> = {};

  productIds.forEach((pId: string) => {
    const qty = quantities[pId];
    let bestProductStore: StoreWithItems = bestStandardStore;
    let minProductPrice = bestStandardStore.items[pId]?.price ?? Infinity;

    stores.forEach((store: StoreWithItems) => {
      if (store.items[pId] && store.items[pId].price < minProductPrice) {
        minProductPrice = store.items[pId].price;
        bestProductStore = store;
      }
    });

    const finalPrice = bestProductStore.items[pId]?.price || 0;
    const finalImage = bestProductStore.items[pId]?.image || '';

    if (!itemDistribution[bestProductStore.id]) {
      itemDistribution[bestProductStore.id] = {
        storeId: bestProductStore.id,
        storeName: bestProductStore.name,
        chain: bestProductStore.chain,
        logoUri: bestProductStore.logoUri,
        subtotal: 0,
        count: 0,
        thumbs: []
      };
    }

    itemDistribution[bestProductStore.id].subtotal += finalPrice * qty;
    itemDistribution[bestProductStore.id].count += 1;
    if (finalImage && itemDistribution[bestProductStore.id].thumbs.length < 3) {
      itemDistribution[bestProductStore.id].thumbs.push(finalImage);
    }
  });

  const breakdown = Object.values(itemDistribution)
    .map((b: ItemDistributionEntry) => ({
      storeId: b.storeId,
      storeName: b.storeName,
      logoUri: b.logoUri,
      itemCount: b.count,
      distanceKm: 1.5,
      subtotal: b.subtotal,
      thumbnails: b.thumbs
    }))
    .sort((a, b) => b.subtotal - a.subtotal);

  const malinTotal = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  const totalSavings = Math.max(0, standardRealTotal - malinTotal);

  return {
    totalSavings,
    standardOption: {
      storeName: bestStandardStore.name,
      total: standardRealTotal
    },
    optimizedOption: {
      storeCount: breakdown.length,
      total: malinTotal,
      breakdown
    }
  };
}

export async function getCommunityFeed(): Promise<CommunityActivityItem[]> {
  const { data, error } = await supabase
    .from('community_activity')
    .select('*, users_profiles(display_name, avatar_url), products(name)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.users_profiles?.display_name ?? 'Anonyme',
    avatarUri: row.users_profiles?.avatar_url ?? '',
    avatarUrl: row.users_profiles?.avatar_url ?? '',
    type: row.type as any,
    message: row.message,
    timestamp: row.created_at ?? new Date().toISOString(),
    timeAgo: 'Récemment',
    usefulCount: row.useful_count ?? 0,
    proof: row.proof_image_url ? {
      imageUri: row.proof_image_url,
      imageUrl: row.proof_image_url,
      productName: row.products?.name ?? 'Produit',
      verifiedAt: row.created_at
    } : undefined,
    priceDropBadge: row.price_drop_badge ?? undefined
  }));
}

export async function getLeaderboard(scope: 'friends' | 'city' | 'france'): Promise<LeaderboardEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  let query = supabase.from('users_profiles').select('*').order('total_savings', { ascending: false });

  if (scope === 'friends') {
    const { data: followedData } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', user.id);

    const targetIds: string[] = (followedData ?? []).map((f: any) => f.followed_id as string).concat(user.id);
    query = query.in('id', targetIds);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  const rows = data ?? [];

  // Batch-fetch le nombre de promotions par utilisateur
  const userIds = rows.map((r: any) => r.id as string);
  let contribMap = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: promos } = await supabase
      .from('promotions')
      .select('user_id')
      .in('user_id', userIds);
    for (const p of (promos ?? [])) {
      const uid = p.user_id as string;
      contribMap.set(uid, (contribMap.get(uid) ?? 0) + 1);
    }
  }

  return rows.map((row: any, index: number) => ({
    rank: index + 1,
    userId: row.id,
    name: row.display_name,
    avatarUri: row.avatar_url ?? '',
    avatarUrl: row.avatar_url ?? '',
    totalSavings: Number(row.total_savings),
    savings: Number(row.total_savings),
    contributionCount: contribMap.get(row.id) ?? 0,
    isCurrentUser: row.id === user.id,
    isMe: row.id === user.id,
  }));
}

export async function getMyProfile(): Promise<UserProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { data, error } = await supabase
    .from('users_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      id: user.id,
      email: user.email ?? '',
      displayName: 'Chasseur de Primes',
      avatarUrl: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plan: 'free',
      totalSavings: 0,
      totalPoints: 0,
      sentinelLevel: 1,
      referralCode: 'TEMP',
      invitedCount: 0,
      ambassadorGoal: 500,
      onboardingCompleted: false,
      dailyCalorieGoal: undefined,
      allergies: [],
      dietType: 'none',
      transportMode: 'car_thermal',
      maxShoppingTimeMinutes: undefined,
      monthlyBudget: undefined,
    };
  }

  return {
    id: data.id,
    email: data.email ?? user.email ?? '',
    displayName: data.display_name ?? 'Chasseur de Primes',
    avatarUrl: data.avatar_url,
    createdAt: data.created_at ?? new Date().toISOString(),
    updatedAt: data.updated_at ?? new Date().toISOString(),
    plan: data.plan as any,
    totalSavings: Number(data.total_savings ?? 0),
    totalPoints: data.total_points ?? 0,
    sentinelLevel: data.sentinel_level ?? 1,
    referralCode: data.referral_code ?? 'TEMP',
    invitedCount: data.invited_count ?? 0,
    ambassadorGoal: data.ambassador_goal ?? 500,
    onboardingCompleted: Boolean(data.onboarding_completed),
    dailyCalorieGoal: data.daily_calorie_goal ?? undefined,
    allergies: data.allergies ?? [],
    dietType: data.diet_type ?? 'none',
    transportMode: data.transport_mode ?? 'car_thermal',
    maxShoppingTimeMinutes: data.max_shopping_time_minutes ?? undefined,
    monthlyBudget: data.monthly_budget !== null && data.monthly_budget !== undefined ? Number(data.monthly_budget) : undefined,
  };
}

export async function completeOnboarding(input: OnboardingProfileInput): Promise<UserProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { data, error } = await supabase
    .from('users_profiles')
    .update({
      onboarding_completed: true,
      daily_calorie_goal: input.dailyCalorieGoal ?? null,
      allergies: input.allergies,
      diet_type: input.dietType,
      transport_mode: input.transportMode,
      max_shopping_time_minutes: input.maxShoppingTimeMinutes ?? null,
      monthly_budget: input.monthlyBudget ?? null,
    })
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    email: data.email ?? user.email ?? '',
    displayName: data.display_name ?? 'Chasseur de Primes',
    avatarUrl: data.avatar_url,
    createdAt: data.created_at ?? new Date().toISOString(),
    updatedAt: data.updated_at ?? new Date().toISOString(),
    plan: data.plan as any,
    totalSavings: Number(data.total_savings ?? 0),
    totalPoints: data.total_points ?? 0,
    sentinelLevel: data.sentinel_level ?? 1,
    referralCode: data.referral_code ?? 'TEMP',
    invitedCount: data.invited_count ?? 0,
    ambassadorGoal: data.ambassador_goal ?? 500,
    onboardingCompleted: Boolean(data.onboarding_completed),
    dailyCalorieGoal: data.daily_calorie_goal ?? undefined,
    allergies: data.allergies ?? [],
    dietType: data.diet_type ?? 'none',
    transportMode: data.transport_mode ?? 'car_thermal',
    maxShoppingTimeMinutes: data.max_shopping_time_minutes ?? undefined,
    monthlyBudget: data.monthly_budget !== null && data.monthly_budget !== undefined ? Number(data.monthly_budget) : undefined,
  };
}

export async function getEvent(eventId: string): Promise<EventData | null> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (eventError || !event) return null;

  const { data: participants, error: partError } = await supabase
    .from('event_participants')
    .select('*')
    .eq('event_id', eventId);

  if (partError) throw partError;

  const { data: items, error: itemsError } = await supabase
    .from('event_items')
    .select('*')
    .eq('event_id', eventId);

  if (itemsError) throw itemsError;

  const mappedItems = (items ?? []).map((it: any) => ({
    id: it.id,
    name: it.name,
    purchased: it.purchased,
    pricePaid: it.price_paid ? Number(it.price_paid) : undefined,
    proofImageUri: it.proof_image_url ?? undefined
  }));

  const total = mappedItems.reduce((sum, item) => sum + (item.pricePaid ?? 0), 0);
  const totalParticipants = (participants ?? []).length || 1;
  const standardShare = total / totalParticipants;

  const paidAmounts: Record<string, number> = {};
  (participants ?? []).forEach((p: any) => {
    const key: string = p.user_id || p.id;
    paidAmounts[key] = 0;
  });

  (items ?? []).forEach((it: any) => {
    if (it.purchased && it.purchased_by && it.price_paid) {
      const key: string = it.purchased_by;
      paidAmounts[key] = (paidAmounts[key] || 0) + Number(it.price_paid);
    }
  });

  const calculatedBalances = (participants ?? []).map((p: any) => {
    const uId: string = p.user_id || p.id;
    const totalPaidByMe = paidAmounts[uId] || 0;
    return {
      name: p.name,
      paid: totalPaidByMe,
      balance: totalPaidByMe - standardShare
    };
  });

  return {
    id: event.id,
    name: event.name,
    status: event.status as any,
    participants: (participants ?? []).map((p: any) => ({
      userId: p.user_id ?? p.id,
      name: p.name,
      avatarUri: p.avatar_url
    })),
    items: mappedItems,
    balances: calculatedBalances,
    total
  };
}

export async function addEventItem(eventId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('event_items')
    .insert([{ event_id: eventId, name, purchased: false }]);
  if (error) throw error;
}

export async function markItemPurchased(itemId: string, pricePaid: number, proofUri?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('event_items')
    .update({
      purchased: true,
      price_paid: pricePaid,
      proof_image_url: proofUri,
      purchased_by: user?.id ?? null
    })
    .eq('id', itemId);
  if (error) throw error;
}

export async function settleEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ status: 'settled' })
    .eq('id', eventId);
  if (error) throw error;
}

// ─── Listes ──────────────────────────────────────────────────────────────────

export async function deleteShoppingList(listId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');
  const { error } = await supabase
    .from('shopping_lists')
    .delete()
    .eq('id', listId)
    .eq('user_id', user.id);
  if (error) throw error;
}

// ─── Promos communautaires ───────────────────────────────────────────────────

export interface PromoInput {
  productName: string;
  ean?: string;
  originalPrice: number;
  promoPrice: number;
  storeName: string;
  proofImageUri?: string;
}

export async function publishPromo(input: PromoInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const savings = input.originalPrice - input.promoPrice;
  const percent = Math.round((savings / input.originalPrice) * 100);
  const promoStr = input.promoPrice.toFixed(2).replace('.', ',');
  const origStr = input.originalPrice.toFixed(2).replace('.', ',');
  const message = `${input.productName} à ${promoStr} € chez ${input.storeName} (au lieu de ${origStr} €)`;

  let productId: string | null = null;
  if (input.ean?.trim()) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('ean', input.ean.trim())
      .maybeSingle();
    productId = product?.id ?? null;
  }

  const { error } = await supabase.from('community_activity').insert([{
    user_id: user.id,
    type: 'price_reported',
    message,
    related_product_id: productId,
    proof_image_url: input.proofImageUri ?? null,
    price_drop_badge: `-${percent}%`,
  }]);
  if (error) throw error;
}

// ─── Promotions communautaires (table dédiée) ────────────────────────────────

export interface CreatePromotionInput {
  productName: string;
  ean?: string;
  storeName: string;
  storeId?: string;
  originalPrice: number;
  promoPrice: number;
  /** URI locale (file://) — l'upload Supabase Storage peut être ajouté ultérieurement */
  proofImageUri?: string;
}

export async function createPromotion(input: CreatePromotionInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  let productId: string | null = null;
  if (input.ean?.trim()) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('ean', input.ean.trim())
      .maybeSingle();
    productId = product?.id ?? null;
  }

  let storeId: string | null = input.storeId ?? null;
  if (!storeId && input.storeName) {
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .ilike('name', `%${input.storeName}%`)
      .maybeSingle();
    storeId = store?.id ?? null;
  }

  const { error } = await supabase.from('promotions').insert([{
    user_id: user.id,
    product_name: input.productName,
    ean: input.ean?.trim() || null,
    product_id: productId,
    store_name: input.storeName,
    store_id: storeId,
    original_price: input.originalPrice,
    promo_price: input.promoPrice,
    proof_image_url: input.proofImageUri ?? null,
  }]);
  if (error) throw error;
}

// ─── Flux de promotions communautaires ───────────────────────────────────────

export interface PromotionFeedItem {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string | null;
  productName: string;
  ean: string | null;
  storeName: string;
  originalPrice: number;
  promoPrice: number;
  discountPercent: number;
  proofImageUrl: string | null;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  votesCount: number;
  hasUserVoted: boolean;
}

// ─── Filtres optionnels pour le flux de promotions ───────────────────────────

export interface PromotionFilters {
  query?:            string;    // recherche texte sur nom produit / magasin
  category?:         string;    // 'Tout' | 'Alimentation' | 'Hygiène' | 'Boissons' | 'Bazar' | 'Animaux'
  favoriteStoreIds?: string[];  // filtrage côté serveur sur store_id
  page?:             number;    // pagination (0-indexed) — 20 items par page
}

export const PROMOTIONS_PAGE_SIZE = 20;

// Mots-clés par catégorie pour le filtrage client (product_name)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentation': ['nutella', 'yaourt', 'fromage', 'beurre', 'lait', 'chocolat', 'biscuit', 'pain', 'céréal', 'conserve', 'fruit', 'légume', 'viande', 'poisson', 'poulet', 'pasta', 'riz', 'soupe', 'sauce', 'confiture', 'miel', 'sucre', 'farine'],
  'Hygiène':      ['shampoing', 'gel douche', 'dentifrice', 'savon', 'déodorant', 'rasoir', 'crème', 'serviette', 'coton', 'mouchoir', 'hygiène', 'lingette'],
  'Boissons':     ['jus', 'eau', 'coca', 'soda', 'bière', 'vin', 'café', 'thé', 'boisson', 'limonade', 'ice tea', 'monster', 'redbull'],
  'Bazar':        ['casserole', 'ustensile', 'batterie', 'poêle', 'vaisselle', 'pile', 'ampoule', 'papier', 'aspirateur', 'éponge'],
  'Animaux':      ['croquette', 'chat', 'chien', 'litière', 'animal', 'purina', 'whiskas', 'friskies', 'royal canin'],
};

function productMatchesCategory(productName: string, category: string): boolean {
  if (!category || category === 'Tout') return true;
  const kws = CATEGORY_KEYWORDS[category] ?? [];
  const lower = productName.toLowerCase();
  return kws.some((kw) => lower.includes(kw));
}

export async function getLatestPromotions(filters?: PromotionFilters): Promise<PromotionFeedItem[]> {
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('promotions')
    .select('*, users_profiles(display_name, avatar_url)')
    .order('created_at', { ascending: false });

  const page = filters?.page ?? 0;
  const from = page * PROMOTIONS_PAGE_SIZE;
  const to   = from + PROMOTIONS_PAGE_SIZE - 1;
  query = query.range(from, to);

  // Filtrage texte côté serveur sur product_name et store_name
  const term = filters?.query?.trim();
  if (term) {
    query = query.or(`product_name.ilike.%${term}%,store_name.ilike.%${term}%`);
  }

  // Filtrage par magasins favoris côté serveur
  if (filters?.favoriteStoreIds && filters.favoriteStoreIds.length > 0) {
    query = query.in('store_id', filters.favoriteStoreIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filtrage catégorie côté client (keyword matching sur product_name)
  let rows = data ?? [];
  if (filters?.category && filters.category !== 'Tout') {
    rows = rows.filter((r: any) => productMatchesCategory(r.product_name ?? '', filters.category!));
  }

  // Batch-fetch les votes de l'utilisateur courant pour ces promos
  const promoIds = rows.map((r: any) => r.id as string);
  let votedSet = new Set<string>();
  if (user && promoIds.length > 0) {
    const { data: votes } = await supabase
      .from('promotion_votes')
      .select('promo_id')
      .eq('user_id', user.id)
      .in('promo_id', promoIds);
    votedSet = new Set((votes ?? []).map((v: any) => v.promo_id as string));
  }

  return rows.map((row: any): PromotionFeedItem => {
    const orig = parseFloat(row.original_price);
    const promo = parseFloat(row.promo_price);
    const discountPercent = orig > 0 ? Math.round(((orig - promo) / orig) * 100) : 0;
    return {
      id: row.id,
      userId: row.user_id,
      authorName: row.users_profiles?.display_name ?? 'Anonyme',
      authorAvatar: row.users_profiles?.avatar_url ?? null,
      productName: row.product_name,
      ean: row.ean ?? null,
      storeName: row.store_name,
      originalPrice: orig,
      promoPrice: promo,
      discountPercent,
      proofImageUrl: row.proof_image_url ?? null,
      status: row.status as PromotionFeedItem['status'],
      createdAt: row.created_at,
      votesCount: (row.votes_count as number) ?? 0,
      hasUserVoted: votedSet.has(row.id),
    };
  });
}

// ─── Toggle vote "C'est vrai" ─────────────────────────────────────────────────

export interface VoteResult {
  voted: boolean;
  count: number;
}

export async function toggleVotePromotion(promoId: string): Promise<VoteResult> {
  const { data, error } = await supabase.rpc('toggle_promotion_vote', { p_promo_id: promoId });
  if (error) throw error;
  const result = data as { voted: boolean; count: number };
  return { voted: result.voted, count: Number(result.count) };
}

// ─── Statistiques Sentinelle de l'utilisateur courant ─────────────────────────

/** Éclaireur (0-4) → Observateur (5-14) → Expert (15-29) → Élite (30+) */
export type SentinelRank = 'Éclaireur' | 'Observateur' | 'Expert' | 'Élite';

export interface SentinelStats {
  contributionCount: number;
  sentinelRank: SentinelRank;
}

function computeSentinelRank(count: number): SentinelRank {
  if (count >= 30) return 'Élite';
  if (count >= 15) return 'Expert';
  if (count >= 5)  return 'Observateur';
  return 'Éclaireur';
}

export async function getUserSentinelStats(): Promise<SentinelStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { contributionCount: 0, sentinelRank: 'Éclaireur' };

  const { count, error } = await supabase
    .from('promotions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (error) throw error;
  const contributionCount = count ?? 0;
  return { contributionCount, sentinelRank: computeSentinelRank(contributionCount) };
}

// ─── Code de parrainage ───────────────────────────────────────────────────────

function buildReferralCode(userId: string): string {
  const suffix = userId.replace(/-/g, '').slice(-6).toUpperCase();
  return `MALIN-${suffix}`;
}

export async function ensureReferralCode(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const { data } = await supabase
    .from('users_profiles')
    .select('referral_code')
    .eq('id', user.id)
    .maybeSingle();

  const existing = data?.referral_code;
  if (existing && existing !== 'TEMP' && existing !== '') {
    return existing as string;
  }

  const code = buildReferralCode(user.id);
  await supabase
    .from('users_profiles')
    .update({ referral_code: code })
    .eq('id', user.id);

  return code;
}

// ─── Économies utilisateur ────────────────────────────────────────────────────

export async function incrementUserSavings(amountToAdd: number): Promise<void> {
  const { error } = await supabase.rpc('increment_user_savings', { amount: amountToAdd });
  if (error) throw error;
}

// ─── Upload image Supabase Storage ───────────────────────────────────────────

export async function uploadPromoImage(imageUri: string): Promise<string> {
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const ext = (imageUri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase();
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const { data, error } = await supabase.storage
    .from('promo-proofs')
    .upload(fileName, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('promo-proofs')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ─── Magasins favoris ────────────────────────────────────────────────────────

/** Retourne la liste des store_id favoris de l'utilisateur courant. */
export async function getUserFavoriteStores(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('user_favorite_stores')
    .select('store_id')
    .eq('user_id', user.id);

  return (data ?? []).map((r: any) => r.store_id as string);
}

/**
 * Bascule le favori d'un magasin (ajout si absent, suppression si présent).
 * Retourne le nouvel état.
 */
export async function toggleFavoriteStore(storeId: string): Promise<{ isFavorite: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const { data: existing } = await supabase
    .from('user_favorite_stores')
    .select('store_id')
    .eq('user_id', user.id)
    .eq('store_id', storeId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_favorite_stores')
      .delete()
      .eq('user_id', user.id)
      .eq('store_id', storeId);
    return { isFavorite: false };
  }

  await supabase
    .from('user_favorite_stores')
    .insert({ user_id: user.id, store_id: storeId });
  return { isFavorite: true };
}

// ─── Profil utilisateur — édition & avatar ────────────────────────────────────

/** Met à jour le pseudo et/ou l'URL de l'avatar dans users_profiles. */
export async function updateUserProfile(updates: {
  displayName?: string;
  avatarUrl?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const payload: Record<string, string> = {};
  if (updates.displayName !== undefined) payload.display_name = updates.displayName;
  if (updates.avatarUrl   !== undefined) payload.avatar_url   = updates.avatarUrl;
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from('users_profiles')
    .update(payload)
    .eq('id', user.id);

  if (error) throw error;
}

/** Upload un avatar dans le bucket 'avatars' et retourne l'URL publique. */
export async function uploadAvatarImage(imageUri: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const response = await fetch(imageUri);
  const blob = await response.blob();

  const ext = (imageUri.split('?')[0].split('.').pop() ?? 'jpg').toLowerCase();
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  // Chemin : user_id/timestamp.ext — upsert=true remplace l'ancien avatar
  const fileName = `${user.id}/${Date.now()}.${safeExt}`;

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ─── Signalement de promotion ─────────────────────────────────────────────────

const REPORT_REASONS = [
  'Rupture de stock',
  'Prix erroné',
  'Promo périmée',
  'Contenu inapproprié',
] as const;

export type ReportReason = typeof REPORT_REASONS[number];
export { REPORT_REASONS };

export async function reportPromotion(
  promoId: string,
  reason: ReportReason,
  details?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const { error } = await supabase
    .from('promotion_reports')
    .insert({ promotion_id: promoId, user_id: user.id, reason, details });

  if (error && error.code !== '23505') throw error; // ignore unique conflict (déjà signalé)
}

// ─── Détail d'une promotion par ID ────────────────────────────────────────────

export async function getPromoById(id: string): Promise<PromotionFeedItem | null> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('promotions')
    .select('*, users_profiles(display_name, avatar_url)')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  let hasUserVoted = false;
  if (user) {
    const { data: vote } = await supabase
      .from('promotion_votes')
      .select('promo_id')
      .eq('user_id', user.id)
      .eq('promo_id', id)
      .maybeSingle();
    hasUserVoted = vote !== null;
  }

  const row = data as any;
  const orig  = parseFloat(row.original_price);
  const promo = parseFloat(row.promo_price);
  const discountPercent = orig > 0 ? Math.round(((orig - promo) / orig) * 100) : 0;
  return {
    id:             row.id,
    userId:         row.user_id,
    authorName:     row.users_profiles?.display_name ?? 'Anonyme',
    authorAvatar:   row.users_profiles?.avatar_url ?? null,
    productName:    row.product_name,
    ean:            row.ean ?? null,
    storeName:      row.store_name,
    originalPrice:  orig,
    promoPrice:     promo,
    discountPercent,
    proofImageUrl:  row.proof_image_url ?? null,
    status:         row.status as PromotionFeedItem['status'],
    createdAt:      row.created_at,
    votesCount:     (row.votes_count as number) ?? 0,
    hasUserVoted,
  };
}

// ─── Commentaires ─────────────────────────────────────────────────────────────

export interface PromoComment {
  id:           string;
  userId:       string;
  authorName:   string;
  authorAvatar: string | null;
  content:      string;
  createdAt:    string;
}

export async function getComments(promoId: string): Promise<PromoComment[]> {
  const { data, error } = await supabase
    .from('promotion_comments')
    .select('*, users_profiles(display_name, avatar_url)')
    .eq('promotion_id', promoId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any): PromoComment => ({
    id:           row.id,
    userId:       row.user_id,
    authorName:   row.users_profiles?.display_name ?? 'Anonyme',
    authorAvatar: row.users_profiles?.avatar_url ?? null,
    content:      row.content,
    createdAt:    row.created_at,
  }));
}

export async function addComment(promoId: string, content: string): Promise<PromoComment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const { data, error } = await supabase
    .from('promotion_comments')
    .insert({ promotion_id: promoId, user_id: user.id, content: content.trim() })
    .select('*, users_profiles(display_name, avatar_url)')
    .single();

  if (error) throw error;

  const row = data as any;
  return {
    id:           row.id,
    userId:       row.user_id,
    authorName:   row.users_profiles?.display_name ?? 'Anonyme',
    authorAvatar: row.users_profiles?.avatar_url ?? null,
    content:      row.content,
    createdAt:    row.created_at,
  };
}

// ─── Supabase Realtime ────────────────────────────────────────────────────────

export function subscribeToNewPromotions(
  callback: (item: PromotionFeedItem) => void
): () => void {
  const channel = supabase
    .channel('public:promotions:inserts')
    .on(
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'promotions' },
      async (payload: any) => {
        try {
          const item = await getPromoById(payload.new.id);
          if (item) callback(item);
        } catch {
          // ignore — toast is best-effort
        }
      }
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

// ─── MalinCoins ───────────────────────────────────────────────────────────────

export interface MalinCoinVoucher {
  id:          string;
  title:       string;
  description: string;
  costCoins:   number;
  faceValue:   number;  // €
  brand:       string;
  emoji:       string;
  stock:       number;
}

const MOCK_VOUCHERS: MalinCoinVoucher[] = [
  { id: 'v1', title: 'Bon Lidl',        description: "2€ de réduction dès 20€ d'achat",  costCoins: 200,  faceValue: 2,  brand: 'Lidl',      emoji: '🛒', stock: 50 },
  { id: 'v2', title: 'Bon Leclerc',     description: "5€ de réduction dès 40€ d'achat",  costCoins: 450,  faceValue: 5,  brand: 'Leclerc',   emoji: '🏷️', stock: 30 },
  { id: 'v3', title: 'Bon Carrefour',   description: "3€ de réduction dès 30€ d'achat",  costCoins: 300,  faceValue: 3,  brand: 'Carrefour', emoji: '🎯', stock: 40 },
  { id: 'v4', title: 'Bon Intermarché', description: "2€ offerts sans minimum",                    costCoins: 250,  faceValue: 2,  brand: 'ITM',       emoji: '🐯', stock: 25 },
  { id: 'v5', title: 'Super Bon',       description: "10€ de réduction dès 80€ d'achat", costCoins: 900, faceValue: 10, brand: 'Multi',     emoji: '⭐', stock: 10 },
  { id: 'v6', title: 'Eco-Bon',         description: "1€ remboursé sur tout produit bio",          costCoins: 100,  faceValue: 1,  brand: 'Bio',       emoji: '🌱', stock: 100 },
];

export async function getMalinCoinsBalance(): Promise<{ coins: number; vouchers: MalinCoinVoucher[] }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { coins: 0, vouchers: MOCK_VOUCHERS };

    // Solde dynamique : (contributions × 15) + (votes reçus × 5) - coins dépensés
    const [{ data: promos }, { data: spent }] = await Promise.all([
      supabase.from('promotions').select('id, votes_count').eq('user_id', user.id),
      supabase.from('user_vouchers').select('coins_spent').eq('user_id', user.id),
    ]);

    const contributions  = (promos ?? []).length;
    const votesReceived  = (promos ?? []).reduce((s: number, p: any) => s + (Number(p.votes_count) || 0), 0);
    const earnedCoins    = contributions * 15 + votesReceived * 5;
    const spentCoins     = (spent ?? []).reduce((s: number, r: any) => s + (Number(r.coins_spent) || 0), 0);
    const coins          = Math.max(0, earnedCoins - spentCoins);

    return { coins, vouchers: MOCK_VOUCHERS };
  } catch {
    return { coins: 350, vouchers: MOCK_VOUCHERS };
  }
}

export async function redeemVoucher(voucher: MalinCoinVoucher): Promise<import('../types').PurchasedVoucher> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const barcodeCode = `PM${voucher.brand.slice(0, 3).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
  const expiresAt   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('user_vouchers')
    .insert({
      user_id:            user.id,
      voucher_id:         voucher.id,
      voucher_title:      voucher.title,
      voucher_face_value: voucher.faceValue,
      voucher_brand:      voucher.brand,
      voucher_emoji:      voucher.emoji,
      barcode_code:       barcodeCode,
      coins_spent:        voucher.costCoins,
      expires_at:         expiresAt,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id:          (data as any).id,
    voucherId:   voucher.id,
    title:       voucher.title,
    brand:       voucher.brand,
    emoji:       voucher.emoji,
    faceValue:   voucher.faceValue,
    costCoins:   voucher.costCoins,
    barcodeCode,
    purchasedAt: (data as any).purchased_at,
    expiresAt,
    used:        false,
  };
}

export async function getUserVouchers(): Promise<import('../types').PurchasedVoucher[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_vouchers')
    .select('*')
    .eq('user_id', user.id)
    .order('purchased_at', { ascending: false });

  if (error) return [];

  return (data ?? []).map((row: any): import('../types').PurchasedVoucher => ({
    id:          row.id,
    voucherId:   row.voucher_id,
    title:       row.voucher_title,
    brand:       row.voucher_brand,
    emoji:       row.voucher_emoji ?? '🎟️',
    faceValue:   parseFloat(row.voucher_face_value),
    costCoins:   row.coins_spent,
    barcodeCode: row.barcode_code,
    purchasedAt: row.purchased_at,
    expiresAt:   row.expires_at,
    used:        row.used ?? false,
  }));
}

// ─── Conformité stores : gestion du compte ────────────────────────────────────

export async function clearLocalData(): Promise<void> {
  // Appelé depuis SettingsScreen — délègue à AsyncStorage (import côté écran)
}

export async function deleteAccount(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  // Anonymise le profil (RGPD) puis supprime la session
  await supabase
    .from('users_profiles')
    .update({
      display_name: `Compte supprimé ${user.id.slice(0, 6)}`,
      avatar_url:   null,
      malin_coins:  0,
    })
    .eq('id', user.id);

  await supabase.auth.signOut();
}

// ─── Incrémentation MalinCoins (OCR reward) ───────────────────────────────────

export async function awardMalinCoins(amount: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc('increment_malin_coins', { p_user_id: user.id, p_amount: amount });
}

// ─── Parrainage ───────────────────────────────────────────────────────────────

// ─── Tableau de bord statistiques ────────────────────────────────────────────

export interface WeeklySaving {
  label:   string;
  savings: number;
}

export interface StoreSaving {
  storeName:  string;
  savings:    number;
  percentage: number;
}

export interface DashboardStats {
  totalSavings:       number;
  contributionCount:  number;
  avgDiscountPercent: number;
  weeklyData:         WeeklySaving[];
  storeBreakdown:     StoreSaving[];
}

interface RawPromo {
  original_price: number | null;
  promo_price:    number | null;
  store_name:     string | null;
  created_at:     string;
}

export async function getUserDashboardStats(): Promise<DashboardStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non connecté');

  const [promoRes, profileRes] = await Promise.all([
    supabase
      .from('promotions')
      .select('original_price, promo_price, store_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('users_profiles')
      .select('total_savings')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const items = (promoRes.data ?? []) as RawPromo[];
  const totalSavings = (profileRes.data as { total_savings: number } | null)?.total_savings ?? 0;
  const contributionCount = items.length;

  // ── Remise moyenne ────────────────────────────────────────────────────────
  const discounts = items
    .filter((p) => (p.original_price ?? 0) > 0)
    .map((p) => (((p.original_price ?? 0) - (p.promo_price ?? 0)) / (p.original_price ?? 1)) * 100);
  const avgDiscountPercent =
    discounts.length > 0 ? discounts.reduce((a, b) => a + b, 0) / discounts.length : 0;

  // ── Économies par semaine (4 dernières semaines) ──────────────────────────
  const now = new Date();
  const weeklyData: WeeklySaving[] = Array.from({ length: 4 }, (_, i): WeeklySaving => {
    const offset    = (3 - i) * 7;
    const weekEnd   = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekSavings = items
      .filter((p) => {
        const d = new Date(p.created_at);
        return d >= weekStart && d < weekEnd;
      })
      .reduce((sum, p) => sum + Math.max(0, (p.original_price ?? 0) - (p.promo_price ?? 0)), 0);

    return { label: i === 3 ? 'Cette sem.' : `S-${3 - i}`, savings: weekSavings };
  });

  // ── Répartition par enseigne (top 5) ─────────────────────────────────────
  const storeMap = new Map<string, number>();
  items.forEach((p) => {
    const name    = p.store_name?.trim() || 'Autre';
    const saving  = Math.max(0, (p.original_price ?? 0) - (p.promo_price ?? 0));
    storeMap.set(name, (storeMap.get(name) ?? 0) + saving);
  });

  const sorted       = [...storeMap.entries()].sort(([, a], [, b]) => b - a).slice(0, 5);
  const maxSaving    = sorted[0]?.[1] ?? 1;
  const storeBreakdown: StoreSaving[] = sorted.map(([storeName, savings]) => ({
    storeName,
    savings,
    percentage: (savings / maxSaving) * 100,
  }));

  return { totalSavings, contributionCount, avgDiscountPercent, weeklyData, storeBreakdown };
}

// ─── Parrainage ───────────────────────────────────────────────────────────────

export async function applyReferralCode(
  code: string,
): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('apply_referral_code', {
    p_code: code.trim().toUpperCase(),
  });

  if (error) {
    return { success: false, message: error.message ?? 'Erreur réseau, réessaie.' };
  }

  const result = data as { success: boolean; message: string } | null;
  return result ?? { success: false, message: 'Réponse inattendue du serveur.' };
}

// ─── Leaderboard Sentinelles (RPC) ────────────────────────────────────────────

export interface SentinelEntry {
  rank:         number;
  userId:       string;
  displayName:  string;
  avatarUrl:    string | null;
  malinCoins:   number;
  totalSavings: number;
  isMe:         boolean;
}

export async function getTopSentinels(limit = 10): Promise<SentinelEntry[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const myId = user?.id ?? null;

    const { data, error } = await supabase.rpc('get_top_sentinels', { p_limit: limit });
    if (error || !data) return [];

    return (data as {
      rank: number; user_id: string; display_name: string;
      avatar_url: string | null; malin_coins: number; total_savings: number;
    }[]).map((row) => ({
      rank:         Number(row.rank),
      userId:       row.user_id,
      displayName:  row.display_name ?? 'Utilisateur',
      avatarUrl:    row.avatar_url,
      malinCoins:   Number(row.malin_coins ?? 0),
      totalSavings: Number(row.total_savings ?? 0),
      isMe:         row.user_id === myId,
    }));
  } catch {
    return [];
  }
}

export async function getMyRank(): Promise<number | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.rpc('get_my_sentinel_rank', { p_user_id: user.id });
    if (error || data == null) return null;
    return Number(data);
  } catch {
    return null;
  }
}