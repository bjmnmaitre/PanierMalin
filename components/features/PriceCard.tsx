// components/features/PriceCard.tsx
// Display product prices with freshness indicators and store info
// Combines Card + Badge primitives for a rich price display

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card, Badge } from '@/components/primitives';
import { colors, spacing, typography } from '@/design';

export interface PriceCardProps {
  productName: string;
  price: number;
  storeName: string;
  freshness: 'fresh' | 'recent' | 'old';
  distance?: number;
  onPress?: () => void;
  priceDropPercentage?: number;
  testID?: string;
}

/**
 * Professional PriceCard Component
 * Displays a product price with store info and freshness indicator
 *
 * @example
 * <PriceCard
 *   productName="Nutella 400g"
 *   price={4.29}
 *   storeName="Leclerc Ivry"
 *   freshness="fresh"
 *   distance={1.2}
 *   priceDropPercentage={15}
 *   onPress={() => navigateToProduct(id)}
 * />
 */
const PriceCard = React.memo(function PriceCard({
  productName,
  price,
  storeName,
  freshness,
  distance,
  onPress,
  priceDropPercentage,
  testID,
}: PriceCardProps) {

  // Get freshness badge color
  const freshnessColor = useMemo(() => {
    switch (freshness) {
      case 'fresh':
        return colors.fresh_green;
      case 'recent':
        return colors.fresh_orange;
      case 'old':
        return colors.fresh_gray;
      default:
        return colors.gray[300];
    }
  }, [freshness]);

  // Get freshness label
  const freshnessLabel = useMemo(() => {
    switch (freshness) {
      case 'fresh':
        return 'Fraîche (< 6h)';
      case 'recent':
        return 'Récente (< 5j)';
      case 'old':
        return 'À vérifier';
      default:
        return '';
    }
  }, [freshness]);

  // Get freshness icon
  const freshnessIcon = useMemo(() => {
    switch (freshness) {
      case 'fresh':
        return 'check-circle' as const;
      case 'recent':
        return 'schedule' as const;
      case 'old':
        return 'info' as const;
      default:
        return 'help' as const;
    }
  }, [freshness]);

  // Format price
  const formattedPrice = useMemo(() => {
    return `${price.toFixed(2).replace('.', ',')} €`;
  }, [price]);

  return (
    <Card
      padding="md"
      shadow="sm"
      onPress={onPress}
      testID={testID}
    >
      {/* Header: Store name + distance + freshness dot */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.storeName} numberOfLines={1}>
            {storeName}
          </Text>
          {distance !== undefined && (
            <View style={styles.distanceRow}>
              <MaterialIcons
                name="location-on"
                size={12}
                color={colors.text.secondary}
              />
              <Text style={styles.distance}>
                {distance.toFixed(1)} km
              </Text>
            </View>
          )}
        </View>

        {/* Freshness badge dot */}
        <View
          style={[
            styles.freshnessBadge,
            { backgroundColor: freshnessColor },
          ]}
        >
          <MaterialIcons
            name={freshnessIcon}
            size={10}
            color={colors.white}
          />
        </View>
      </View>

      {/* Product name */}
      <Text style={styles.productName} numberOfLines={2}>
        {productName}
      </Text>

      {/* Price section */}
      <View style={styles.priceSection}>
        <Text style={styles.price}>
          {formattedPrice}
        </Text>

        {priceDropPercentage !== undefined && priceDropPercentage > 0 && (
          <Badge
            label={`-${priceDropPercentage}%`}
            variant="success"
            size="sm"
          />
        )}
      </View>

      {/* Freshness info text */}
      <Text style={styles.freshnessText}>
        {freshnessLabel}
      </Text>
    </Card>
  );
});

PriceCard.displayName = 'PriceCard';

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },

  headerLeft: {
    flex: 1,
    marginRight: spacing[2],
  },

  storeName: {
    ...typography.labelMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },

  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  },

  distance: {
    ...typography.captionSmall,
    color: colors.text.secondary,
    marginLeft: spacing[1],
  },

  freshnessBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  productName: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },

  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },

  price: {
    ...typography.displaySmall,
    color: colors.primary,
    fontWeight: '700',
  },

  freshnessText: {
    ...typography.captionSmall,
    color: colors.text.tertiary,
  },
});

export default PriceCard;