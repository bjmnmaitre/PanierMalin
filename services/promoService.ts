import * as ImagePicker from 'expo-image-picker';
import { apiClient } from './api/client';
import { createPromotion } from './api';
import { estimateBasePrice } from './inventoryService';

const supabase = apiClient.getSupabase();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromoReport {
  id?: string;
  created_at?: string;
  productName: string;
  ean: string;
  storeName: string;
  storeId?: string;
  originalPrice: number;
  promoPrice: number;
  category: string;
}

export type PublishResult =
  | { ok: true }
  | { ok: false; reason: 'duplicate'; storeName: string; ean: string }
  | { ok: false; reason: 'error'; message: string };

// ─── Détection des doublons ───────────────────────────────────────────────────

async function hasDuplicateWithin24h(ean: string, storeName: string): Promise<boolean> {
  if (!ean.trim()) return false;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('promotions')
    .select('id')
    .eq('ean', ean.trim())
    .ilike('store_name', storeName.trim())
    .gte('created_at', since)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

// ─── Publication ──────────────────────────────────────────────────────────────

export async function publishPromoReport(
  report: Omit<PromoReport, 'id' | 'created_at'>
): Promise<PublishResult> {
  try {
    if (report.ean.trim()) {
      const duplicate = await hasDuplicateWithin24h(report.ean, report.storeName);
      if (duplicate) {
        return { ok: false, reason: 'duplicate', storeName: report.storeName, ean: report.ean };
      }
    }

    await createPromotion({
      productName: report.productName,
      ean: report.ean.trim() || undefined,
      storeName: report.storeName,
      storeId: report.storeId?.startsWith('fallback-') ? undefined : report.storeId,
      originalPrice: report.originalPrice,
      promoPrice: report.promoPrice,
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return { ok: false, reason: 'error', message };
  }
}

// ─── Affichage : type unifié pour ImmanquablesScreen ─────────────────────────

export interface PromoItem {
  id:                string;
  name:              string;
  brand:             string;
  store:             string;
  discount:          number;
  originalPrice:     number;
  currentPrice:      number;
  imageUrl?:         string;
  source:            'community' | 'catalogue';
  verifiedCount:     number;
  category:          string;
  expiresAt?:        string;
  ean?:              string;
  storeInventoryId?: string;
}

// ─── Offres nationales catalogues ─────────────────────────────────────────────

export function getNationalPromos(): PromoItem[] {
  const today = new Date();
  const expire = (days: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  return [
    { id: 'nat-01', name: 'Café Carte Noire 250g',       brand: 'Carte Noire', store: 'Leclerc',     discount: 34, originalPrice: 5.49,  currentPrice: 3.62,  source: 'catalogue', verifiedCount: 312, category: 'Boissons',       expiresAt: expire(4) },
    { id: 'nat-02', name: 'Couches Pampers T4 x44',      brand: 'Pampers',     store: 'Carrefour',   discount: 33, originalPrice: 17.99, currentPrice: 11.99, source: 'catalogue', verifiedCount: 189, category: 'Bébé',           expiresAt: expire(6) },
    { id: 'nat-03', name: 'Nutella 950g',                 brand: 'Ferrero',     store: 'Intermarché', discount: 28, originalPrice: 8.20,  currentPrice: 5.90,  source: 'catalogue', verifiedCount: 445, category: 'Épicerie sucrée',expiresAt: expire(3) },
    { id: 'nat-04', name: "Huile d'olive Puget 1L",       brand: 'Puget',       store: 'Auchan',      discount: 22, originalPrice: 7.49,  currentPrice: 5.84,  source: 'catalogue', verifiedCount: 98,  category: 'Épicerie',       expiresAt: expire(5) },
    { id: 'nat-05', name: 'Shampooing Elsève 400ml',      brand: "L'Oréal",     store: 'Monoprix',    discount: 40, originalPrice: 4.99,  currentPrice: 2.99,  source: 'catalogue', verifiedCount: 201, category: 'Hygiène',        expiresAt: expire(7) },
    { id: 'nat-06', name: 'Bière Heineken x10 33cl',      brand: 'Heineken',    store: 'Lidl',        discount: 20, originalPrice: 9.99,  currentPrice: 7.99,  source: 'catalogue', verifiedCount: 334, category: 'Boissons',       expiresAt: expire(5) },
    { id: 'nat-07', name: 'Pâtes Barilla 500g x4',        brand: 'Barilla',     store: 'Super U',     discount: 30, originalPrice: 5.60,  currentPrice: 3.92,  source: 'catalogue', verifiedCount: 156, category: 'Épicerie',       expiresAt: expire(4) },
    { id: 'nat-08', name: 'Gel douche Dove 2×250ml',      brand: 'Dove',        store: 'Casino',      discount: 25, originalPrice: 5.00,  currentPrice: 3.75,  source: 'catalogue', verifiedCount: 87,  category: 'Hygiène',        expiresAt: expire(3) },
    { id: 'nat-09', name: 'Fromage râpé Président 250g',  brand: 'Président',   store: 'Leclerc',     discount: 18, originalPrice: 2.89,  currentPrice: 2.37,  source: 'catalogue', verifiedCount: 274, category: 'Crèmerie',       expiresAt: expire(2) },
    { id: 'nat-10', name: 'Yaourts Bio Yoplait x8',       brand: 'Yoplait',     store: 'Carrefour',   discount: 27, originalPrice: 3.79,  currentPrice: 2.77,  source: 'catalogue', verifiedCount: 143, category: 'Crèmerie',       expiresAt: expire(6) },
    { id: 'nat-11', name: 'Lessive Ariel Pods x44',       brand: 'Ariel',       store: 'Auchan',      discount: 35, originalPrice: 16.99, currentPrice: 11.04, source: 'catalogue', verifiedCount: 512, category: 'Entretien',      expiresAt: expire(5) },
    { id: 'nat-12', name: "Céréales Kellogg's Special K", brand: "Kellogg's",   store: 'Intermarché', discount: 24, originalPrice: 3.99,  currentPrice: 3.03,  source: 'catalogue', verifiedCount: 79,  category: 'Petit-déjeuner', expiresAt: expire(4) },
  ];
}

// ─── Promotions signalées par la communauté (Supabase) ───────────────────────

export async function getCommunityPromos(): Promise<PromoItem[]> {
  const { data, error } = await supabase
    .from('store_inventory')
    .select('id, product_name, price, confidence_score, stores(name)')
    .in('source', ['user', 'scan'])
    .gte('confidence_score', 0.5)
    .order('last_updated', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return (data as unknown as {
    id: string; product_name: string; price: number; confidence_score: number;
    stores: { name: string } | { name: string }[] | null;
  }[]).map((row): PromoItem => {
    const base     = estimateBasePrice(row.product_name);
    const current  = Number(row.price);
    const original = Math.max(current * 1.15, base);
    const discount = Math.round(Math.max(0, (1 - current / original) * 100));
    return {
      id:               `comm-${row.id}`,
      storeInventoryId: row.id,
      name:             row.product_name,
      brand:            'Communauté',
      store:            (Array.isArray(row.stores) ? row.stores[0]?.name : row.stores?.name) ?? 'Magasin',
      discount,
      originalPrice:    Math.round(original * 100) / 100,
      currentPrice:     current,
      source:           'community',
      verifiedCount:    Math.round(Number(row.confidence_score) * 10),
      category:         'Épicerie',
    };
  });
}

// ─── Vérification optimiste (incrémente confidence_score) ────────────────────

export async function verifyPromoItem(inventoryId: string): Promise<void> {
  const { data } = await supabase
    .from('store_inventory')
    .select('confidence_score')
    .eq('id', inventoryId)
    .single();
  const next = Math.min(1.0, Number(data?.confidence_score ?? 0.5) + 0.05);
  await supabase.from('store_inventory').update({ confidence_score: next }).eq('id', inventoryId);
}

// ─── Upload photo vers Supabase Storage (best-effort) ────────────────────────

export async function pickAndUploadPromoPhoto(): Promise<string | null> {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  if (cam.status === 'granted') {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets.length > 0) return uploadToStorage(result.assets[0].uri);
  }
  // Fallback galerie
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (lib.status !== 'granted') return null;
  const pick = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
  if (pick.canceled || !pick.assets || pick.assets.length === 0) return null;
  return uploadToStorage(pick.assets[0].uri);
}

async function uploadToStorage(uri: string): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob     = await response.blob();
    const fileName = `promo_${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('promo_photos')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
    if (error || !data) return uri;
    return supabase.storage.from('promo_photos').getPublicUrl(data.path).data.publicUrl;
  } catch {
    return uri;
  }
}
