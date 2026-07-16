import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Linking, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, shadows } from '@/design';
import type { Store } from '@/types';

export interface StoreDetailBottomSheetProps {
  store: Store | null;
  distanceKm?: number;
  onClose: () => void;
}

const SHEET_OFFSCREEN_OFFSET = 260;

export default function StoreDetailBottomSheet({ store, distanceKm, onClose }: StoreDetailBottomSheetProps) {
  const [visibleStore, setVisibleStore] = useState<Store | null>(store);
  const [visibleDistanceKm, setVisibleDistanceKm] = useState<number | undefined>(distanceKm);
  const translateY = useRef(new Animated.Value(store ? 0 : SHEET_OFFSCREEN_OFFSET)).current;

  useEffect(() => {
    if (store) {
      setVisibleStore(store);
      setVisibleDistanceKm(distanceKm);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 68,
        friction: 11,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: SHEET_OFFSCREEN_OFFSET,
        useNativeDriver: true,
        tension: 68,
        friction: 11,
      }).start(({ finished }: { finished: boolean }) => {
        if (finished) {
          setVisibleStore(null);
        }
      });
    }
  }, [store, distanceKm, translateY]);

  if (!visibleStore) {
    return null;
  }

  const handleOpenItinerary = () => {
    const label = encodeURIComponent(visibleStore.name);
    const destination = `${visibleStore.latitude},${visibleStore.longitude}`;

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${destination}`,
      android: `geo:0,0?q=${destination}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${destination}`,
    });

    if (!url) return;

    Linking.openURL(url).catch((error: unknown) => {
      console.warn("[StoreDetailBottomSheet] Impossible d'ouvrir l'itinéraire", error);
    });
  };

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="storefront" size={22} color={colors.white} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {visibleStore.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {visibleStore.brand}
            {visibleDistanceKm !== undefined ? ` · ${visibleDistanceKm.toFixed(1)} km` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer la fiche magasin">
          <MaterialIcons name="close" size={22} color={colors.text.secondary} />
        </Pressable>
      </View>

      <View style={styles.detailRow}>
        <MaterialIcons name="location-on" size={18} color={colors.text.secondary} />
        <Text style={styles.detailText} numberOfLines={2}>
          {visibleStore.address || 'Adresse non communiquée'}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <MaterialIcons name="schedule" size={18} color={colors.text.secondary} />
        <Text style={styles.detailText} numberOfLines={1}>
          {visibleStore.hours || 'Horaires non communiqués'}
        </Text>
      </View>

      <Pressable
        style={({ pressed }: { pressed: boolean }) => [styles.itineraryButton, pressed && styles.itineraryButtonPressed]}
        onPress={handleOpenItinerary}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir l'itinéraire vers ce magasin"
      >
        <MaterialIcons name="directions" size={20} color={colors.white} />
        <Text style={styles.itineraryButtonText}>Itinéraire</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
    ...shadows.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.gray[300],
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  detailText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    flex: 1,
  },
  itineraryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing[3],
    marginTop: spacing[3],
  },
  itineraryButtonPressed: {
    opacity: 0.85,
  },
  itineraryButtonText: {
    ...typography.labelLarge,
    color: colors.white,
  },
});
