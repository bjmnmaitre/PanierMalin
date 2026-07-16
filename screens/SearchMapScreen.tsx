// screens/SearchMapScreen.tsx

import * as React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Animated,
  ScrollView,
  FlatList,
  PanResponder,
  Platform,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Circle, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import BottomNav, { TabKey } from '../components/BottomNav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseNearbyStores, getUserFavoriteStores, toggleFavoriteStore } from '../services/api';
import { loadFavoriteStores, saveFavoriteStores } from '../services/offlineStorage';
import { scheduleProximityAlert } from '../services/notifications';
import { isUserPremium, getSponsoredAds } from '../services/adService';
import { getStoresInRegion } from '../services/geoService';
import type { BoundingBox, GeoStore } from '../services/geoService';
import { trackStoreEvent, claimStore } from '../services/proService';
import { useRouter } from 'expo-router';
import type { SponsoredAd } from '../services/adService';
import * as Haptics from 'expo-haptics';
import type { Store } from '../types';
import NativeAdCard from '../components/features/NativeAdCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useGeoNotification } from '../hooks/useGeoNotification';
import { searchInventory } from '../services/inventoryService';
import type { InventoryPrice } from '../services/inventoryService';
import { useCart } from '../contexts/CartContext';
import { optimizeCart } from '../services/cartService';
import type { CartOptimResult } from '../services/cartService';
import { STORE_CATEGORIES } from '../constants/categories';

const { width, height } = Dimensions.get('window');

// ── Store List Bottom Sheet ───────────────────────────────────────────────────
const SHEET_FULL_H   = Math.round(height * 0.80);
const SHEET_PEEK_H   = 72;
const SHEET_HIDDEN_Y = SHEET_FULL_H - SHEET_PEEK_H;

// ── Hiérarchie des marqueurs carte ───────────────────────────────────────────
const MAJOR_BRANDS = new Set([
  'lidl', 'leclerc', 'carrefour', 'intermarche', 'auchan',
  'aldi', 'monoprix', 'super_u', 'casino', 'franprix', 'spar',
]);

// ============================================================
// TYPES
// ============================================================

export interface StorePOI {
  id: string;
  name: string;
  brand: string;
  basketPrice: number;
  promoCount: number;
  hasAntiGaspi: boolean;
  reliabilityScore: number;
  trafficIntensity: 'fluide' | 'modéré' | 'dense';
  distanceText: string;
  durationMinutes: number;
  coordinate: { latitude: number; longitude: number };
  address: string;
  city: string;
  openingHours: string;
  savedAmount: number;
  tier: number;
  isSponsored: boolean;
  sponsorBannerUrl: string | null;
  ownerId: string | null;
}

import { Image as ExpoImage } from 'expo-image';
import { getBrandPalette, getBrandAbbr, getBrandLogoUrl } from '../utils/brandUtils';
import type { BrandPalette } from '../utils/brandUtils';

type ViewMode = 'map' | 'list';
type SortMode = 'savings_abs' | 'savings_pct' | 'distance';
type ListItem =
  | { kind: 'store'; data: StorePOI }
  | { kind: 'ad'; data: SponsoredAd };
const BRAND_OPTIONS = ['Lidl', 'Leclerc', 'Carrefour', 'Intermarché'];

// Catégories associées à chaque enseigne (pour le filtre par catégorie)
const BRAND_CATEGORIES: Record<string, string[]> = {
  carrefour:    ['food', 'cosmetics', 'tech', 'sport', 'fashion', 'diy'],
  leclerc:      ['food', 'cosmetics', 'tech', 'sport', 'fashion', 'diy'],
  auchan:       ['food', 'cosmetics', 'tech', 'sport', 'fashion', 'diy'],
  intermarche:  ['food', 'cosmetics', 'diy'],
  lidl:         ['food', 'tech', 'sport', 'fashion', 'diy'],
  aldi:         ['food', 'tech', 'sport', 'diy'],
  monoprix:     ['food', 'cosmetics', 'fashion'],
  super_u:      ['food', 'cosmetics', 'diy'],
  casino:       ['food', 'cosmetics'],
  franprix:     ['food', 'cosmetics'],
  spar:         ['food'],
};

const RAYON_OPTIONS = [
  { id: 'all',         label: 'Tout',          emoji: '🛒' },
  { id: 'boulangerie', label: 'Boulangerie',    emoji: '🍞' },
  { id: 'frais',       label: 'Produits Frais', emoji: '🧀' },
  { id: 'boissons',    label: 'Boissons',       emoji: '🥤' },
  { id: 'hygiene',     label: 'Hygiène',        emoji: '🧼' },
  { id: 'epicerie',    label: 'Épicerie',       emoji: '🥫' },
] as const;
type RayonId = typeof RAYON_OPTIONS[number]['id'];

const RAYON_KEYWORDS: Record<RayonId, string[]> = {
  all:         [],
  boulangerie: ['pain', 'baguette', 'brioche', 'croissant', 'farine', 'miche'],
  frais:       ['lait', 'fromage', 'yaourt', 'beurre', 'crème', 'oeuf', 'oeufs'],
  boissons:    ['eau', 'jus', 'soda', 'café', 'thé', 'vin', 'bière', 'boisson'],
  hygiene:     ['savon', 'shampoing', 'dentifrice', 'gel', 'déodorant', 'rasoir'],
  epicerie:    ['pâtes', 'riz', 'sauce', 'huile', 'sucre', 'sel', 'conserve'],
};

const SEARCH_HISTORY_KEY = '@pm_search_history';

const SLIDER_MIN = 1;
const SLIDER_MAX = 30;
const THUMB_SIZE = 26;

// ─── Slider de rayon (pure RN, sans dépendance externe) ──────────────────────

interface DistanceSliderProps {
  value:    number;
  onChange: (v: number) => void;
}

