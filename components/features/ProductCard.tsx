// components/features/ProductCard.tsx
// Product display card with best price, nutriscore, and quick-add action

import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card, Badge } from '@/components/primitives';
import { colors, spacing, typography, radii } from '@/design';

export interface ProductCardProps {
  productName: string;
  brand?: string;
  imageUrl?: string;
  bestPrice: number;
  bestPriceStoreName?: string;
  nutriscore?: 'A' | 'B' | 'C' | 'D' | 'E';
  offerCount?: number;
  onPress?: () => void;
  onAddPress?: () => void;
  testID?: string;
}

/**
 * Professional ProductCard Component
 * Displays a product with its best available price and quick actions
 *
 * @example
 * <ProductCard
 *   productName="Nutella 400g"
 *   brand="Ferrero"
 *   imageUrl="https://..."
 *   bestPrice={4.29}
 *   bestPriceStoreName="Leclerc"
 *   nutriscore="E"
 *   offerCount={4}
 *   onPress={() => navigateToProduct(id)}
 *   onAddPress={() => addToList(id)}
 * />
 */
const ProductCard = React.memo(function ProductCard({
  productName,
  brand,
  imageUrl,
  bestPrice,
  bestPriceStoreName,
  nutriscore,
  offerCount,
  onPress,
  onAddPress,
  testID,
}: ProductCardProps) {

  // Nutriscore color mapping
  const nutriscoreColor = useMemo(() => {
    const colorMap: Record<string, string> = {
      A: colors.success,
      B: '#8BC34A',
      C: colors.warning,
      D: '#FF9800',
      E: colors.error,
    };
    return nutriscore ? colorMap[nutriscore] : colors.gray[300];
  }, [nutriscore]);

  const formattedPrice = useMemo(() => {
    return `${bestPrice.toFixed(2).replace('.', ',')} €`;
  }, [bestPrice]);

  return (
    <Card padding="sm" shadow="sm" onPress={onPress} testID={testID}>
      <View style={styles.row}>
        {/* Product image */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialIcons name="shopping-basket" size={24} color={colors.gray[300]} />
            </View>
          )}

          {/* Nutriscore badge */}
          {nutriscore && (
            <View style={[styles.nutriscoreBadge, { backgroundColor: nutriscoreColor }]}>
              <Text style={styles.nutriscoreText}>{nutriscore}</Text>
            </View>
          )}
        </View>

        {/* Product info */}
        <View style={styles.infoContainer}>
          {brand && (
            <Text style={styles.brand} numberOfLines={1}>
              {brand}
            </Text>
          )}
          <Text style={styles.productName} numberOfLines={2}>
            {productName}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formattedPrice}</Text>
            {bestPriceStoreName && (
              <Text style={styles.storeName} numberOfLines={1}>
                chez {bestPriceStoreName}
              </Text>
            )}
          </View>

          {offerCount !== undefined && offerCount > 1 && (
            <Badge
              label={`${offerCount} prix disponibles`}
              variant="info"
              size="sm"
              style={styles.offerBadge}
            />
          )}
        </View>

        {/* Quick add button */}
        {onAddPress && (
          <Pressable
            onPress={onAddPress}
            style={styles.addButton}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${productName} à la liste`}
          >
            <MaterialIcons name="add-circle" size={32} color={colors.primary} />
          </Pressable>
        )}
      </View>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  imageContainer: {
    width: 64,
    height: 64,
    marginRight: spacing[3],
    position: 'relative',
  },

  image: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.gray[50],
  },

  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.gray[50],
    justifyContent: 'center',
    alignItems: 'center',
  },

  nutriscoreBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },

  nutriscoreText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },

  infoContainer: {
    flex: 1,
    marginRight: spacing[2],
  },

  brand: {
    ...typography.captionSmall,
    color: colors.text.tertiary,
    marginBottom: 2,
  },

  productName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing[1],
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing[1],
  },

  price: {
    ...typography.priceSmall,
    color: colors.primary,
    marginRight: spacing[1],
  },

  storeName: {
    ...typography.captionSmall,
    color: colors.text.secondary,
    flexShrink: 1,
  },

  offerBadge: {
    alignSelf: 'flex-start',
  },

  addButton: {
    padding: spacing[1],
  },
});

export default ProductCard;