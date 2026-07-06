// components/features/OptimizationCard.tsx
// Displays a store optimization scenario (single-store vs multi-store)
// Used in the basket optimization screen to compare shopping options

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card, Badge } from '@/components/primitives';
import { colors, spacing, typography, radii, shadows } from '@/design';

export interface OptimizationCardItemBreakdown {
  storeId: string;
  storeName: string;
  logoUrl?: string;
  itemCount: number;
  distanceKm: number;
  subtotal: number;
}

export interface OptimizationCardProps {
  /** Is this the recommended/selected scenario */
  isSelected?: boolean;

  /** Label shown at top: e.g. "OPTION STANDARD" or "OPTION MALIN" */
  label: string;

  /** Total price for this scenario */
  total: number;

  /** Number of stores involved */
  storeCount: number;

  /** Store breakdown (only relevant for multi-store scenario) */
  breakdown?: OptimizationCardItemBreakdown[];

  /** Savings vs the other scenario (only shown on the optimized option) */
  savingsAmount?: number;

  /** Total distance / travel estimate */
  totalDistanceKm?: number;

  onPress?: () => void;
  testID?: string;
}

/**
 * Professional OptimizationCard Component
 *
 * @example
 * // Standard option (single store)
 * <OptimizationCard
 *   label="OPTION STANDARD"
 *   total={45.80}
 *   storeCount={1}
 * />
 *
 * @example
 * // Optimized option (multi-store, with savings)
 * <OptimizationCard
 *   label="OPTION MALIN"
 *   total={38.20}
 *   storeCount={3}
 *   savingsAmount={7.60}
 *   totalDistanceKm={4.2}
 *   isSelected
 *   breakdown={[...]}
 * />
 */
const OptimizationCard = React.memo(function OptimizationCard({
  isSelected = false,
  label,
  total,
  storeCount,
  breakdown,
  savingsAmount,
  totalDistanceKm,
  onPress,
  testID,
}: OptimizationCardProps) {

  const formattedTotal = useMemo(() => {
    return `${total.toFixed(2).replace('.', ',')} €`;
  }, [total]);

  const formattedSavings = useMemo(() => {
    if (savingsAmount === undefined) return null;
    return `-${savingsAmount.toFixed(2).replace('.', ',')} €`;
  }, [savingsAmount]);

  const isMalin = savingsAmount !== undefined && savingsAmount > 0;

  return (
    <Card
      padding="lg"
      shadow={isSelected ? 'lg' : 'sm'}
      onPress={onPress}
      testID={testID}
      style={isSelected ? styles.selectedCard : undefined}
      borderColor={isSelected ? colors.primary : undefined}
      borderWidth={isSelected ? 2 : undefined}
    >
      {/* Header: label + savings badge */}
      <View style={styles.header}>
        <Text style={[styles.label, isMalin && styles.labelMalin]}>
          {label}
        </Text>
        {formattedSavings && (
          <Badge label={formattedSavings} variant="success" size="sm" />
        )}
      </View>

      {/* Total price */}
      <Text style={[styles.total, isMalin && styles.totalMalin]}>
        {formattedTotal}
      </Text>

      {/* Store count + distance info */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialIcons name="storefront" size={14} color={colors.text.secondary} />
          <Text style={styles.metaText}>
            {storeCount} magasin{storeCount > 1 ? 's' : ''}
          </Text>
        </View>

        {totalDistanceKm !== undefined && (
          <View style={styles.metaItem}>
            <MaterialIcons name="navigation" size={14} color={colors.text.secondary} />
            <Text style={styles.metaText}>
              {totalDistanceKm.toFixed(1)} km
            </Text>
          </View>
        )}
      </View>

      {/* Store breakdown (multi-store only) */}
      {breakdown && breakdown.length > 0 && (
        <View style={styles.breakdownSection}>
          {breakdown.map((store, index) => (
            <View key={store.storeId} style={styles.breakdownRow}>
              {store.logoUrl ? (
                <Image source={{ uri: store.logoUrl }} style={styles.storeThumb} />
              ) : (
                <View style={styles.storeThumbPlaceholder}>
                  <MaterialIcons name="store" size={16} color={colors.gray[400]} />
                </View>
              )}

              <View style={styles.breakdownInfo}>
                <Text style={styles.breakdownStoreName} numberOfLines={1}>
                  {store.storeName}
                </Text>
                <Text style={styles.breakdownMeta}>
                  {store.itemCount} article{store.itemCount > 1 ? 's' : ''} · {store.distanceKm.toFixed(1)} km
                </Text>
              </View>

              <Text style={styles.breakdownSubtotal}>
                {store.subtotal.toFixed(2).replace('.', ',')} €
              </Text>

              {index < breakdown.length - 1 && (
                <View style={styles.pathDot} />
              )}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
});

OptimizationCard.displayName = 'OptimizationCard';

const styles = StyleSheet.create({
  selectedCard: {
    backgroundColor: colors.white,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },

  label: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },

  labelMalin: {
    color: colors.primary,
  },

  total: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },

  totalMalin: {
    color: colors.primary,
  },

  metaRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[2],
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  metaText: {
    ...typography.captionSmall,
    color: colors.text.secondary,
    marginLeft: spacing[1],
  },

  breakdownSection: {
    marginTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing[2],
  },

  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
    position: 'relative',
  },

  storeThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: spacing[2],
    backgroundColor: colors.gray[100],
  },

  storeThumbPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: spacing[2],
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },

  breakdownInfo: {
    flex: 1,
  },

  breakdownStoreName: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '600',
  },

  breakdownMeta: {
    ...typography.captionSmall,
    color: colors.text.tertiary,
  },

  breakdownSubtotal: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },

  pathDot: {
    position: 'absolute',
    left: 13,
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.dark,
  },
});

export default OptimizationCard;