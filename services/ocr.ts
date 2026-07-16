// services/ocr.ts
// Scan de ticket de caisse :
//   1. simulateReceiptOCR()     — extraction OCR côté client (déterministe pour la démo)
//   2. normalizeReceiptLines()  — normalisation NLP + mise à jour inventaire via RPC Supabase

import { apiClient } from './api/client';

export interface OcrReceiptResult {
  storeName:   string;
  storeCity:   string;
  date:        string;
  totalAmount: number;
  items:       { name: string; price: number }[];
  rawText:     string;
}

export interface NormalizationResult {
  matchCount:   number;
  totalLines:   number;
  matched: {
    raw:          string;
    productId:    string;
    productName:  string;
    ean:          string | null;
    price:        number;
  }[];
  unmatched: string[];
}

/**
 * Envoie les lignes OCR brutes à la RPC Supabase `process_receipt_scan`.
 * Met à jour l'inventaire de prix du magasin en base et retourne les correspondances.
 */
export async function normalizeReceiptLines(
  storeId:  string,
  rawLines: string[],
): Promise<NormalizationResult> {
  const supabase = apiClient.getSupabase();

  const { data, error } = await supabase.rpc('process_receipt_scan', {
    p_store_id:  storeId,
    p_raw_lines: rawLines,
    p_scan_date: new Date().toISOString().slice(0, 10),
  });

  if (error) throw new Error(error.message);

  const d = data as {
    matched:     { raw: string; product_id: string; product_name: string; ean: string | null; price: number }[];
    unmatched:   string[];
    total_lines: number;
    match_count: number;
  };

  return {
    matchCount:  d.match_count ?? 0,
    totalLines:  d.total_lines ?? rawLines.length,
    matched: (d.matched ?? []).map((m) => ({
      raw:         m.raw,
      productId:   m.product_id,
      productName: m.product_name,
      ean:         m.ean,
      price:       m.price,
    })),
    unmatched: d.unmatched ?? [],
  };
}

const STORE_POOL = [
  { name: 'Leclerc', city: 'La Rochelle' },
  { name: 'Lidl',    city: 'Puilboreau'  },
  { name: 'Carrefour', city: 'Angoulins' },
  { name: 'Intermarché', city: 'Lagord'  },
];

const ITEM_POOL = [
  { name: 'Yaourt nature 4×125g', price: 1.89 },
  { name: 'Pain de mie complet',  price: 1.45 },
  { name: 'Lait demi-écrémé 1L',  price: 0.99 },
  { name: 'Pâtes spaghetti 500g', price: 0.75 },
  { name: "Jus d'orange 1L",      price: 2.29 },
  { name: 'Coca-Cola 1.5L',       price: 2.49 },
  { name: 'Fromage râpé 200g',    price: 1.99 },
  { name: 'Beurre doux 250g',     price: 2.15 },
];

function hashUri(uri: string): number {
  let h = 0;
  for (let i = 0; i < uri.length; i++) {
    h = (Math.imul(31, h) + uri.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export async function simulateReceiptOCR(imageUri: string): Promise<OcrReceiptResult> {
  // Simulate OCR processing delay
  await new Promise<void>((resolve) => setTimeout(resolve, 2500));

  const seed   = hashUri(imageUri);
  const store  = STORE_POOL[seed % STORE_POOL.length];
  const count  = 3 + (seed % 4);
  const items  = Array.from({ length: count }, (_, i) => ITEM_POOL[(seed + i * 7) % ITEM_POOL.length]);
  const total  = items.reduce((s, it) => s + it.price, 0);

  const now    = new Date();
  const date   = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return {
    storeName:   store.name,
    storeCity:   store.city,
    date,
    totalAmount: Math.round(total * 100) / 100,
    items,
    rawText: `${store.name.toUpperCase()} ${store.city.toUpperCase()}\n${date}\n` +
      items.map(it => `${it.name}  ${it.price.toFixed(2)}€`).join('\n') +
      `\nTOTAL  ${total.toFixed(2)}€`,
  };
}