function DistanceSlider({ value, onChange }: DistanceSliderProps) {
  const [trackW, setTrackW] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const trackWRef = useRef(0);
  trackWRef.current = trackW;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const w = trackWRef.current;
        if (!w) return;
        const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX - THUMB_SIZE / 2) / (w - THUMB_SIZE)));
        onChangeRef.current(Math.round(SLIDER_MIN + ratio * (SLIDER_MAX - SLIDER_MIN)));
      },
      onPanResponderMove: (e) => {
        const w = trackWRef.current;
        if (!w) return;
        const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX - THUMB_SIZE / 2) / (w - THUMB_SIZE)));
        onChangeRef.current(Math.round(SLIDER_MIN + ratio * (SLIDER_MAX - SLIDER_MIN)));
      },
    })
  ).current;

  const thumbLeft = trackW > 0
    ? ((value - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * (trackW - THUMB_SIZE)
    : 0;
  const fillWidth = thumbLeft + THUMB_SIZE / 2;

  return (
    <View style={slStyles.root}>
      <View
        style={slStyles.track}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View style={[slStyles.fill, { width: fillWidth }]} />
        <View style={[slStyles.thumb, { left: thumbLeft }]}>
          <Text style={slStyles.thumbLabel}>{value}</Text>
        </View>
      </View>
      <View style={slStyles.endLabels}>
        <Text style={slStyles.endTxt}>{SLIDER_MIN} km</Text>
        <Text style={slStyles.endTxt}>{SLIDER_MAX} km</Text>
      </View>
    </View>
  );
}

const slStyles = StyleSheet.create({
  root: { gap: 6 },
  track: {
    height: 6, backgroundColor: '#E2E8F0', borderRadius: 3,
    marginHorizontal: THUMB_SIZE / 2, position: 'relative',
  },
  fill: { position: 'absolute', left: -THUMB_SIZE / 2, top: 0, height: 6, backgroundColor: '#1D9E75', borderRadius: 3 },
  thumb: {
    position: 'absolute', top: -(THUMB_SIZE - 6) / 2,
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#1D9E75', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  thumbLabel: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  endLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  endTxt: { fontSize: 11, color: '#94A3B8' },
});

// ============================================================
// DONNÉES & HELPERS
// ============================================================

function computeDistKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function storeToStorePOI(store: Store | GeoStore, userCoords: { latitude: number; longitude: number }): StorePOI {
  const distKm = computeDistKm(userCoords, { latitude: store.latitude, longitude: store.longitude });
  const distText = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;
  const durationMin = Math.max(1, Math.round(distKm * 2.5));
  const brand = store.brand.toLowerCase().split(/[\s_-]/)[0];
  const geo = store as GeoStore;
  return {
    id: store.id, name: store.name, brand,
    basketPrice: 0, promoCount: 0, hasAntiGaspi: false,
    reliabilityScore: 90, trafficIntensity: 'fluide',
    distanceText: distText, durationMinutes: durationMin,
    coordinate: { latitude: store.latitude, longitude: store.longitude },
    address: store.address, city: '',
    openingHours: store.hours || '09:00 - 21:00', savedAmount: 0,
    tier:             geo.tier              ?? 3,
    isSponsored:      geo.is_sponsored      ?? false,
    sponsorBannerUrl: geo.sponsor_banner_url ?? null,
    ownerId:          geo.owner_id          ?? null,
  };
}

const FALLBACK_STORES_POI: StorePOI[] = [
  { id: 'w_1', name: 'Lidl Puilboreau',    brand: 'lidl',      basketPrice: 22.40, promoCount: 18, hasAntiGaspi: true,  reliabilityScore: 99, trafficIntensity: 'fluide', distanceText: '1.2 km', durationMinutes: 4,  coordinate: { latitude: 46.1830, longitude: -1.1150 }, address: 'Rue du 18 Juin',           city: 'Puilboreau', openingHours: '08:30 - 20:00', savedAmount: 8.50, tier: 2, isSponsored: false, sponsorBannerUrl: null, ownerId: null },
  { id: 'w_2', name: 'E.Leclerc Lagord',   brand: 'leclerc',   basketPrice: 26.15, promoCount: 45, hasAntiGaspi: false, reliabilityScore: 94, trafficIntensity: 'modéré', distanceText: '3.4 km', durationMinutes: 9,  coordinate: { latitude: 46.1750, longitude: -1.1550 }, address: 'Avenue du Fief Rose',       city: 'Lagord',     openingHours: '08:30 - 20:30', savedAmount: 4.20, tier: 2, isSponsored: true,  sponsorBannerUrl: null, ownerId: null },
  { id: 'w_3', name: 'Carrefour Angoulins', brand: 'carrefour', basketPrice: 29.90, promoCount: 22, hasAntiGaspi: true,  reliabilityScore: 88, trafficIntensity: 'dense',  distanceText: '7.1 km', durationMinutes: 14, coordinate: { latitude: 46.1050, longitude: -1.1080 }, address: 'Route nationale 137',       city: 'Angoulins',  openingHours: '09:00 - 21:00', savedAmount: 1.10, tier: 2, isSponsored: false, sponsorBannerUrl: null, ownerId: null },
];

const wazeStylingAsphalt = [
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: '#F1F5F9' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#E2E8F0' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FFE082' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#F59E0B' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#CBD5E1' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#BAE6FD' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

// ============================================================
// SOUS-COMPOSANTS
// ============================================================


// ── Marqueur standard (Mode A Découverte / Mode B Recherche) ─────────────────

type MapMode = 'discovery' | 'search';

// ─── Types & algorithme de clustering spatial ─────────────────────────────────

/** Rayon max (en degrés de latitude) au-delà duquel on ne lance pas de requête Supabase */
const MAX_LAT_DELTA_FOR_QUERY = 0.9; // ≈ 100 km — au-delà, uniquement clusters visuels

/** Distance en km entre deux coordonnées (Haversine simplifiée) */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ClusterItem {
  type:       'cluster';
  count:      number;
  coordinate: { latitude: number; longitude: number };
  key:        string;
}

interface SponsoredClusterItem {
  type:        'sponsored_cluster';
  count:       number;
  promoTotal:  number;
  brandLetter: string;
  coordinate:  { latitude: number; longitude: number };
  key:         string;
}

interface StoreItem {
  type: 'store';
  data: StorePOI;
}

type MapItem = ClusterItem | SponsoredClusterItem | StoreItem;

/**
 * Algorithme O(n) de clustering spatial par grille.
 * Sponsors et stores réguliers sont clusterisés dans des grilles séparées :
 * un SponsoredClusterMarker n'absorbe jamais un store ordinaire.
 * En dessous de 0.12° (~13 km) : pins individuels sur toute la carte.
 */
function computeClusters(stores: StorePOI[], latDelta: number): MapItem[] {
  if (stores.length === 0) return [];
  if (latDelta < 0.12) {
    return stores.map((s) => ({ type: 'store' as const, data: s }));
  }

  const cellSize       = latDelta / 5;
  const regularCells   = new Map<string, StorePOI[]>();
  const sponsoredCells = new Map<string, StorePOI[]>();

  for (const store of stores) {
    const row = Math.floor(store.coordinate.latitude  / cellSize);
    const col = Math.floor(store.coordinate.longitude / cellSize);
    const key = `${row}:${col}`;
    const map = store.isSponsored ? sponsoredCells : regularCells;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(store);
  }

  const result: MapItem[] = [];

  for (const [key, group] of regularCells.entries()) {
    if (group.length === 1) {
      result.push({ type: 'store', data: group[0] });
    } else {
      const lat = group.reduce((s, g) => s + g.coordinate.latitude,  0) / group.length;
      const lng = group.reduce((s, g) => s + g.coordinate.longitude, 0) / group.length;
      result.push({ type: 'cluster', count: group.length, coordinate: { latitude: lat, longitude: lng }, key });
    }
  }

  for (const [key, group] of sponsoredCells.entries()) {
    if (group.length === 1) {
      result.push({ type: 'store', data: group[0] });
    } else {
      const lat        = group.reduce((s, g) => s + g.coordinate.latitude,  0) / group.length;
      const lng        = group.reduce((s, g) => s + g.coordinate.longitude, 0) / group.length;
      const promoTotal = group.reduce((s, g) => s + g.promoCount, 0);
      const topSponsor = group.reduce((best, g) => g.promoCount > best.promoCount ? g : best, group[0]);
      result.push({
        type:        'sponsored_cluster',
        count:       group.length,
        promoTotal,
        brandLetter: topSponsor.brand[0]?.toUpperCase() ?? 'S',
        coordinate:  { latitude: lat, longitude: lng },
        key,
      });
    }
  }

  return result;
}

// ─── Marqueur de cluster ──────────────────────────────────────────────────────

function ClusterMarker({ count }: { count: number }) {
  const size = count >= 20 ? 60 : count >= 10 ? 52 : 44;
  return (
    <View style={[clStyles.bubble, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={clStyles.emoji}>📍</Text>
      <Text style={clStyles.count}>{count}</Text>
    </View>
  );
}

const clStyles = StyleSheet.create({
  bubble: {
    backgroundColor: '#FF6B00',
    alignItems:     'center',
    justifyContent: 'center',
    shadowColor:    '#FF6B00',
    shadowOffset:   { width: 0, height: 3 },
    shadowOpacity:  0.45,
    shadowRadius:   8,
    elevation:      7,
    borderWidth:    2,
    borderColor:    '#FFB800',
    gap: -2,
  },
  emoji: { fontSize: 14, lineHeight: 16 },
  count: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', lineHeight: 13 },
});

function StoreMapMarker({
  store, isSelected, mode, isMinPrice = false,
}: {
  store: StorePOI; isSelected: boolean; mode: MapMode; isMinPrice?: boolean;
}) {
  const pal     = getBrandPalette(store.brand);
  const logoUrl = getBrandLogoUrl(store.brand);
  const [logoError, setLogoError] = React.useState(false);

  if (mode === 'search') {
    const hasPromo = store.promoCount > 0 || store.basketPrice > 0;
    if (!hasPromo) {
      // Grayed-out: store has nothing matching the active filter
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={mkStyles.pinGray}>
            <Text style={mkStyles.pinGrayTxt}>{store.brand[0].toUpperCase()}</Text>
          </View>
          <View style={mkStyles.arrowGray} />
        </View>
      );
    }
    // Price pill — dorée si meilleur prix de la zone
    const label = store.basketPrice > 0
      ? `${store.basketPrice.toFixed(2)} €`
      : `+${store.promoCount} promos`;
    return (
      <View style={{ alignItems: 'center' }}>
        <View style={[mkStyles.pricePill, isSelected && mkStyles.pricePillSelected, isMinPrice && mkStyles.pricePillBest]}>
          <MaterialIcons
            name={isMinPrice ? 'emoji-events' : 'local-offer'}
            size={10}
            color={isMinPrice ? '#0F172A' : '#FFFFFF'}
          />
          <Text style={[mkStyles.pricePillTxt, isMinPrice && mkStyles.pricePillTxtBest]}>{label}</Text>
        </View>
        {isMinPrice && (
          <View style={mkStyles.bestBadge}>
            <Text style={mkStyles.bestBadgeTxt}>Meilleur Prix</Text>
          </View>
        )}
        <View style={[mkStyles.arrowOrange, isMinPrice && mkStyles.arrowBest]} />
      </View>
    );
  }

  // Mode A: Découverte — hiérarchique (logo circulaire ×42 pour grandes enseignes, dot ×14 pour le reste)
  const abbr     = getBrandAbbr(store.brand);
  const showLogo = logoUrl !== null && !logoError;
  const isMajor  = MAJOR_BRANDS.has(store.brand.toLowerCase());
  const hasHalo  = store.promoCount > 0 || store.savedAmount > 0;

  if (isMajor) {
    return (
      <View style={{ alignItems: 'center' }}>
        <View style={[mkStyles.haloWrap, hasHalo && mkStyles.haloGold]}>
          <View style={[
            mkStyles.pinCircle,
            { borderColor: pal.main },
            isSelected && mkStyles.pinCircleSelected,
          ]}>
            {showLogo ? (
              <ExpoImage
                source={{ uri: logoUrl! }}
                style={mkStyles.logoCircle}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={0}
                onError={() => setLogoError(true)}
              />
            ) : (
              <Text style={[mkStyles.pinAbbr, { color: pal.text, fontSize: abbr.length > 2 ? 9 : 11 }]}>
                {abbr}
              </Text>
            )}
          </View>
        </View>
        <View style={[mkStyles.arrowPin, { borderTopColor: pal.main }]} />
      </View>
    );
  }

  // Petits commerces — dot coloré avec halo doré si promo active
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[mkStyles.haloWrapDot, hasHalo && mkStyles.haloGoldDot]}>
        <View style={[
          mkStyles.dot,
          { backgroundColor: pal.main },
          isSelected && mkStyles.dotSelected,
        ]} />
      </View>
    </View>
  );
}

const mkStyles = StyleSheet.create({
  // Mode A — texte (fallback)
  pin: {
    width: 42, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 4, elevation: 5,
    paddingHorizontal: 4,
  },
  // Mode A — avec logo (fond blanc + bordure couleur enseigne + ombre renforcée)
  pinLogo: {
    width: 52, height: 34, borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6, elevation: 7,
    overflow: 'hidden',
  },
  logoImg: { width: 40, height: 26 },
  pinSelected: { borderColor: '#FF6B00', borderWidth: 2.5, transform: [{ scale: 1.15 }] },
  pinAbbr: { fontWeight: '800', letterSpacing: 0.5 },
  arrowPin: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
  // Marqueurs hiérarchisés — Mode A
  pinCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 6, elevation: 7,
    overflow: 'hidden',
  },
  pinCircleSelected: { borderColor: '#FF6B00', borderWidth: 3, transform: [{ scale: 1.15 }] },
  logoCircle: { width: 30, height: 30 },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 2, elevation: 3,
  },
  dotSelected: { transform: [{ scale: 1.5 }], borderWidth: 1.5, borderColor: '#FF6B00' },
  haloWrap: { alignItems: 'center', justifyContent: 'center', borderRadius: 25 },
  haloGold: {
    borderWidth: 2.5, borderColor: '#FFD700', borderRadius: 25, padding: 3,
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.65, shadowRadius: 6, elevation: 9,
  },
  haloWrapDot: { alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  haloGoldDot: {
    borderWidth: 2, borderColor: '#FFD700', borderRadius: 11, padding: 3,
    shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 4, elevation: 7,
  },
  // Mode B price pill
  pricePill: {
    backgroundColor: '#FF6B00', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 5,
  },
  pricePillSelected: { backgroundColor: '#E05A00', transform: [{ scale: 1.12 }] },
  pricePillBest: {
    backgroundColor: '#FFD700',
    borderWidth: 2, borderColor: '#F59E0B',
    shadowColor: '#F59E0B', shadowOpacity: 0.5,
  },
  pricePillTxt: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  pricePillTxtBest: { color: '#0F172A' },
  bestBadge: {
    backgroundColor: '#FFD700', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2, marginTop: 2,
  },
  bestBadgeTxt: { fontSize: 8, fontWeight: '900', color: '#0F172A', letterSpacing: 0.3 },
  arrowOrange: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#FF6B00', marginTop: -1,
  },
  arrowBest: { borderTopColor: '#FFD700' },
  // Grayed-out
  pinGray: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', opacity: 0.55,
  },
  pinGrayTxt: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  arrowGray: {
    width: 0, height: 0,
    borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#CBD5E1', marginTop: -1, opacity: 0.55,
  },
});

