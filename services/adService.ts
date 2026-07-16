import AsyncStorage from '@react-native-async-storage/async-storage';

const PREMIUM_KEY = '@pm/user_premium_status';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SponsoredAd {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  targetStore?: string;
  couponCode?: string;
  isPremiumOnly: boolean;
}

// ─── Catalogue local (peut être remplacé par une query Supabase) ──────────────

const AD_CATALOG: SponsoredAd[] = [
  {
    id: 'ad-lidl-surgeles',
    title: "Lidl : -20% sur les surgelés",
    description: "Ce week-end seulement, profitez des promos flash de votre Lidl local.",
    targetStore: 'lidl',
    couponCode: 'MALIN20',
    isPremiumOnly: false,
  },
  {
    id: 'ad-leclerc-bio',
    title: "E.Leclerc : rayons Bio en promo",
    description: "Sélection de produits bio à prix cassés chez votre E.Leclerc.",
    targetStore: 'leclerc',
    couponCode: 'BIOLECLERC',
    isPremiumOnly: false,
  },
  {
    id: 'ad-intermarche-fruits',
    title: "Intermarché : fruits de saison",
    description: "Fruits et légumes frais de saison à prix imbattables cette semaine.",
    targetStore: 'intermarché',
    isPremiumOnly: false,
  },
  {
    id: 'ad-carrefour-fidelite',
    title: "Carrefour : -15% sur votre ticket",
    description: "Utilisez votre carte fidélité et cumulez vos réductions dès 30 € d'achat.",
    targetStore: 'carrefour',
    couponCode: 'CARREF15',
    isPremiumOnly: false,
  },
  {
    id: 'ad-generique',
    title: "PanierMalin Partenaires",
    description: "Découvrez les offres exclusives de nos partenaires locaux cette semaine.",
    isPremiumOnly: false,
  },
];

// ─── État Premium ─────────────────────────────────────────────────────────────

export async function isUserPremium(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREMIUM_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setPremiumStatus(status: boolean): Promise<void> {
  await AsyncStorage.setItem(PREMIUM_KEY, status ? 'true' : 'false');
}

// ─── Récupération des pubs ────────────────────────────────────────────────────

export async function getSponsoredAds(storeName?: string): Promise<SponsoredAd[]> {
  const premium = await isUserPremium();
  if (premium) return [];

  if (!storeName) {
    return AD_CATALOG.filter((a) => !a.isPremiumOnly);
  }

  const key = storeName.toLowerCase();
  const targeted = AD_CATALOG.filter(
    (a) => !a.isPremiumOnly && !!a.targetStore && key.includes(a.targetStore)
  );
  // Si aucune pub ciblée sur cette enseigne, renvoie la pub générique
  return targeted.length > 0
    ? targeted
    : AD_CATALOG.filter((a) => !a.isPremiumOnly && !a.targetStore);
}
