import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';
import { Card, Button, Badge } from '@/components/primitives';
import { Header } from '@/components/features';
import { optimizeBasket } from '@/services/api';
import type { OptimizationResult, StoreBreakdown } from '@/types';
import { formatPrice } from '@/utils/formatters';

export interface BasketOptimizationScreenProps {
  listId: string;
  listName?: string;
  onBack: () => void;
  onValidateRoute: () => void;
  onViewMap: () => void;
}

type Scenario = 'standard' | 'malin';

export default function BasketOptimizationScreen({
  listId,
  listName,
  onBack,
  onValidateRoute,
  onViewMap,
}: BasketOptimizationScreenProps) {
  const insets = useSafeAreaInsets();
  const [scenario, setScenario] = useState<Scenario>('malin');
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    optimizeBasket(listId)
      .then((data) => setResult(data))
      .catch((err) => {
        console.error('[BasketOptimizationScreen] optimizeBasket a échoué', err);
        setError(err instanceof Error ? err.message : "Impossible de calculer l'optimisation pour le moment.");
      })
      .finally(() => setLoading(false));
  }, [listId]);

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title={listName ?? 'Optimisation'} onBackPress={onBack} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>Calcul de la meilleure répartition...</Text>
        </View>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={styles.root}>
        <Header title={listName ?? 'Optimisation'} onBackPress={onBack} />
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={40} color={colors.text.tertiary} />
          <Text style={styles.centerText}>{error ?? "Impossible de calculer l'optimisation pour le moment."}</Text>
        </View>
      </View>
    );
  }

  const hasPrices = result.optimizedOption.breakdown.length > 0;

  if (!hasPrices) {
    return (
      <View style={styles.root}>
        <Header title={listName ?? 'Optimisation'} onBackPress={onBack} />
        <View style={styles.centerContainer}>
          <MaterialIcons name="local-offer" size={40} color={colors.text.tertiary} />
          <Text style={styles.centerText}>
            Aucun prix relevé pour les articles de cette liste. Scanne des prix en rayon pour activer l'optimisation.
          </Text>
        </View>
      </View>
    );
  }

  const totalItemCount = result.optimizedOption.breakdown.reduce((sum, store) => sum + (store.itemCount ?? 0), 0);

  const standardStores: StoreBreakdown[] = [
    {
      storeId: result.standardOption.storeId ?? 'standard',
      storeName: result.standardOption.storeName,
      logoUri: result.standardOption.logoUri ?? result.standardOption.logoUrl,
      subtotal: result.standardOption.total,
      itemCount: totalItemCount,
      thumbnails: result.optimizedOption.breakdown.flatMap((store) => store.thumbnails ?? []),
    },
  ];

  const currentStores = scenario === 'malin' ? result.optimizedOption.breakdown : standardStores;
  const isMalin = scenario === 'malin';

  return (
    <View style={styles.root}>
      <Header title={listName ?? 'Optimisation'} onBackPress={onBack} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card
          padding="lg"
          shadow="lg"
          backgroundColor={isMalin ? colors.primary : colors.text.primary}
          borderRadius={radii.xl}
          style={styles.banner}
        >
          <View style={styles.bannerHeaderRow}>
            <MaterialIcons name={isMalin ? 'auto-awesome' : 'shopping-bag'} size={18} color={colors.white} />
            <Text style={styles.bannerLabel}>
              {isMalin ? 'Optimisation trouvée' : 'Scénario mono-magasin'}
            </Text>
          </View>
          <Text style={styles.bannerValue}>
            {isMalin ? `Économie possible : ${formatPrice(result.totalSavings)}` : `Total panier : ${formatPrice(result.standardOption.total)}`}
          </Text>
          <Text style={styles.bannerCaption}>
            {isMalin
              ? 'En répartissant tes achats entre plusieurs enseignes.'
              : `Tous tes articles centralisés chez ${result.standardOption.storeName}.`}
          </Text>
        </Card>

        <View style={styles.scenarioRow}>
          <Card
            padding="md"
            shadow="sm"
            onPress={() => setScenario('standard')}
            borderColor={scenario === 'standard' ? colors.primary : colors.border.default}
            borderWidth={scenario === 'standard' ? 2 : 1}
            style={styles.scenarioCard}
          >
            <Text style={styles.scenarioLabel}>Panier unique</Text>
            <Text style={styles.scenarioStoreName} numberOfLines={1}>{result.standardOption.storeName}</Text>
            <Text style={styles.scenarioPrice}>{formatPrice(result.standardOption.total)}</Text>
          </Card>

          <Card
            padding="md"
            shadow="sm"
            onPress={() => setScenario('malin')}
            borderColor={scenario === 'malin' ? colors.primary : colors.border.default}
            borderWidth={scenario === 'malin' ? 2 : 1}
            style={styles.scenarioCard}
          >
            {result.totalSavings > 0 && (
              <Badge label="Recommandé" variant="primary" style={styles.recommendedBadge} />
            )}
            <Text style={[styles.scenarioLabel, styles.scenarioLabelActive]}>Multi-magasins</Text>
            <Text style={styles.scenarioStoreName}>{result.optimizedOption.storeCount} magasins</Text>
            <Text style={[styles.scenarioPrice, styles.scenarioPriceActive]}>{formatPrice(result.optimizedOption.total)}</Text>
          </Card>
        </View>

        <Text style={styles.sectionTitle}>
          {isMalin ? 'Détail par magasin' : 'Articles regroupés'}
        </Text>

        {currentStores.map((store, index) => (
          <View key={store.storeId}>
            <Card padding="md" shadow="sm" style={styles.storeCard}>
              <View style={styles.storeRow}>
                <View style={styles.storeLogoBox}>
                  {store.logoUri ? (
                    <Image source={{ uri: store.logoUri }} style={styles.storeLogo} />
                  ) : (
                    <MaterialIcons name="storefront" size={24} color={colors.text.secondary} />
                  )}
                </View>
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName} numberOfLines={1}>{store.storeName}</Text>
                  <Text style={styles.storeMeta}>
                    {store.itemCount ?? 0} article{(store.itemCount ?? 0) > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.storeSubtotal}>{formatPrice(store.subtotal)}</Text>
              </View>

              {store.thumbnails && store.thumbnails.length > 0 && (
                <View style={styles.thumbRow}>
                  {store.thumbnails.map((uri, i) => (
                    <Image key={`${store.storeId}-${i}`} source={{ uri }} style={styles.productThumb} />
                  ))}
                </View>
              )}
            </Card>

            {isMalin && index < currentStores.length - 1 && (
              <View style={styles.pathRow}>
                <MaterialIcons name="route" size={16} color={colors.text.tertiary} />
                <Text style={styles.pathText}>Prochain arrêt</Text>
              </View>
            )}
          </View>
        ))}

        <Button
          label="Voir sur la carte"
          icon="map"
          variant="outline"
          onPress={onViewMap}
          fullWidth
          style={styles.mapButton}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
        <Button
          label={isMalin ? 'Valider ce trajet malin' : 'Confirmer ce magasin'}
          icon="check-circle"
          variant="primary"
          fullWidth
          onPress={onValidateRoute}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[3],
  },
  centerText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
  },
  banner: {
    marginBottom: spacing[5],
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  bannerLabel: {
    ...typography.labelSmall,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
  },
  bannerValue: {
    ...typography.h2,
    color: colors.white,
    marginBottom: spacing[1],
  },
  bannerCaption: {
    ...typography.bodyMedium,
    color: 'rgba(255,255,255,0.85)',
  },
  scenarioRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  scenarioCard: {
    flex: 1,
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
  },
  scenarioLabel: {
    ...typography.labelSmall,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  scenarioLabelActive: {
    color: colors.primary,
  },
  scenarioStoreName: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing[1],
  },
  scenarioPrice: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  scenarioPriceActive: {
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  storeCard: {
    marginBottom: spacing[2],
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  storeLogoBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogo: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.text.primary,
  },
  storeMeta: {
    ...typography.captionLarge,
    color: colors.text.secondary,
    marginTop: 2,
  },
  storeSubtotal: {
    ...typography.h4,
    color: colors.text.primary,
  },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  productThumb: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.gray[200],
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingLeft: spacing[6],
    paddingVertical: spacing[2],
  },
  pathText: {
    ...typography.captionLarge,
    color: colors.text.tertiary,
  },
  mapButton: {
    marginTop: spacing[2],
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});
