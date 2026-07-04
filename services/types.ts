// services/types.ts
// Types alignés sur le schéma supabase/schema.sql — à garder synchronisés.

export type FreshnessSource = 'user' | 'admin' | 'api';
export type StoreChain = 'leclerc' | 'lidl' | 'intermarche' | 'aldi' | 'carrefour' | 'monoprix';

export interface Product {
  id: string;
  ean: string;
  name: string;
  brand: string | null;
  category: string | null;
  nutriscore: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  imageUrl: string | null;
}

export interface StoreOffer {
  id: string;
  storeId: string;
  storeName: string;
  chain: StoreChain;
  logoUri: string;
  distanceKm: number;
  price: number;
  verifiedAt: string; // ISO
  proofImageUri: string | null;
  isVerified: boolean;
}

export interface ProductWithOffers extends Product {
  offers: StoreOffer[];
}

export interface ProductPrice {
  id: string;
  productId: string;
  storeId: string;
  price: number;
  proofImageUrl: string | null;
  isVerified: boolean;
  verifiedAt: string | null; // ISO
  storeName: string;
  chain: string | null;
  logoUri: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ShoppingList {
  id: string;
  name: string;
  itemCount: number;
  doneCount: number;
  estimatedTotal: number;
  isShared: boolean;
  isArchived: boolean;
  collaboratorAvatars: string[];
}

export interface ListItem {
  id: string;
  listId: string;
  productId: string | null;
  customName: string | null;
  qty: number;
  checked: boolean;
  price?: number;
  // Métadonnées enrichies par le scan de l'IA et les remontées de la communauté
  brand?: string;
  imageUrl?: string;
  aiBestPrice?: {
    price: number;
    storeName: string;
  };
  communityPromo?: {
    discountLabel: string; // ex: "-30%", "1 acheté = 1 offert"
    photoUri: string;      // Photo en direct prise par un membre de la communauté
    userName: string;      // Qui a partagé le bon plan
  };
}

export interface SavedBasketData {
  id: string;
  name: string;
  itemCount: number;
  icon: string;
  isShared: boolean;
  collaboratorCount: number;
}

export interface OptimizationResult {
  totalSavings: number;
  standardOption: { storeName: string; total: number };
  optimizedOption: {
    storeCount: number;
    total: number;
    breakdown: {
      storeId: string;
      storeName: string;
      logoUri: string;
      itemCount: number;
      distanceKm: number;
      subtotal: number;
      thumbnails: string[];
    }[];
  };
}

export interface CommunityActivityItem {
  id: string;
  userId: string;
  userName: string;
  avatarUri: string;
  type: 'price_confirmed' | 'price_reported' | 'savings_milestone' | 'badge_unlocked' | 'joined_group';
  message: string;
  timeAgo: string;
  usefulCount: number;
  proof?: {
    imageUri: string;
    productName: string;
    verifiedAt: string;
  };
  priceDropBadge?: string; // ex: "-15% aujourd'hui"
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUri: string;
  savings: number;
  isMe: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  plan: 'free' | 'premium';
  totalSavings: number;
  totalPoints: number;
  sentinelLevel: number;
  referralCode: string;
  invitedCount: number;
  ambassadorGoal: number;
}

// ============================================================
// ÉVÉNEMENTS / FRAIS PARTAGÉS
// ============================================================

export interface EventParticipant {
  userId: string;
  name: string;
  avatarUri: string | null;
}

export interface EventItemData {
  id: string;
  name: string;
  purchased: boolean;
  addedByName?: string;
  addedByAvatarUri?: string;
  purchasedByName?: string;
  pricePaid?: number;
  proofImageUri?: string;
}

export interface EventBalance {
  name: string;
  paid: number;
  balance: number; // positif = doit recevoir, négatif = doit payer
}

export interface EventData {
  id: string;
  name: string;
  status: 'open' | 'settled';
  participants: EventParticipant[];
  items: EventItemData[];
  balances: EventBalance[];
  total: number;
}