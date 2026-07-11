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
    proofImageUrl: row.proof_image_url,
    isVerified: row.is_verified,
    verifiedAt: row.verified_at,
    storeName: row.store_name,
    chain: row.chain,
    logoUri: row.logo_uri,
    lat: row.lat !== null ? Number(row.lat) : null,
    lng: row.lng !== null ? Number(row.lng) : null,
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
  photoUri: string
): Promise<{ pointsEarned: number; isFirstToday: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Aucun utilisateur connecté.');

  const { error: priceError } = await supabase
    .from('prices')
    .insert([{
      product_id: productId,
      store_id: storeId,
      price: 0,
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

  return (data ?? []).map((row: any, index: number) => ({
    rank: index + 1,
    userId: row.id,
    name: row.display_name,
    avatarUri: row.avatar_url ?? '',
    avatarUrl: row.avatar_url ?? '',
    totalSavings: Number(row.total_savings),
    savings: Number(row.total_savings),
    isCurrentUser: row.id === user.id,
    isMe: row.id === user.id
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