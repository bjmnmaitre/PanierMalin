// types/index.ts
// Complete TypeScript type definitions for PanierMalin

/**
 * ============================================
 * AUTH & USER
 * ============================================
 */

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  plan: 'free' | 'premium' | 'pro';
  totalSavings: number;
  totalPoints: number;
  referralCode: string;
  invitedCount: number;
  sentinelLevel?: number;
  ambassadorGoal?: number;
}

/**
 * ============================================
 * PRODUCTS & PRICES
 * ============================================
 */

export interface Product {
  id: string;
  ean: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  subcategory?: string;
  nutriscore?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  imageUrl?: string | null;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StoreChain =
  | 'leclerc'
  | 'lidl'
  | 'intermarche'
  | 'aldi'
  | 'carrefour'
  | 'monoprix'
  | 'casino'
  | 'cora';

export interface Store {
  id: string;
  chain: StoreChain;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  logoUrl?: string;
  phone?: string;
  website?: string;
  rating?: number;
  createdAt: string;
}

export interface StoreOffer {
  id: string;
  productId?: string;
  storeId: string;
  price: number;
  isVerified: boolean;
  verifiedAt: string;
  proofImageUrl?: string;
  proofImageUri?: string;
  freshness?: 'fresh' | 'recent' | 'old';
  createdAt?: string;
  updatedAt?: string;
  storeName: string;
  chain?: StoreChain;
  logoUri: string;
  distanceKm: number;
}

export interface ProductWithOffers extends Product {
  offers: StoreOffer[];
  minPrice?: number;
  maxPrice?: number;
  avgPrice?: number;
}

export interface ProductPrice {
  id: string;
  productId: string;
  storeId: string;
  price: number;
  proofImageUrl?: string | null;
  isVerified: boolean;
  verifiedAt?: string | null;
  storeName?: string;
  chain?: string | null;
  logoUri?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * ============================================
 * SHOPPING & BASKETS
 * ============================================
 */

export interface ShoppingList {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  itemCount: number;
  doneCount: number;
  estimatedTotal: number;
  isShared: boolean;
  isArchived: boolean;
  collaborators?: string[]; // User IDs
  collaboratorAvatars?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ListItem {
  id: string;
  listId: string;
  productId?: string | null;
  customName?: string | null;
  quantity: number;
  qty?: number;
  unit?: string;
  isDone: boolean;
  checked: boolean;
  estimatedPrice?: number;
  price?: number;
  notes?: string;
  brand?: string;
  imageUrl?: string;
  aiBestPrice?: {
    price: number;
    storeName: string;
  };
  communityPromo?: {
    discountLabel: string;
    photoUri: string;
    userName: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedBasket {
  id: string;
  userId: string;
  name: string;
  itemCount: number;
  icon: string;
  isShared: boolean;
  collaboratorCount: number;
  createdAt: string;
}

export interface SavedBasketData extends SavedBasket {}

/**
 * ============================================
 * OPTIMIZATION
 * ============================================
 */

export interface OptimizationResult {
  totalSavings: number;
  savingsPercentage?: number;

  standardOption: {
    storeId?: string;
    storeName: string;
    logoUrl?: string;
    logoUri?: string;
    total: number;
    distance?: number;
  };

  optimizedOption: {
    storeCount: number;
    total: number;
    distance?: number;
    savings?: number;
    breakdown: StoreBreakdown[];
  };
}

export interface StoreBreakdown {
  storeId: string;
  storeName: string;
  logoUrl?: string;
  logoUri?: string;
  chain?: StoreChain;
  distance?: number;
  distanceKm?: number;
  itemCount?: number;
  subtotal: number;
  itemBreakdown?: ItemBreakdown[];
  thumbnails?: string[];
}

export interface ItemBreakdown {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
  total: number;
}

/**
 * ============================================
 * COMMUNITY
 * ============================================
 */

export interface CommunityActivity {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  type: 'price_confirmed' | 'price_reported' | 'savings_milestone' | 'badge_unlocked';
  message: string;
  timestamp: string;
  usefulCount: number;
  proof?: {
    imageUrl?: string;
    imageUri?: string;
    productName: string;
    verifiedAt?: string;
  };
}

export interface CommunityActivityItem extends CommunityActivity {
  avatarUri?: string;
  timeAgo?: string;
  priceDropBadge?: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  avatarUri?: string;
  totalSavings: number;
  savings: number;
  isCurrentUser: boolean;
  isMe: boolean;
}

/**
 * ============================================
 * EVENTS & SHARED EXPENSES
 * ============================================
 */

export interface EventData {
  id: string;
  name: string;
  status: 'open' | 'settled';
  participants: EventParticipant[];
  items: EventItemData[];
  balances: EventBalance[];
  total: number;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  creatorId: string;
  participants: EventParticipant[];
  items: EventItem[];
  status: 'active' | 'settled';
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventParticipant {
  userId: string;
  name: string;
  avatarUrl?: string;
  avatarUri?: string | null;
  paidAmount?: number;
  balance?: number;
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
  balance: number;
}

export interface EventItem {
  id: string;
  name: string;
  amount: number;
  paidBy: string;
  splitAmong: string[];
  isPurchased: boolean;
  purchasedAt?: string;
  receipt?: string;
}

/**
 * ============================================
 * API RESPONSES
 * ============================================
 */

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * ============================================
 * FORMS & VALIDATION
 * ============================================
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  displayName: string;
  agreeToTerms: boolean;
}

export interface CreateShoppingListRequest {
  name: string;
  description?: string;
}

export interface AddListItemRequest {
  listId: string;
  productId?: string;
  customName?: string;
  quantity: number;
}

export interface ReportPriceRequest {
  productId: string;
  storeId: string;
  price: number;
  proofImageUrl?: string;
}

/**
 * ============================================
 * FILTERS & SORTING
 * ============================================
 */

export type SortBy = 'price_asc' | 'price_desc' | 'distance' | 'freshness' | 'rating';

export interface ProductFilter {
  search?: string;
  category?: string;
  priceRange?: [number, number];
  stores?: StoreChain[];
  sortBy?: SortBy;
  page?: number;
  pageSize?: number;
}

export interface StoreFilter {
  latitude?: number;
  longitude?: number;
  radius?: number; // km
  chains?: StoreChain[];
  minRating?: number;
}

/**
 * ============================================
 * NOTIFICATIONS & ALERTS
 * ============================================
 */

export interface Notification {
  id: string;
  userId: string;
  type: 'price_drop' | 'deal' | 'milestone' | 'social' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

/**
 * ============================================
 * ANALYTICS
 * ============================================
 */

export interface UserAnalytics {
  userId: string;
  totalSavings: number;
  averageSavingsPerTrip: number;
  totalTrips: number;
  favoriteStores: StoreChain[];
  favoriteCategories: string[];
  lastActive: string;
}