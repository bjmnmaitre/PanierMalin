import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, shadows } from '@/design';
import ModernBottomNav, { type TabKey } from '@/components/features/ModernBottomNav';
import { SearchBar } from '@/components/features';
import StoreDetailBottomSheet from '@/components/StoreDetailBottomSheet';
import { useAsync } from '@/hooks/useAsync';
import { getClosestStores } from '@/services/api';
import type { Store } from '@/types';

export interface MapScreenProps {
  onNavigate: (tab: TabKey) => void;
}

const FALLBACK_REGION = {
  latitude: 46.1601,
  longitude: -1.1511,
};

const BRAND_COLORS: Record<string, string> = {
  Leclerc: colors.secondary,
  Lidl: colors.tertiary,
  Carrefour: colors.tertiary_dark,
  'Intermarché': colors.primary_dark,
  Auchan: colors.secondary_dark,
  Aldi: colors.primary,
  Casino: colors.error,
  Monoprix: colors.primary_darker,
};

function getBrandColor(brand: string): string {
  return BRAND_COLORS[brand] ?? colors.tertiary;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function computeDistanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function MapScreen({ onNavigate }: MapScreenProps) {
  const router = useRouter();
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  const {
    data: stores,
    isLoading: isStoresLoading,
    execute: reloadStores,
  } = useAsync<Store[]>(
    () => (userCoords ? getClosestStores(userCoords.latitude, userCoords.longitude) : Promise.resolve([])),
    false
  );

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationDenied(true);
          setUserCoords(FALLBACK_REGION);
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.warn('[MapScreen] Géolocalisation indisponible, repli sur la position par défaut', error);
        setUserCoords(FALLBACK_REGION);
      } finally {
        setIsLocating(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (userCoords) {
      reloadStores();
    }
  }, [userCoords]);

  const storesWithDistance = useMemo(() => {
    if (!stores || !userCoords) return [];
    return stores
      .map((store) => ({ store, distanceKm: computeDistanceKm(userCoords, store) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [stores, userCoords]);

  const filteredStores = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return storesWithDistance;
    return storesWithDistance.filter(
      ({ store }) => store.name.toLowerCase().includes(query) || store.brand.toLowerCase().includes(query) || store.address.toLowerCase().includes(query)
    );
  }, [storesWithDistance, searchQuery]);

  const initialRegion: Region | undefined = userCoords
    ? {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }
    : undefined;

  const handleSelectStore = useCallback((store: Store) => {
    setSelectedStore(store);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedStore(null);
  }, []);

  if (isLocating || !userCoords) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Recherche des magasins autour de vous…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <MapView
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {filteredStores.map(({ store }) => (
            <Marker
              key={store.id}
              coordinate={{ latitude: store.latitude, longitude: store.longitude }}
              title={store.name}
              description={store.address}
              onPress={() => handleSelectStore(store)}
            >
              <View style={[styles.markerPin, { backgroundColor: getBrandColor(store.brand) }]}>
                <MaterialIcons name="storefront" size={16} color={colors.white} />
              </View>
            </Marker>
          ))}
        </MapView>

        <View style={styles.searchWrapper}>
          <SearchBar
            placeholder="Rechercher une enseigne, une ville…"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {locationDenied && (
          <View style={styles.noticeBanner}>
            <MaterialIcons name="info-outline" size={16} color={colors.text.inverse} />
            <Text style={styles.noticeText}>Position par défaut (Puilboreau) — activez la localisation pour de meilleurs résultats.</Text>
          </View>
        )}

        {isStoresLoading && (
          <View style={styles.storesLoadingBadge}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.storesLoadingText}>Chargement des magasins…</Text>
          </View>
        )}

        {!isStoresLoading && filteredStores.length === 0 && (
          <View style={styles.emptyBanner}>
            <MaterialIcons name="info-outline" size={18} color={colors.text.secondary} />
            <Text style={styles.emptyText}>Aucun magasin trouvé à proximité.</Text>
          </View>
        )}

        <Pressable
          style={styles.searchFab}
          onPress={() => router.push('/search')}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Recherche universelle"
        >
          <MaterialIcons name="search" size={26} color={colors.white} />
        </Pressable>

        <StoreDetailBottomSheet
          store={selectedStore}
          distanceKm={
            selectedStore ? storesWithDistance.find(({ store }) => store.id === selectedStore.id)?.distanceKm : undefined
          }
          onClose={handleCloseSheet}
        />
      </View>

      <ModernBottomNav active="map" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  mapArea: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    paddingHorizontal: spacing[6],
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginTop: spacing[3],
    textAlign: 'center',
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  searchWrapper: {
    position: 'absolute',
    top: spacing[6],
    left: spacing[4],
    right: spacing[4],
  },
  searchFab: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[4],
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  noticeBanner: {
    position: 'absolute',
    top: spacing[16],
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.gray[800],
    borderRadius: radii.lg,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  noticeText: {
    ...typography.captionLarge,
    color: colors.text.inverse,
    flex: 1,
  },
  storesLoadingBadge: {
    position: 'absolute',
    bottom: spacing[6],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.white,
    borderRadius: radii.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    ...shadows.md,
  },
  storesLoadingText: {
    ...typography.captionLarge,
    color: colors.text.secondary,
  },
  emptyBanner: {
    position: 'absolute',
    bottom: spacing[6],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.white,
    borderRadius: radii.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    ...shadows.md,
  },
  emptyText: {
    ...typography.captionLarge,
    color: colors.text.secondary,
  },
});