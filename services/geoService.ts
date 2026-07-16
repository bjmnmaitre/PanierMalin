/**
 * geoService.ts — Chargement intelligent de magasins selon le niveau de zoom
 *
 * Trois niveaux (tiers) de détail, déterminés par le latitudeDelta de la région :
 *   LOINTAIN  (latDelta > 0.5)  → tier 1 + sponsored via Supabase
 *   MOYEN     (0.15 < delta ≤ 0.5) → tier 1+2 + sponsored via Supabase
 *   PROCHE    (delta ≤ 0.15)   → tous tiers Supabase + complément OSM Overpass
 *
 * Les stores OSM découverts en zoom proche sont mis en cache dans Supabase
 * de façon asynchrone (appel RPC upsert_osm_stores), sans bloquer l'UI.
 */

import { apiClient } from './api/client';

const supabase = apiClient.getSupabase();

// ─── Types publics ────────────────────────────────────────────────────────────

export interface BoundingBox {
  north: number;
  south: number;
  east:  number;
  west:  number;
}

/** Store enrichi : étend le Store de base avec les champs Pro/Ads */
export interface GeoStore {
  id:                 string;
  name:               string;
  brand:              string;
  address:            string;
  latitude:           number;
  longitude:          number;
  hours:              string;
  tier:               number;
  is_sponsored:       boolean;
  sponsor_banner_url: string | null;
  owner_id:           string | null;
}

// ─── Types internes OSM ───────────────────────────────────────────────────────

interface OsmTags {
  name?:            string;
  brand?:           string;
  shop?:            string;
  'addr:street'?:   string;
  'addr:housenumber'?: string;
  'addr:city'?:     string;
  opening_hours?:   string;
}

interface OsmElement {
  type:   'node' | 'way' | 'relation';
  id:     number;
  lat?:   number;
  lon?:   number;
  center?: { lat: number; lon: number };
  tags?:  OsmTags;
}

interface OverpassResponse {
  elements: OsmElement[];
}

// ─── Mapping enseigne OSM → brand PanierMalin ─────────────────────────────────

const BRAND_ALIASES: Record<string, string> = {
  'e.leclerc': 'Leclerc',
  'leclerc':   'Leclerc',
  'lidl':      'Lidl',
  'carrefour': 'Carrefour',
  'intermarché': 'Intermarché',
  'intermarche': 'Intermarché',
  'aldi':      'Aldi',
  'auchan':    'Auchan',
  'super u':   'Super U',
  'systeme u': 'Super U',
  'monoprix':  'Monoprix',
  'casino':    'Casino',
  'franprix':  'Franprix',
};

function normalizeBrand(raw?: string): string {
  if (!raw) return '';
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(BRAND_ALIASES)) {
    if (lower.includes(key)) return val;
  }
  return raw.trim();
}

function osmShopToTier(shopType?: string): number {
  switch (shopType) {
    case 'supermarket':
    case 'hypermarket':
      return 2;
    case 'convenience':
    case 'bakery':
    case 'butcher':
    case 'greengrocer':
    case 'deli':
    case 'frozen_food':
      return 3;
    default:
      return 3;
  }
}

// ─── Requête Supabase par bounding box ───────────────────────────────────────

async function fetchSupabaseStores(bb: BoundingBox, maxTier: number): Promise<GeoStore[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, brand, address, latitude, longitude, hours, tier, is_sponsored, sponsor_banner_url, owner_id')
    .gte('latitude',  bb.south)
    .lte('latitude',  bb.north)
    .gte('longitude', bb.west)
    .lte('longitude', bb.east)
    .or(`tier.lte.${maxTier},is_sponsored.eq.true`);

  if (error || !data) return [];
  return data as GeoStore[];
}

// ─── Requête OSM Overpass ─────────────────────────────────────────────────────

const OSM_SHOP_FILTER = 'supermarket|hypermarket|convenience|bakery|butcher|greengrocer|deli|frozen_food';
const OVERPASS_URL    = 'https://overpass-api.de/api/interpreter';

async function fetchOsmStores(bb: BoundingBox): Promise<GeoStore[]> {
  const query = `[out:json][timeout:15];(node["shop"~"${OSM_SHOP_FILTER}"](${bb.south},${bb.west},${bb.north},${bb.east});way["shop"~"supermarket|hypermarket"](${bb.south},${bb.west},${bb.north},${bb.east}););out center;`;

  const resp = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!resp.ok) throw new Error(`OSM ${resp.status}`);

  const json: OverpassResponse = await resp.json();

  return json.elements
    .filter((el) => {
      if (el.type === 'node')   return typeof el.lat === 'number' && typeof el.lon === 'number';
      if (el.type === 'way')    return !!el.center;
      return false;
    })
    .map((el): GeoStore => {
      const lat  = el.type === 'node' ? el.lat! : el.center!.lat;
      const lon  = el.type === 'node' ? el.lon! : el.center!.lon;
      const tags = el.tags ?? {};

      const street  = tags['addr:street'] ?? '';
      const num     = tags['addr:housenumber'] ?? '';
      const address = [num, street].filter(Boolean).join(' ') || tags['addr:city'] || '';

      return {
        id:                 `osm:${el.type}:${el.id}`,
        name:               tags.name ?? 'Commerce local',
        brand:              normalizeBrand(tags.brand ?? tags.name),
        address,
        latitude:           lat,
        longitude:          lon,
        hours:              tags.opening_hours ?? '',
        tier:               osmShopToTier(tags.shop),
        is_sponsored:       false,
        sponsor_banner_url: null,
        owner_id:           null,
      };
    });
}

// ─── Cache OSM → Supabase (arrière-plan, sans bloquer) ───────────────────────

function cacheOsmStores(stores: GeoStore[]): void {
  if (stores.length === 0) return;

  const payload = stores.map((s) => ({
    id:        s.id,
    name:      s.name,
    brand:     s.brand,
    address:   s.address,
    latitude:  s.latitude,
    longitude: s.longitude,
    hours:     s.hours,
    tier:      s.tier,
  }));

  supabase.rpc('upsert_osm_stores', { stores_json: payload })
    .then(({ error }) => {
      if (error) console.warn('[geoService] cache upsert failed', error.message);
    });
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Renvoie les magasins présents dans la bounding box en fonction du niveau de zoom.
 *
 * @param bb        Bounding box de la région affichée
 * @param latDelta  latitudeDelta de la région (proxy du niveau de zoom)
 */
export async function getStoresInRegion(bb: BoundingBox, latDelta: number): Promise<GeoStore[]> {
  // ── LOINTAIN : France / grande région ─────────────────────────────────────
  if (latDelta > 0.5) {
    return fetchSupabaseStores(bb, 1);
  }

  // ── MOYEN : Ville / agglomération ─────────────────────────────────────────
  if (latDelta > 0.15) {
    return fetchSupabaseStores(bb, 2);
  }

  // ── PROCHE : Quartier ─────────────────────────────────────────────────────
  // On parallélise Supabase + OSM pour un chargement maximal.
  const [supabaseStores, osmStores] = await Promise.all([
    fetchSupabaseStores(bb, 3),
    fetchOsmStores(bb).catch((): GeoStore[] => []),  // OSM gracieux : on continue sans lui si timeout
  ]);

  // Fusion : les stores Supabase ont priorité (données enrichies, sponsoring)
  const supabaseIds = new Set(supabaseStores.map((s) => s.id));
  const newOsmStores = osmStores.filter((s) => !supabaseIds.has(s.id));

  // Cache silencieux en arrière-plan
  cacheOsmStores(newOsmStores);

  return [...supabaseStores, ...newOsmStores];
}
