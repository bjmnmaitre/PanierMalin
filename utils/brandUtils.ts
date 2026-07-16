// utils/brandUtils.ts
// Palette officielle et abréviations des enseignes — partagées entre
// SearchMapScreen, StoreDetailScreen et tout futur composant carte.

export interface BrandPalette {
  main:  string;  // couleur principale de l'enseigne
  text:  string;  // couleur du texte sur le fond main
  light: string;  // fond clair pour badges, chips
}

// Abréviations officielles 2-3 chars
const BRAND_ABBR: Record<string, string> = {
  lidl:         'LID',
  leclerc:      'LEC',
  carrefour:    'CAR',
  intermarche:  'ITM',
  auchan:       'AUC',
  super_u:      'U',
  casino:       'CAS',
  monoprix:     'M',
  netto:        'NET',
  spar:         'SPA',
  franprix:     'FRA',
  cora:         'COR',
  match:        'MAT',
  simply:       'SIM',
  bio_coop:     'BIO',
};

export function getBrandAbbr(brand: string): string {
  return BRAND_ABBR[brand.toLowerCase()] ?? brand.slice(0, 3).toUpperCase();
}

/**
 * URLs de logos officiels des enseignes (PNG transparents via Clearbit Logo API).
 * Chargés une fois avec expo-image cachePolicy="memory-disk" → zéro flash au scroll.
 */
export const BRAND_LOGO_URLS: Record<string, string> = {
  lidl:        'https://logo.clearbit.com/lidl.fr',
  leclerc:     'https://logo.clearbit.com/e.leclerc',
  carrefour:   'https://logo.clearbit.com/carrefour.fr',
  intermarche: 'https://logo.clearbit.com/intermarche.com',
  auchan:      'https://logo.clearbit.com/auchan.fr',
  monoprix:    'https://logo.clearbit.com/monoprix.fr',
  franprix:    'https://logo.clearbit.com/franprix.fr',
  casino:      'https://logo.clearbit.com/groupe-casino.fr',
  aldi:        'https://logo.clearbit.com/aldi.fr',
};

export function getBrandLogoUrl(brand: string): string | null {
  return BRAND_LOGO_URLS[brand.toLowerCase()] ?? null;
}

export function getBrandPalette(brand: string): BrandPalette {
  switch (brand.toLowerCase()) {
    case 'lidl':        return { main: '#0050AA', text: '#FFCC00', light: '#E0F2FE' };
    case 'leclerc':     return { main: '#0C5C9D', text: '#FFFFFF', light: '#DBEAFE' };
    case 'carrefour':   return { main: '#1E40AF', text: '#FFFFFF', light: '#EEF2FF' };
    case 'intermarche': return { main: '#E51837', text: '#FFFFFF', light: '#FEE2E2' };
    case 'auchan':      return { main: '#CC0000', text: '#FFFFFF', light: '#FEE2E2' };
    case 'super_u':     return { main: '#C0392B', text: '#FFFFFF', light: '#FEE2E2' };
    case 'casino':      return { main: '#2E7D32', text: '#FFFFFF', light: '#DCFCE7' };
    case 'monoprix':    return { main: '#000000', text: '#FFFFFF', light: '#F1F5F9' };
    case 'franprix':    return { main: '#E65100', text: '#FFFFFF', light: '#FFF3E0' };
    default:            return { main: '#1D9E75', text: '#FFFFFF', light: '#E6F9ED' };
  }
}