// ── Cluster de marqueurs sponsorisés ─────────────────────────────────────────

function SponsoredClusterMarker({
  count, promoTotal, brandLetter,
}: {
  count: number; promoTotal: number; brandLetter: string;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const size = count >= 5 ? 58 : 48;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={[
          scStyles.ring,
          {
            width:        size + 16,
            height:       size + 16,
            borderRadius: (size + 16) / 2,
            transform:    [{ scale: pulse }],
          },
        ]}
      />
      <View style={[scStyles.bubble, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[scStyles.letter, { fontSize: size * 0.38 }]}>{brandLetter}</Text>
        <View style={scStyles.countBadge}>
          <Text style={scStyles.countTxt}>{count}</Text>
        </View>
      </View>
      {promoTotal > 0 && (
        <View style={scStyles.promoPill}>
          <Text style={scStyles.promoTxt}>+{promoTotal} promos</Text>
        </View>
      )}
      <View style={scStyles.arrow} />
    </View>
  );
}

const scStyles = StyleSheet.create({
  ring: {
    position:        'absolute',
    top:             -8,
    backgroundColor: 'rgba(255,184,0,0.22)',
  },
  bubble: {
    backgroundColor: '#FF6B00',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2.5,
    borderColor:     '#FFB800',
    shadowColor:     '#FF6B00',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.5,
    shadowRadius:    8,
    elevation:       8,
  },
  letter: {
    fontWeight: '900',
    color:      '#FFFFFF',
    lineHeight: undefined,
  },
  countBadge: {
    position:       'absolute',
    top:            -5,
    right:          -5,
    backgroundColor: '#FFFFFF',
    borderRadius:   10,
    width:          20,
    height:         20,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    1.5,
    borderColor:    '#FFB800',
  },
  countTxt:  { fontSize: 10, fontWeight: '900', color: '#FF6B00' },
  promoPill: {
    backgroundColor: '#FF6B00',
    borderRadius:    8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop:       2,
    shadowColor:     '#FF6B00',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.35,
    shadowRadius:    4,
    elevation:       4,
  },
  promoTxt: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
  arrow: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#FF6B00',
    marginTop: -1,
  },
});

// ── Marqueur Sponsorisé ───────────────────────────────────────────────────────

function SponsoredMapMarker({ isSelected }: { isSelected: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
    return () => { pulse.stopAnimation(); };
  }, [pulse]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={[spStyles.ring, { transform: [{ scale: pulse }] }]} />
      <View style={[spStyles.bubble, isSelected && spStyles.bubbleSelected]}>
        <MaterialIcons name="campaign" size={14} color="#FFFFFF" />
        <Text style={spStyles.label}>Sponsorisé</Text>
      </View>
      <View style={spStyles.arrow} />
    </View>
  );
}

const spStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,107,0,0.18)',
  },
  bubble: {
    backgroundColor: '#FF6B00',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFB800',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  bubbleSelected: {
    transform: [{ scale: 1.12 }],
    borderColor: '#FFFFFF',
    backgroundColor: '#E05A00',
  },
  label: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  arrow: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: '#FF6B00',
  },
});

// ── Carte vue liste ───────────────────────────────────────────────────────────

