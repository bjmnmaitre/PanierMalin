// components/features/StoreCard.tsx
// Store information card with logo, distance, rating, and availability
// Combines Card primitive for consistent styling

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, DimensionValue } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from '@/components/primitives';
import { colors, spacing, typography } from '@/design';

export interface StoreCardProps {
  name: string;
  logo?: string;
  distance: number;
  rating?: number;
  itemsAvailable?: number;
  totalItems?: number;
  onPress?: () => void;
  testID?: string;
}

/**
 * Professional StoreCard Component
 * Displays store info with availability bar and rating
 *
 * @example
 * <StoreCard
 *   name="Leclerc Ivry-sur-Seine"
 *   logo="https://..."
 *   distance={1.2}
 *   rating={4.3}
 *   itemsAvailable={8}
 *   totalItems={10}
 *   onPress={() => navigateToStore(id)}
 * />
 */
const StoreCard = React.memo(function StoreCard({
  name,
  logo,
  distance,
  rating,
  itemsAvailable,
  totalItems,
  onPress,
  testID,
}: StoreCardProps) {

  // Always a safe number - never null - so the width string is never "null%"
  const availabilityPercentage = useMemo<number>(() => {
    if (itemsAvailable === undefined || !totalItems || totalItems <= 0) return 0;
    return Math.round((itemsAvailable / totalItems) * 100);
  }, [itemsAvailable, totalItems]);

  const availabilityWidth = useMemo<DimensionValue>(
    () => `${availabilityPercentage}%` as DimensionValue,
    [availabilityPercentage]
  );

  const showAvailability = itemsAvailable !== undefined && totalItems !== undefined && totalItems > 0;

  const distanceColor = useMemo(() => {
    if (distance <= 1) return colors.success;
    if (distance <= 5) return colors.warning;
    return colors.error;
  }, [distance]);

  return (
    <Card
      padding="md"
      shadow="md"
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.topRow}>
        {logo && (
          <Image
            source={{ uri: logo }}
            style={styles.logo}
            resizeMode="cover"
          />
        )}

        <View style={styles.nameSection}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.distanceRow}>
            <MaterialIcons
              name="navigation"
              size={14}
              color={distanceColor}
            />
            <Text style={[styles.distance, { color: distanceColor }]}>
              {distance.toFixed(1)} km
            </Text>
          </View>
        </View>

        {rating !== undefined && (
          <View style={styles.ratingBadge}>
            <MaterialIcons
              name="star"
              size={14}
              color={colors.warning}
            />
            <Text style={styles.rating}>
              {rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {showAvailability && (
        <View style={styles.availabilitySection}>
          <View style={styles.availabilityBar}>
            <View
              style={[
                styles.availabilityFill,
                {
                  width: availabilityWidth,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.availabilityText}>
            {itemsAvailable}/{totalItems} articles disponibles
          </Text>
        </View>
      )}
    </Card>
  );
});

StoreCard.displayName = 'StoreCard';

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },

  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: spacing[2],
    backgroundColor: colors.gray[100],
  },

  nameSection: {
    flex: 1,
  },

  name: {
    ...typography.labelLarge,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },

  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  distance: {
    ...typography.captionSmall,
    marginLeft: spacing[1],
  },

  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 12,
  },

  rating: {
    ...typography.labelSmall,
    color: colors.warning,
    marginLeft: spacing[1],
  },

  availabilitySection: {
    marginTop: spacing[2],
  },

  availabilityBar: {
    height: 4,
    backgroundColor: colors.gray[200],
    borderRadius: 2,
    marginBottom: spacing[1],
    overflow: 'hidden',
  },

  availabilityFill: {
    height: '100%',
  },

  availabilityText: {
    ...typography.captionSmall,
    color: colors.text.secondary,
  },
});

export default StoreCard;