function StoreListCard({
  store,
  isFavorite,
  onPress,
  onToggleFav,
}: {
  store: StorePOI;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFav: () => void;
}) {
  const pal = getBrandPalette(store.brand);
  return (
    <TouchableOpacity style={lcStyles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={[lcStyles.brandBar, { backgroundColor: pal.main }]} />
      <View style={lcStyles.body}>
        <View style={lcStyles.row}>
          <View style={[lcStyles.badge, { backgroundColor: pal.light }]}>
            <Text style={[lcStyles.badgeTxt, { color: pal.main }]}>{store.brand[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={lcStyles.name} numberOfLines={1}>{store.name}</Text>
            <Text style={lcStyles.addr} numberOfLines={1}>{store.address} · {store.city}</Text>
          </View>
          <TouchableOpacity onPress={onToggleFav} hitSlop={10}>
            <MaterialIcons name={isFavorite ? 'star' : 'star-border'} size={22} color={isFavorite ? '#F59E0B' : '#94A3B8'} />
          </TouchableOpacity>
        </View>
        <View style={lcStyles.stats}>
          <View style={lcStyles.stat}>
            <MaterialIcons name="directions-car" size={14} color="#4F46E5" />
            <Text style={lcStyles.statTxt}>{store.durationMinutes} min</Text>
          </View>
          <View style={lcStyles.stat}>
            <MaterialIcons name="local-fire-department" size={14} color="#EF4444" />
            <Text style={lcStyles.statTxt}>{store.promoCount} promos</Text>
          </View>
          <View style={lcStyles.stat}>
            <MaterialIcons name="savings" size={14} color="#10B981" />
            <Text style={lcStyles.statTxt}>+{store.savedAmount.toFixed(2)}€</Text>
          </View>
          {store.hasAntiGaspi && (
            <View style={lcStyles.antiGaspiTag}>
              <MaterialIcons name="eco" size={12} color="#10B981" />
              <Text style={lcStyles.antiGaspiTxt}>Anti-Gaspi</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const lcStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderRadius: 16, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  brandBar: { width: 4 },
  body: { flex: 1, padding: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 14, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  addr: { fontSize: 11, color: '#64748B', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTxt: { fontSize: 12, color: '#475569', fontWeight: '600' },
  antiGaspiTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  antiGaspiTxt: { fontSize: 11, fontWeight: '700', color: '#10B981' },
});

// ── Tiroir de filtres ─────────────────────────────────────────────────────────

interface FilterSheetProps {
  visible: boolean;
  anim: Animated.Value;
  selectedBrands: string[];
  radius: number;
  sortBy: SortMode;
  selectedCategory: string;
  onToggleBrand: (b: string) => void;
  onSetRadius: (r: number) => void;
  onSetSort: (s: SortMode) => void;
  onSetCategory: (c: string) => void;
  onClose: () => void;
  onReset: () => void;
}

function FilterSheet({
  visible, anim, selectedBrands, radius, sortBy, selectedCategory,
  onToggleBrand, onSetRadius, onSetSort, onSetCategory, onClose, onReset,
}: FilterSheetProps) {
  if (!visible) return null;
  return (
    <>
      <TouchableOpacity style={fsStyles.backdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[fsStyles.sheet, { transform: [{ translateY: anim }] }]}>
        <View style={fsStyles.handle} />

        <View style={fsStyles.row}>
          <Text style={fsStyles.sheetTitle}>Filtres avancés</Text>
          <TouchableOpacity onPress={onReset} hitSlop={10}>
            <Text style={fsStyles.resetTxt}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>

        {/* Marques */}
        <Text style={fsStyles.label}>Enseignes</Text>
        <View style={fsStyles.chipsRow}>
          {BRAND_OPTIONS.map((b) => {
            const active = selectedBrands.includes(b.toLowerCase());
            return (
              <TouchableOpacity
                key={b}
                style={[fsStyles.chip, active && fsStyles.chipActive]}
                onPress={() => onToggleBrand(b.toLowerCase())}
                activeOpacity={0.8}
              >
                <Text style={[fsStyles.chipTxt, active && fsStyles.chipTxtActive]}>{b}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Rayon — slider custom */}
        <Text style={fsStyles.label}>Rayon de recherche</Text>
        <DistanceSlider value={radius} onChange={onSetRadius} />

        {/* Tri */}
        <Text style={[fsStyles.label, { marginTop: 18 }]}>Trier par</Text>
        <View style={fsStyles.chipsRow}>
          {([
            { key: 'savings_abs', label: 'Économie brute (€)'   },
            { key: 'savings_pct', label: 'Taux de réduction (%)'  },
            { key: 'distance',    label: 'Distance'                },
          ] as { key: SortMode; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[fsStyles.chip, sortBy === key && fsStyles.chipActive]}
              onPress={() => onSetSort(key)}
              activeOpacity={0.8}
            >
              <Text style={[fsStyles.chipTxt, sortBy === key && fsStyles.chipTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Catégorie */}
        <Text style={[fsStyles.label, { marginTop: 18 }]}>Catégorie</Text>
        <View style={fsStyles.chipsRow}>
          {STORE_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[fsStyles.chip, selectedCategory === cat.id && fsStyles.chipActive]}
              onPress={() => onSetCategory(cat.id)}
              activeOpacity={0.8}
            >
              <Text style={[fsStyles.chipTxt, selectedCategory === cat.id && fsStyles.chipTxtActive]}>
                {cat.emoji} {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={fsStyles.applyBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={fsStyles.applyTxt}>Appliquer les filtres</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const fsStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 20,
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36, zIndex: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 12,
  },
  handle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  resetTxt: { fontSize: 13, color: '#EF4444', fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  chipTxt: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTxtActive: { color: '#FFFFFF' },
  applyBtn: {
    backgroundColor: '#1D9E75', height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  applyTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export interface SearchMapScreenProps {
  onNavigate: (tab: TabKey) => void;
  onScan?: () => void;
  onSearchPress?: () => void;
  onProductFound?: (ean: string) => void;
}

export default function SearchMapScreen({ onNavigate, onScan, onSearchPress }: SearchMapScreenProps) {
  const mapRef  = useRef<MapView>(null);
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { profile, user } = useAuth();
  const [discoveryBannerDismissed, setDiscoveryBannerDismissed] = useState(false);

  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [storesPOI, setStoresPOI]   = useState<StorePOI[]>([]);
  const [activeStore, setActiveStore] = useState<StorePOI | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [filterAntiGaspi, setFilterAntiGaspi] = useState(false);
  const [favoriteStoreIds, setFavoriteStoreIds] = useState<string[]>([]);
  const [togglingFav, setTogglingFav] = useState(false);

  // ── Vue + filtres avancés
  const [viewMode, setViewMode]         = useState<ViewMode>('map');
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [selectedBrands, setSelectedBrands]   = useState<string[]>([]);
  const [searchRadius, setSearchRadius]       = useState(15);
  const [sortBy, setSortBy]                   = useState<SortMode>('distance');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isPremium, setIsPremium]             = useState(false);
  const [adSlot, setAdSlot]                   = useState<SponsoredAd | null>(null);
  const [claimingStore, setClaimingStore]     = useState(false);

  const [productQuery, setProductQuery]               = useState('');
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [inventoryResults, setInventoryResults]        = useState<InventoryPrice[]>([]);
  const [selectedRayon, setSelectedRayon]             = useState<RayonId>('all');
  const [searchHistory, setSearchHistory]             = useState<string[]>([]);
  const [searchFocused, setSearchFocused]             = useState(false);
  const [optimResult, setOptimResult]                 = useState<CartOptimResult | null>(null);

  const [currentLatDelta, setCurrentLatDelta] = useState(0.05);
  const mapCenterRef        = useRef<{ lat: number; lng: number }>({ lat: 0, lng: 0 });
  const lastSponsoredHaptic = useRef<string | null>(null);

  const cart = useCart();

  const slideAnim             = useRef(new Animated.Value(500)).current;
  const filterSheetAnim       = useRef(new Animated.Value(400)).current;
  const regionDebounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productDebounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartOptimDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bbDebounceRef         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);

  // ── Store List Bottom Sheet state ─────────────────────────────────────────
  const storeListY      = useRef(new Animated.Value(SHEET_HIDDEN_Y)).current;
  const storeListYValue = useRef(SHEET_HIDDEN_Y);
  const sheetStartY     = useRef(SHEET_HIDDEN_Y);
  const [storeListExpanded, setStoreListExpanded] = useState(false);

  const sheetHandleRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        sheetStartY.current = storeListYValue.current;
      },
      onPanResponderMove: (_, gs) => {
        const next = Math.max(0, Math.min(SHEET_HIDDEN_Y, sheetStartY.current + gs.dy));
        storeListYValue.current = next;
        storeListY.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        const collapse = gs.vy > 0.4 || storeListYValue.current > SHEET_HIDDEN_Y / 2;
        const toValue  = collapse ? SHEET_HIDDEN_Y : 0;
        Animated.spring(storeListY, { toValue, friction: 9, tension: 70, useNativeDriver: true }).start();
        storeListYValue.current = toValue;
        setStoreListExpanded(!collapse);
      },
    }),
  ).current;

  useEffect(() => {
    if (activeStore) {
      storeListY.setValue(SHEET_HIDDEN_Y);
      storeListYValue.current = SHEET_HIDDEN_Y;
      setStoreListExpanded(false);
    }
  }, [activeStore, storeListY]);

  const historyOpacity = useRef(new Animated.Value(0)).current;
  const historyTransY  = useRef(new Animated.Value(-8)).current;

  // ── Geo-notification pour les magasins favoris ──────────────────────────────
  const geoTargets = useMemo(
    () => storesPOI
      .filter((s) => favoriteStoreIds.includes(s.id))
      .map((s) => ({
        id:        s.id,
        name:      s.name,
        latitude:  s.coordinate.latitude,
        longitude: s.coordinate.longitude,
      })),
    [storesPOI, favoriteStoreIds],
  );
  useGeoNotification(geoTargets, 500, !!user);

  // Animation d'entrée de la bannière Mode Découverte
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTransY  = useRef(new Animated.Value(-16)).current;

  // Fenêtre de 2.5 s pour que les logos expo-image se chargent dans les marqueurs
  const [markersNeedRefresh, setMarkersNeedRefresh] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setMarkersNeedRefresh(false), 2500);
    return () => clearTimeout(t);
  }, [storesPOI]);

  // Animation d'entrée de la bannière si non-connecté
  useEffect(() => {
    if (!user && !discoveryBannerDismissed) {
      Animated.parallel([
        Animated.timing(bannerOpacity, { toValue: 1, duration: 400, delay: 600, useNativeDriver: true }),
        Animated.spring(bannerTransY,  { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [user, discoveryBannerDismissed]);

  // Centrage fluide sur la position utilisateur à l'ouverture de la carte
  const handleMapReady = useCallback(() => {
    if (userCoords) {
      mapRef.current?.animateToRegion(
        { ...userCoords, latitudeDelta: 0.045, longitudeDelta: 0.045 },
        500,
      );
    }
  }, [userCoords]);

  // ── Chargement de l'historique de recherche au mount
  useEffect(() => {
    AsyncStorage.getItem(SEARCH_HISTORY_KEY)
      .then((raw) => { if (raw) setSearchHistory(JSON.parse(raw) as string[]); })
      .catch(() => {});
  }, []);

  // ── Animation du dropdown d'historique
  useEffect(() => {
    const show = searchFocused && productQuery.length === 0 && searchHistory.length > 0;
    Animated.parallel([
      Animated.timing(historyOpacity, { toValue: show ? 1 : 0, duration: 180, useNativeDriver: true }),
      Animated.timing(historyTransY,  { toValue: show ? 0 : -8, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [searchFocused, productQuery, searchHistory, historyOpacity, historyTransY]);

  // ── Optimisation du panier (debounced 1 s)
  useEffect(() => {
    if (cartOptimDebounceRef.current) clearTimeout(cartOptimDebounceRef.current);
    if (cart.items.length === 0 || storesPOI.length === 0) { setOptimResult(null); return; }
    cartOptimDebounceRef.current = setTimeout(async () => {
      const candidates = storesPOI.slice(0, 20).map(({ id, name, brand, coordinate }) => ({
        id, name, brand,
        latitude:  coordinate.latitude,
        longitude: coordinate.longitude,
      }));
      const result = await optimizeCart(cart.items, candidates);
      setOptimResult(result);
    }, 1000);
  }, [cart.items, storesPOI]);

  // ── Recherche produit dans store_inventory (debounced 400 ms)
  useEffect(() => {
    if (productDebounceRef.current) clearTimeout(productDebounceRef.current);
    if (productQuery.length < 2) {
      setInventoryResults([]);
      return;
    }
    productDebounceRef.current = setTimeout(async () => {
      setProductSearchLoading(true);
      try {
        const storeIds = storesPOI.map((s) => s.id);
        const results  = await searchInventory(productQuery, storeIds);
        setInventoryResults(results);
        // Sauvegarde dans l'historique (max 5, dédupliqué)
        if (results.length > 0) {
          setSearchHistory((prev) => {
            const next = [productQuery, ...prev.filter((h) => h !== productQuery)].slice(0, 5);
            AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next)).catch(() => {});
            return next;
          });
        }
      } catch {
        setInventoryResults([]);
      } finally {
        setProductSearchLoading(false);
      }
    }, 400);
  }, [productQuery, storesPOI]);

  // ── Stale-while-revalidate favoris
  useEffect(() => {
    loadFavoriteStores().then((cached) => { if (cached) setFavoriteStoreIds(cached); });
    getUserFavoriteStores()
      .then((ids) => { setFavoriteStoreIds(ids); void saveFavoriteStores(ids); })
      .catch(() => {});
  }, []);

  // ── Statut Premium + pub initiale
  useEffect(() => {
    isUserPremium().then(setIsPremium).catch(() => {});
    getSponsoredAds().then((ads) => setAdSlot(ads[0] ?? null)).catch(() => {});
  }, []);

  // ── Re-vérifier le statut Premium à chaque fois que la vue liste s'active
  useEffect(() => {
    if (viewMode !== 'list') return;
    isUserPremium().then((p) => {
      setIsPremium(p);
      if (p) {
        setAdSlot(null);
      } else {
        getSponsoredAds().then((ads) => setAdSlot(ads[0] ?? null)).catch(() => {});
      }
    }).catch(() => {});
  }, [viewMode]);

  // ── Tracking : vue de fiche magasin
  useEffect(() => {
    if (activeStore) trackStoreEvent(activeStore.id, 'view');
  }, [activeStore?.id]);

  // ── Revendication de commerce
  const handleClaimStore = useCallback(async (store: StorePOI) => {
    Alert.alert(
      "Gérer ce magasin",
      "Devenez partenaire pour modifier les informations, voir vos statistiques de visites et publier vos promotions exclusives en direct à notre communauté de Sentinelles.",
      [
        { text: "Annuler", style: 'cancel' },
        {
          text: "Revendiquer",
          onPress: async () => {
            setClaimingStore(true);
            try {
              const result = await claimStore(store.id);
              if (result.success) {
                setStoresPOI((prev) =>
                  prev.map((s) => s.id === store.id ? { ...s, ownerId: profile?.id ?? null } : s)
                );
                if (activeStore?.id === store.id) {
                  setActiveStore((s) => s ? { ...s, ownerId: profile?.id ?? null } : s);
                }
                Alert.alert(
                  "Commerce revendiqué !",
                  "Votre espace Pro est prêt. Accédez à votre tableau de bord pour commencer.",
                  [{ text: "Voir mon dashboard", onPress: () => router.push('/pro/dashboard' as any) }]
                );
              } else {
                Alert.alert("Revendication impossible", result.message);
              }
            } catch {
              Alert.alert("Erreur", "Impossible de revendiquer ce commerce. Réessaie dans un instant.");
            } finally {
              setClaimingStore(false);
            }
          },
        },
      ]
    );
  }, [profile, activeStore, router]);

  const handleToggleFav = async (storeId: string) => {
    if (togglingFav) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const wasFav = favoriteStoreIds.includes(storeId);
    setFavoriteStoreIds(prev => wasFav ? prev.filter(id => id !== storeId) : [...prev, storeId]);
    setTogglingFav(true);
    try {
      const result = await toggleFavoriteStore(storeId);
      const newIds = result.isFavorite
        ? [...favoriteStoreIds.filter(id => id !== storeId), storeId]
        : favoriteStoreIds.filter(id => id !== storeId);
      setFavoriteStoreIds(newIds);
      void saveFavoriteStores(newIds);
      const store = storesPOI.find(s => s.id === storeId);
      if (result.isFavorite && store) void scheduleProximityAlert(store.name);
      void Haptics.notificationAsync(
        result.isFavorite ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
    } catch {
      setFavoriteStoreIds(prev => wasFav ? [...prev, storeId] : prev.filter(id => id !== storeId));
    } finally {
      setTogglingFav(false);
    }
  };

  const loadStores = useCallback(async (coords: { latitude: number; longitude: number }, radius = 15) => {
    try {
      const data = await getSupabaseNearbyStores(coords.latitude, coords.longitude, radius);
      setStoresPOI(data.length > 0 ? data.map((s: Store) => storeToStorePOI(s, coords)) : FALLBACK_STORES_POI);
    } catch {
      setStoresPOI(FALLBACK_STORES_POI);
    }
  }, []);

  const handleRegionChange = useCallback((region: Region) => {
    setCurrentLatDelta(region.latitudeDelta);

    // Haptic sponsorisé : si le centre de la carte passe à ≤ 200m d'un magasin sponsorisé
    mapCenterRef.current = { lat: region.latitude, lng: region.longitude };
    const nearest = storesPOI.find(
      (s) =>
        s.isSponsored &&
        haversineKm(region.latitude, region.longitude, s.coordinate.latitude, s.coordinate.longitude) <= 0.2,
    );
    if (nearest && nearest.id !== lastSponsoredHaptic.current) {
      lastSponsoredHaptic.current = nearest.id;
      void Haptics.selectionAsync();
    } else if (!nearest) {
      lastSponsoredHaptic.current = null;
    }

    if (bbDebounceRef.current) clearTimeout(bbDebounceRef.current);
    bbDebounceRef.current = setTimeout(() => {
      setMapBounds({
        north: region.latitude + region.latitudeDelta / 2,
        south: region.latitude - region.latitudeDelta / 2,
        east:  region.longitude + region.longitudeDelta / 2,
        west:  region.longitude - region.longitudeDelta / 2,
      });
    }, 300);

    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      if (!userCoords) return;
      // Cap : si le viewport couvre plus de ~100 km, on ne requête pas Supabase
      if (region.latitudeDelta > MAX_LAT_DELTA_FOR_QUERY) return;
      const bb: BoundingBox = {
        north: region.latitude + region.latitudeDelta / 2,
        south: region.latitude - region.latitudeDelta / 2,
        east:  region.longitude + region.longitudeDelta / 2,
        west:  region.longitude - region.longitudeDelta / 2,
      };
      getStoresInRegion(bb, region.latitudeDelta)
        .then((geoStores) => {
          const ref = userCoords;
          if (geoStores.length > 0) {
            setStoresPOI(geoStores.map((s) => storeToStorePOI(s, ref)));
          }
        })
        .catch(() => {});
    }, 600);
  }, [userCoords]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const fallback = { latitude: 46.160, longitude: -1.150 };
        if (status !== 'granted') {
          setLocationDenied(true);
          setUserCoords(fallback);
          void loadStores(fallback);
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserCoords(coords);
        void loadStores(coords);
      } catch {
        const fallback = { latitude: 46.160, longitude: -1.150 };
        setUserCoords(fallback);
        void loadStores(fallback);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStores]);

  // Recharger quand rayon change
  useEffect(() => {
    if (userCoords) void loadStores(userCoords, searchRadius);
  }, [searchRadius]);

  // Animer la fiche magasin (carte)
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeStore ? 0 : 500,
      useNativeDriver: true, tension: 65, friction: 10,
    }).start();
  }, [activeStore, slideAnim]);

  // Ouvrir/fermer le tiroir de filtres
  const openFilterSheet = () => {
    setShowFilterSheet(true);
    Animated.spring(filterSheetAnim, { toValue: 0, friction: 9, useNativeDriver: true }).start();
  };
  const closeFilterSheet = () => {
    Animated.timing(filterSheetAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start(
      () => setShowFilterSheet(false)
    );
  };

  const traceWazeRoute = (store: StorePOI) => {
    if (!userCoords) return;
    setActiveStore(store);
    const nodes = [
      userCoords,
      { latitude: userCoords.latitude + (store.coordinate.latitude - userCoords.latitude) * 0.25, longitude: userCoords.longitude + (store.coordinate.longitude - userCoords.longitude) * 0.05 },
      { latitude: userCoords.latitude + (store.coordinate.latitude - userCoords.latitude) * 0.60, longitude: userCoords.longitude + (store.coordinate.longitude - userCoords.longitude) * 0.85 },
      store.coordinate,
    ];
    setRouteCoords(nodes);
    mapRef.current?.animateToRegion({
      latitude: (userCoords.latitude + store.coordinate.latitude) / 2 - 0.005,
      longitude: (userCoords.longitude + store.coordinate.longitude) / 2,
      latitudeDelta: Math.abs(userCoords.latitude - store.coordinate.latitude) * 1.9,
      longitudeDelta: Math.abs(userCoords.longitude - store.coordinate.longitude) * 1.9,
    }, 600);
  };

  // Prix inventory filtrés par rayon sélectionné → Map storeId→price
  const inventoryPrices = useMemo(() => {
    const map = new Map<string, number>();
    const keywords = selectedRayon !== 'all' ? RAYON_KEYWORDS[selectedRayon] : [];
    for (const r of inventoryResults) {
      if (keywords.length === 0 || keywords.some((k) => r.productName.toLowerCase().includes(k))) {
        map.set(r.storeId, r.price);
      }
    }
    return map;
  }, [inventoryResults, selectedRayon]);

  // Mode carte : Découverte (aucun filtre actif) vs Recherche (filtre actif)
  const mapMode = useMemo<MapMode>(
    () => (selectedBrands.length > 0 || filterAntiGaspi || productQuery.length > 1 ? 'search' : 'discovery'),
    [selectedBrands, filterAntiGaspi, productQuery]
  );

  // Filtrage + tri
  const filteredStores = useMemo(() => {
    let result = storesPOI.filter((store) => {
      const matchesAntiGaspi = filterAntiGaspi ? store.hasAntiGaspi : true;
      const matchesBrand = selectedBrands.length > 0
        ? selectedBrands.includes(store.brand.toLowerCase())
        : true;
      const matchesCategory = selectedCategory === 'all'
        ? true
        : (BRAND_CATEGORIES[store.brand.toLowerCase()] ?? []).includes(selectedCategory);
      return matchesAntiGaspi && matchesBrand && matchesCategory;
    });

    if (sortBy === 'savings_abs') result = [...result].sort((a, b) => b.savedAmount - a.savedAmount);
    if (sortBy === 'savings_pct') result = [...result].sort((a, b) => {
      const pctA = a.basketPrice > 0 ? (a.savedAmount / a.basketPrice) * 100 : 0;
      const pctB = b.basketPrice > 0 ? (b.savedAmount / b.basketPrice) * 100 : 0;
      return pctB - pctA;
    });
    if (sortBy === 'distance') result = [...result].sort((a, b) => a.durationMinutes - b.durationMinutes);

    return result;
  }, [storesPOI, filterAntiGaspi, selectedBrands, sortBy, selectedCategory]);

  // Injection des prix inventory dans basketPrice quand productQuery est actif
  const displayStores = useMemo(() => {
    if (inventoryPrices.size === 0) return filteredStores;
    return filteredStores.map((s) => {
      const ip = inventoryPrices.get(s.id);
      return ip != null ? { ...s, basketPrice: ip } : { ...s, basketPrice: 0 };
    });
  }, [filteredStores, inventoryPrices]);

  // Filtre géographique pour la feuille liste — synchronisé avec la bounding box visible
  const visibleStores = useMemo(() => {
    if (!mapBounds) return displayStores;
    return displayStores.filter(
      (s) =>
        s.coordinate.latitude  >= mapBounds.south &&
        s.coordinate.latitude  <= mapBounds.north &&
        s.coordinate.longitude >= mapBounds.west  &&
        s.coordinate.longitude <= mapBounds.east,
    );
  }, [displayStores, mapBounds]);

  // Tri combiné distance (40 %) + économies (60 %) pour la feuille liste
  const sortedVisibleStores = useMemo(() => {
    if (visibleStores.length === 0) return visibleStores;
    const maxDur = Math.max(...visibleStores.map((s) => s.durationMinutes), 1);
    const maxSav = Math.max(...visibleStores.map((s) => s.savedAmount), 1);
    return [...visibleStores].sort((a, b) => {
      const scoreA = 0.4 * (1 - a.durationMinutes / maxDur) + 0.6 * (a.savedAmount / maxSav);
      const scoreB = 0.4 * (1 - b.durationMinutes / maxDur) + 0.6 * (b.savedAmount / maxSav);
      return scoreB - scoreA;
    });
  }, [visibleStores]);

  // Prix minimum parmi les résultats inventory (pour badge "Meilleur Prix")
  const minInventoryPrice = useMemo(() => {
    if (productQuery.length < 2 || inventoryPrices.size === 0) return 0;
    const prices = Array.from(inventoryPrices.values()).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [inventoryPrices, productQuery]);

  // Clustering spatial pour la vue carte
  const mapItems = useMemo(
    () => computeClusters(displayStores, currentLatDelta),
    [displayStores, currentLatDelta]
  );

  // Données de la vue liste : stores + pub injectée à l'index 1
  const listData = useMemo((): ListItem[] => {
    const items = displayStores.map((s): ListItem => ({ kind: 'store', data: s }));
    if (adSlot && !isPremium) {
      const insertAt = Math.min(1, items.length);
      return [
        ...items.slice(0, insertAt),
        { kind: 'ad', data: adSlot },
        ...items.slice(insertAt),
      ];
    }
    return items;
  }, [filteredStores, adSlot, isPremium]);

  const activeFilterCount = (filterAntiGaspi ? 1 : 0) + selectedBrands.length + (searchRadius !== 15 ? 1 : 0) + (sortBy !== 'distance' ? 1 : 0) + (selectedCategory !== 'all' ? 1 : 0);

  if (loading || !userCoords) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={styles.loadingText}>Initialisation du radar...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ── Map view ──────────────────────────────────────────── */}
      {viewMode === 'map' && (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          customMapStyle={wazeStylingAsphalt}
          initialRegion={{ ...userCoords, latitudeDelta: 0.045, longitudeDelta: 0.045 }}
          showsUserLocation showsMyLocationButton={false}
          onMapReady={handleMapReady}
          onPress={() => { setActiveStore(null); setRouteCoords([]); }}
          onRegionChangeComplete={handleRegionChange}
        >
          <Circle center={userCoords} radius={1800} strokeColor="rgba(56,189,248,0.2)" fillColor="rgba(56,189,248,0.04)" />
          {routeCoords.length > 0 && (
            <Polyline coordinates={routeCoords} strokeColor="#38BDF8" strokeWidth={7} lineCap="round" lineJoin="round" />
          )}
          {mapItems.map((item) => {
            if (item.type === 'cluster') {
              return (
                <Marker
                  key={item.key}
                  coordinate={item.coordinate}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <ClusterMarker count={item.count} />
                </Marker>
              );
            }
            if (item.type === 'sponsored_cluster') {
              return (
                <Marker
                  key={item.key}
                  coordinate={item.coordinate}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  zIndex={9}
                >
                  <SponsoredClusterMarker
                    count={item.count}
                    promoTotal={item.promoTotal}
                    brandLetter={item.brandLetter}
                  />
                </Marker>
              );
            }
            const store = item.data;
            const isSelected = activeStore?.id === store.id;
            if (store.isSponsored) {
              return (
                <Marker
                  key={store.id}
                  coordinate={store.coordinate}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/store/${store.id}`);
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                  zIndex={10}
                  tracksViewChanges={isSelected}
                >
                  <SponsoredMapMarker isSelected={isSelected} />
                </Marker>
              );
            }
            return (
              <Marker
                key={store.id}
                coordinate={store.coordinate}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/store/${store.id}`);
                }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={isSelected || markersNeedRefresh}
              >
                <StoreMapMarker
                  store={store}
                  isSelected={isSelected}
                  mode={mapMode}
                  isMinPrice={
                    productQuery.length > 1 &&
                    store.basketPrice > 0 &&
                    minInventoryPrice > 0 &&
                    store.basketPrice === minInventoryPrice
                  }
                />
              </Marker>
            );
          })}
        </MapView>
      )}

      {/* ── List view ─────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <FlatList
          data={listData}
          keyExtractor={(item) =>
            item.kind === 'store' ? item.data.id : `ad-${item.data.id}`
          }
          renderItem={({ item }) => {
            if (item.kind === 'ad') {
              return (
                <NativeAdCard
                  ad={item.data}
                  onClose={() => setAdSlot(null)}
                />
              );
            }
            const store = item.data;
            return (
              <StoreListCard
                store={store}
                isFavorite={favoriteStoreIds.includes(store.id)}
                onPress={() => {
                  setViewMode('map');
                  setTimeout(() => traceWazeRoute(store), 150);
                }}
                onToggleFav={() => void handleToggleFav(store.id)}
              />
            );
          }}
          contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 120 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialIcons name="store" size={48} color="#CBD5E1" />
              <Text style={styles.loadingText}>Aucun magasin trouvé</Text>
            </View>
          }
        />
      )}

      {/* ── Bannière Mode Découverte (non-connecté) ───────────── */}
      {!user && !discoveryBannerDismissed && (
        <Animated.View
          style={[
            styles.discoveryBanner,
            { top: insets.top + 106, opacity: bannerOpacity, transform: [{ translateY: bannerTransY }] },
          ]}
        >
          <MaterialIcons name="explore" size={15} color="#38BDF8" />
          <Text style={styles.discoveryBannerTxt} numberOfLines={2}>
            Mode Découverte — Connectez-vous pour voir les prix et signaler des promos
          </Text>
          <TouchableOpacity
            onPress={() => setDiscoveryBannerDismissed(true)}
            hitSlop={10}
          >
            <MaterialIcons name="close" size={15} color="rgba(148,163,184,0.8)" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── GPS warning ───────────────────────────────────────── */}
      {locationDenied && (
        <View style={styles.gpsBanner}>
          <MaterialIcons name="location-off" size={14} color="#FFFFFF" />
          <Text style={styles.gpsBannerText}>Position par defaut — activez la localisation pour de meilleurs resultats.</Text>
        </View>
      )}

      {/* ── Floating HUD ──────────────────────────────────────── */}
      <View style={[styles.floatingHud, { top: insets.top + 10 }]}>
        <View style={styles.topRow}>
          {/* Barre de recherche produit */}
          <View style={[styles.searchContainer, { flex: 1 }]}>
            {productSearchLoading
              ? <ActivityIndicator size="small" color="#1D9E75" />
              : <Ionicons name="search" size={20} color={productQuery.length > 0 ? '#1D9E75' : '#64748B'} />
            }
            <TextInput
              style={styles.productInput}
              placeholder="Nutella, lait, yaourt…"
              placeholderTextColor="#94A3B8"
              value={productQuery}
              onChangeText={setProductQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {productQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setProductQuery('')} hitSlop={8} style={styles.clearBtn}>
                <MaterialIcons name="close" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ) : onScan ? (
              <TouchableOpacity onPress={onScan} hitSlop={8} style={styles.scanButton}>
                <Ionicons name="camera-outline" size={18} color="#1D9E75" />
              </TouchableOpacity>
            ) : null}
            {productQuery.length === 0 && <View style={styles.liveIndicator} />}
          </View>

          {/* Toggle carte/liste */}
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setViewMode(v => v === 'map' ? 'list' : 'map')}
            activeOpacity={0.8}
          >
            <MaterialIcons name={viewMode === 'map' ? 'list' : 'map'} size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity
            style={[styles.pill, filterAntiGaspi && styles.pillActiveAntiGaspi]}
            onPress={() => setFilterAntiGaspi(!filterAntiGaspi)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="eco" size={16} color={filterAntiGaspi ? '#FFFFFF' : '#10B981'} />
            <Text style={[styles.pillText, filterAntiGaspi && styles.pillTextActive]}>Anti-Gaspi</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.pill, activeFilterCount > 0 && styles.pillActiveBrand]} onPress={openFilterSheet} activeOpacity={0.8}>
            <MaterialIcons name="tune" size={16} color={activeFilterCount > 0 ? '#FFFFFF' : '#475569'} />
            <Text style={[styles.pillText, activeFilterCount > 0 && styles.pillTextActive]}>
              Filtres{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.pill, searchRadius !== 15 && styles.pillActiveBrand]} onPress={openFilterSheet} activeOpacity={0.8}>
            <MaterialIcons name="radio-button-checked" size={16} color={searchRadius !== 15 ? '#FFFFFF' : '#475569'} />
            <Text style={[styles.pillText, searchRadius !== 15 && styles.pillTextActive]}>{searchRadius} km</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Rayon chips — visible quand la barre est focalisée ou en mode recherche */}
        {(searchFocused || productQuery.length > 0) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rayonRow}>
            {RAYON_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.rayonChip, selectedRayon === r.id && styles.rayonChipActive]}
                onPress={() => { setSelectedRayon(r.id); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.8}
              >
                <Text style={styles.rayonChipEmoji}>{r.emoji}</Text>
                <Text style={[styles.rayonChipTxt, selectedRayon === r.id && styles.rayonChipTxtActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Dropdown historique de recherche */}
        <Animated.View
          style={[
            styles.historyDropdown,
            { opacity: historyOpacity, transform: [{ translateY: historyTransY }] },
          ]}
          pointerEvents={searchFocused && productQuery.length === 0 && searchHistory.length > 0 ? 'auto' : 'none'}
        >
          {searchHistory.map((term) => (
            <TouchableOpacity
              key={term}
              style={styles.historyItem}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setProductQuery(term);
                setSearchFocused(false);
              }}
            >
              <MaterialIcons name="history" size={14} color="#94A3B8" />
              <Text style={styles.historyItemTxt}>{term}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>

      {/* ── Fiche magasin (carte) ─────────────────────────────── */}
      {viewMode === 'map' && (
        <Animated.View style={[styles.bentoGuidance, { transform: [{ translateY: slideAnim }] }]}>
          {activeStore && (
            <View>
              <View style={styles.pullBar} />

              {/* Bannière partenaire sponsorisé */}
              {activeStore.isSponsored && (
                <View style={styles.sponsoredPanel}>
                  <View style={styles.sponsoredPanelHeader}>
                    <MaterialIcons name="verified" size={16} color="#FF6B00" />
                    <Text style={styles.sponsoredPanelTitle}>Offre Partenaire Exclusive</Text>
                  </View>
                  {activeStore.sponsorBannerUrl ? (
                    <Image
                      source={{ uri: activeStore.sponsorBannerUrl }}
                      style={styles.sponsorBannerImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.sponsorBannerPlaceholder}>
                      <MaterialIcons name="local-offer" size={28} color="#FFB800" />
                      <Text style={styles.sponsorBannerPlaceholderTxt}>
                        Offre exclusive disponible en magasin — montrez cet écran en caisse !
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.bentoHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleBadgeRow}>
                    <Text style={styles.bentoTitle}>{activeStore.name}</Text>
                    <View style={[styles.hoursBadge, { backgroundColor: getBrandPalette(activeStore.brand).light }]}>
                      <Text style={[styles.hoursText, { color: getBrandPalette(activeStore.brand).main }]}>Ouvert</Text>
                    </View>
                  </View>
                  <Text style={styles.bentoSub}>{activeStore.address} · {activeStore.city}</Text>

                  {/* Badge "Non géré" si aucun propriétaire */}
                  {!activeStore.ownerId && (
                    <View style={styles.unmanagedBadge}>
                      <MaterialIcons name="warning-amber" size={12} color="#D97706" />
                      <Text style={styles.unmanagedBadgeTxt}>Non géré par le propriétaire</Text>
                    </View>
                  )}
                </View>
                <View style={styles.rightCluster}>
                  <TouchableOpacity onPress={() => void handleToggleFav(activeStore.id)} disabled={togglingFav} hitSlop={10} style={styles.favButton}>
                    <MaterialIcons
                      name={favoriteStoreIds.includes(activeStore.id) ? 'star' : 'star-border'}
                      size={26} color={favoriteStoreIds.includes(activeStore.id) ? '#F59E0B' : '#94A3B8'}
                    />
                  </TouchableOpacity>
                  {activeStore.basketPrice > 0 && (
                    <View style={styles.priceCluster}>
                      <Text style={styles.priceValue}>{activeStore.basketPrice.toFixed(2)}€</Text>
                      <Text style={styles.priceSubLabel}>Panier</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.bentoGrid}>
                <View style={styles.bentoCell}>
                  <MaterialIcons name="directions-car" size={20} color="#4F46E5" />
                  <Text style={styles.cellValue}>{activeStore.durationMinutes} min</Text>
                  <Text style={styles.cellLabel}>{activeStore.distanceText}</Text>
                </View>
                <View style={styles.bentoCell}>
                  <MaterialIcons name="verified-user" size={20} color="#10B981" />
                  <Text style={styles.cellValue}>{activeStore.reliabilityScore}%</Text>
                  <Text style={styles.cellLabel}>Fiabilité</Text>
                </View>
                <View style={styles.bentoCell}>
                  <MaterialIcons name="local-fire-department" size={20} color="#EF4444" />
                  <Text style={styles.cellValue}>{activeStore.promoCount}</Text>
                  <Text style={styles.cellLabel}>Promos</Text>
                </View>
              </View>

              {activeStore.savedAmount > 0 && (
                <View style={styles.savingBanner}>
                  <Ionicons name="sparkles" size={16} color="#FFE082" />
                  <Text style={styles.savingBannerText}>
                    Economies : <Text style={{ fontWeight: '900' }}>+{activeStore.savedAmount.toFixed(2)} EUR</Text>
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: getBrandPalette(activeStore.brand).main }]}
                activeOpacity={0.8}
                onPress={() => trackStoreEvent(activeStore.id, 'click')}
              >
                <FontAwesome5 name="location-arrow" size={14} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>DÉMARRER</Text>
              </TouchableOpacity>

              {/* Bouton de revendication (uniquement si non géré) */}
              {!activeStore.ownerId && (
                <TouchableOpacity
                  style={styles.claimBtn}
                  onPress={() => void handleClaimStore(activeStore)}
                  activeOpacity={0.85}
                  disabled={claimingStore}
                >
                  {claimingStore ? (
                    <ActivityIndicator size="small" color="#FF6B00" />
                  ) : (
                    <MaterialIcons name="business-center" size={16} color="#FF6B00" />
                  )}
                  <Text style={styles.claimBtnTxt}>
                    {claimingStore ? "Revendication en cours…" : "Gérant ? Prenez le contrôle de cette fiche"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Animated.View>
      )}

      {/* ── Filter Sheet ──────────────────────────────────────── */}
      <FilterSheet
        visible={showFilterSheet}
        anim={filterSheetAnim}
        selectedBrands={selectedBrands}
        radius={searchRadius}
        sortBy={sortBy}
        selectedCategory={selectedCategory}
        onToggleBrand={(b) => setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])}
        onSetRadius={setSearchRadius}
        onSetSort={setSortBy}
        onSetCategory={setSelectedCategory}
        onClose={closeFilterSheet}
        onReset={() => {
          setSelectedBrands([]);
          setSearchRadius(15);
          setSortBy('distance');
          setFilterAntiGaspi(false);
          setSelectedCategory('all');
        }}
      />

      {/* ── Mini-panel Panier Malin ───────────────────────────────────── */}
      {cart.totalItems > 0 && !activeStore && optimResult && (
        <TouchableOpacity
          style={styles.cartPanel}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/cart' as any);
          }}
          activeOpacity={0.88}
        >
          <MaterialIcons name="shopping-cart" size={16} color="#1D9E75" />
          <View style={{ flex: 1 }}>
            <Text style={styles.cartPanelTxt} numberOfLines={1}>
              {cart.totalItems} article{cart.totalItems > 1 ? 's' : ''} · Moins cher chez{' '}
              <Text style={styles.cartPanelStore}>{optimResult.bestStore.name}</Text>
            </Text>
            {optimResult.savings > 0.01 && (
              <Text style={styles.cartPanelSavings}>
                Économie estimée : −{optimResult.savings.toFixed(2)} €
              </Text>
            )}
          </View>
          <View style={styles.cartPanelBadge}>
            <Text style={styles.cartPanelPrice}>{optimResult.totalPrice.toFixed(2)} €</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Store List Bottom Sheet ───────────────────────────────── */}
      {viewMode === 'map' && !activeStore && (
        <Animated.View
          style={[slsStyles.sheet, { transform: [{ translateY: storeListY }] }]}
        >
          {/* Zone de drag — poignée + résumé */}
          <View {...sheetHandleRef.panHandlers} style={slsStyles.handleZone}>
            <View style={slsStyles.handlePill} />
            <View style={slsStyles.headerRow}>
              <Text style={slsStyles.headerTxt}>
                {sortedVisibleStores.length} commerce{sortedVisibleStores.length !== 1 ? 's' : ''} dans la zone
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const toValue = storeListExpanded ? SHEET_HIDDEN_Y : 0;
                  Animated.spring(storeListY, { toValue, friction: 9, tension: 70, useNativeDriver: true }).start();
                  storeListYValue.current = toValue;
                  setStoreListExpanded(!storeListExpanded);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                hitSlop={12}
              >
                <MaterialIcons
                  name={storeListExpanded ? 'keyboard-arrow-down' : 'keyboard-arrow-up'}
                  size={22}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Liste scrollable (activée seulement quand la feuille est dépliée) */}
          <ScrollView
            scrollEnabled={storeListExpanded}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={slsStyles.listContent}
          >
            {sortedVisibleStores.slice(0, 30).map((store) => {
              const pal = getBrandPalette(store.brand);
              return (
                <TouchableOpacity
                  key={store.id}
                  style={slsStyles.storeRow}
                  onPress={() => {
                    setActiveStore(store);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[slsStyles.brandDot, { backgroundColor: pal.main }]} />
                  <View style={slsStyles.rowInfo}>
                    <Text style={slsStyles.rowName} numberOfLines={1}>{store.name}</Text>
                    <Text style={slsStyles.rowSub} numberOfLines={1}>{store.city} · {store.durationMinutes} min</Text>
                  </View>
                  {store.promoCount > 0 && (
                    <View style={[slsStyles.promoTag, { backgroundColor: pal.light }]}>
                      <Text style={[slsStyles.promoTagTxt, { color: pal.main }]}>+{store.promoCount}</Text>
                    </View>
                  )}
                  <MaterialIcons name="chevron-right" size={16} color="#CBD5E1" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      <BottomNav active="search" onNavigate={onNavigate} />
    </View>
  );
}

// ============================================================
// STYLESHEET
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { marginTop: 16, fontSize: 14, color: '#64748B', fontWeight: '500' },
  map: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 90 },

  gpsBanner: {
    position: 'absolute', bottom: 80, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#334155', borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 14, zIndex: 10,
  },
  gpsBannerText: { flex: 1, fontSize: 12, color: '#FFFFFF', lineHeight: 17 },

  discoveryBanner: {
    position: 'absolute', left: 16, right: 16, zIndex: 11,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)',
    paddingVertical: 9, paddingHorizontal: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  discoveryBannerTxt: {
    flex: 1, fontSize: 12, color: '#CBD5E1', lineHeight: 16, fontWeight: '500',
  },


  floatingHud: { position: 'absolute', left: 16, right: 16, zIndex: 10, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 28, paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  productInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 0 },
  clearBtn: { padding: 4, marginRight: 4 },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  scanButton: { padding: 4, marginRight: 4 },
  viewToggle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },

  filterRow: { flexDirection: 'row', gap: 8 },
  pill: {
    backgroundColor: '#FFFFFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2,
  },
  pillActiveAntiGaspi: { backgroundColor: '#10B981' },
  pillActiveBrand: { backgroundColor: '#4F46E5' },
  pillText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  pillTextActive: { color: '#FFFFFF' },

  bentoGuidance: {
    position: 'absolute', bottom: 80, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '60%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
    paddingBottom: 16,
  },
  pullBar: { height: 4, width: 40, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  bentoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12 },
  titleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  bentoTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  hoursBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  hoursText: { fontSize: 12, fontWeight: '600' },
  bentoSub: { fontSize: 13, color: '#64748B' },
  rightCluster: { alignItems: 'flex-end', gap: 6 },
  favButton: { alignSelf: 'flex-end' },
  priceCluster: { alignItems: 'flex-end' },
  priceValue: { fontSize: 24, fontWeight: '900', color: '#1D9E75' },
  priceSubLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },
  bentoGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  bentoCell: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  cellValue: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cellLabel: { fontSize: 11, color: '#64748B', textAlign: 'center' },
  savingBanner: { marginHorizontal: 16, backgroundColor: '#FEF3C7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  savingBannerText: { flex: 1, fontSize: 13, color: '#92400E' },
  actionButton: { marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── Panneau sponsorisé
  sponsoredPanel: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#FED7AA',
  },
  sponsoredPanelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#FFF7ED',
  },
  sponsoredPanelTitle: { fontSize: 13, fontWeight: '800', color: '#C2410C' },
  sponsorBannerImage: {
    width: '100%', height: 120,
  },
  sponsorBannerPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: '#FFFBEB',
  },
  sponsorBannerPlaceholderTxt: {
    flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17, fontWeight: '500',
  },

  // ── Badge "Non géré" + bouton revendication
  unmanagedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 4,
  },
  unmanagedBadgeTxt: { fontSize: 11, fontWeight: '600', color: '#D97706' },
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: '#FED7AA', borderRadius: 12,
    backgroundColor: '#FFF7ED',
  },
  claimBtnTxt: { flex: 1, fontSize: 13, fontWeight: '700', color: '#FF6B00', lineHeight: 18 },

  // ── Rayon chips
  rayonRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  rayonChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2, elevation: 2,
  },
  rayonChipActive: { backgroundColor: '#1D9E75' },
  rayonChipEmoji: { fontSize: 13 },
  rayonChipTxt:       { fontSize: 12, color: '#475569', fontWeight: '600' },
  rayonChipTxtActive: { color: '#FFFFFF' },

  // ── Historique de recherche (dropdown)
  historyDropdown: {
    position: 'absolute', top: 54, left: 0, right: 44,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13, shadowRadius: 12, elevation: 8,
    zIndex: 20,
  },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 11,
  },
  historyItemTxt: { fontSize: 14, color: '#334155', fontWeight: '500' },

  // ── Mini-panel Panier Malin
  cartPanel: {
    position: 'absolute', bottom: 80, left: 12, right: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: '#1D9E75', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
    borderWidth: 1, borderColor: '#D1FAE5',
    zIndex: 11,
  },
  cartPanelTxt:     { fontSize: 12, color: '#334155', fontWeight: '600' },
  cartPanelStore:   { fontWeight: '800', color: '#1D9E75' },
  cartPanelSavings: { fontSize: 11, color: '#10B981', marginTop: 1 },
  cartPanelBadge:   {
    backgroundColor: '#ECFDF5', borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 5,
    alignItems: 'center',
  },
  cartPanelPrice: { fontSize: 13, fontWeight: '800', color: '#10B981' },
});

// ── Store List Bottom Sheet styles ────────────────────────────────────────────

const slsStyles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 80, left: 0, right: 0,
    height: SHEET_FULL_H,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.10, shadowRadius: 10, elevation: 12,
    zIndex: 8,
    overflow: 'hidden',
  },
  handleZone: {
    paddingTop: 10, paddingBottom: 10, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  handlePill: {
    width: 36, height: 4, backgroundColor: '#CBD5E1',
    borderRadius: 2, alignSelf: 'center', marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTxt: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  listContent: { paddingBottom: 16 },
  storeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
    gap: 10,
  },
  brandDot: { width: 10, height: 10, borderRadius: 5 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  rowSub:  { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  promoTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  promoTagTxt: { fontSize: 10, fontWeight: '800' },
});
