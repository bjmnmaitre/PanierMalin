// screens/BasketOptimizationScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import { optimizeBasket } from '../services/api';

// ============================================================================
// TYPES INTERNES (Évite les erreurs d'importation)
// ============================================================================

export interface StoreBreakdown {
  storeId: string;
  storeName: string;
  subtotal: number;
  itemCount: number;
  distanceKm?: number;
  logoUri?: string | null;
  thumbnails?: string[];
}

export interface OptimizationResult {
  totalSavings: number;
  standardOption: {
    storeName: string;
    total: number;
  };
  optimizedOption: {
    storeCount: number;
    total: number;
    breakdown: StoreBreakdown[];
  };
}

function formatPrice(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}€`;
}

interface Props {
  basketIdOrListId: string;
  onNavigate: (tab: TabKey) => void;
  onValidateRoute: () => void;
  onViewMap: () => void;
}

export default function BasketOptimizationScreen({ 
  basketIdOrListId, 
  onNavigate, 
  onValidateRoute, 
  onViewMap 
}: Props) {
  const [selectedScenario, setSelectedScenario] = useState<'standard' | 'malin'>('malin');
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    optimizeBasket(basketIdOrListId)
      .then((r) => setResult(r as unknown as OptimizationResult))
      .catch((err) => console.error('[BasketOptimizationScreen] optimizeBasket failed', err))
      .finally(() => setLoading(false));
  }, [basketIdOrListId]);

  if (loading || !result) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[Typography.bodyMd, { marginTop: 12, color: Colors.textSecondary }]}>
          Calcul de l'optimisation IA en cours...
        </Text>
      </View>
    );
  }

  // Structure stricte et isolée
  const currentStores: StoreBreakdown[] = selectedScenario === 'malin' 
    ? result.optimizedOption.breakdown 
    : [
        {
          storeId: 'standard_mono',
          storeName: result.standardOption.storeName,
          subtotal: result.standardOption.total,
          itemCount: result.optimizedOption.breakdown.reduce((acc: number, curr: StoreBreakdown) => acc + curr.itemCount, 0),
          distanceKm: 0,
          logoUri: null,
          thumbnails: result.optimizedOption.breakdown.flatMap((b: StoreBreakdown) => b.thumbnails ?? []),
        }
      ];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarPlaceholder}>
            <MaterialIcons name="account-circle" size={32} color={Colors.primary} />
          </View>
          <Text style={[Typography.h1, { color: Colors.primary }]}>Panier Malin</Text>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Bandeau magique contextualisé */}
        <View style={[styles.magicBanner, selectedScenario === 'standard' && styles.magicBannerStandard]}>
          <View style={styles.magicHeaderRow}>
            <MaterialIcons 
              name={selectedScenario === 'malin' ? "auto-awesome" : "shopping-bag"} 
              size={18} 
              color={Colors.white} 
            />
            <Text style={[Typography.labelSm, { color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase' }]}>
              {selectedScenario === 'malin' ? "Optimisation trouvée" : "Scénario Mono-Magasin"}
            </Text>
          </View>
          <Text style={[Typography.h1, { color: Colors.white, marginBottom: 4 }]}>
            {selectedScenario === 'malin' 
              ? `Économie totale possible : ${formatPrice(result.totalSavings)}`
              : `Total panier : ${formatPrice(result.standardOption.total)}`
            }
          </Text>
          <Text style={[Typography.bodyMd, { color: 'rgba(255,255,255,0.85)' }]}>
            {selectedScenario === 'malin' 
              ? "En répartissant vos achats intelligemment selon vos critères."
              : `Tous vos articles centralisés chez ${result.standardOption.storeName}.`
            }
          </Text>
        </View>

        {/* Comparaison de scénarios */}
        <View style={styles.scenarioRow}>
          <TouchableOpacity
            style={[styles.scenarioCard, selectedScenario === 'standard' && styles.scenarioCardSelected]}
            onPress={() => setSelectedScenario('standard')}
            activeOpacity={0.85}
          >
            <Text style={[Typography.labelSm, { color: Colors.textSecondary }]}>OPTION STANDARD</Text>
            <Text style={[Typography.bodyMd, { marginTop: 4, fontWeight: '600' }]} numberOfLines={1}>
              {result.standardOption.storeName}
            </Text>
            <Text style={[Typography.h2, { marginTop: 6, color: Colors.textPrimary }]}>
              {formatPrice(result.standardOption.total)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scenarioCard, styles.scenarioCardMalin, selectedScenario === 'malin' && styles.scenarioCardSelected]}
            onPress={() => setSelectedScenario('malin')}
            activeOpacity={0.85}
          >
            <View style={styles.recommendedBadge}>
              <Text style={[Typography.labelSm, { color: Colors.white, textTransform: 'uppercase', fontSize: 9 }]}>
                Recommandé
              </Text>
            </View>
            <Text style={[Typography.labelSm, { color: Colors.primary }]}>OPTION MALIN</Text>
            <Text style={[Typography.bodyMd, { marginTop: 4, fontWeight: '600' }]}>
              {result.optimizedOption.storeCount} magasins
            </Text>
            <Text style={[Typography.h2, { color: Colors.primary, marginTop: 6 }]}>
              {formatPrice(result.optimizedOption.total)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Détail du trajet ou de la liste */}
        <Text style={[Typography.h2, { marginBottom: 12 }]}>
          {selectedScenario === 'malin' ? "Détails du trajet optimisé" : "Articles commandés"}
        </Text>

        {currentStores.map((store: StoreBreakdown, index: number) => (
          <React.Fragment key={store.storeId}>
            <View style={styles.storeCard}>
              <View style={styles.storeLogoBox}>
                {store.logoUri ? (
                  <Image source={{ uri: store.logoUri }} style={styles.storeLogo} />
                ) : (
                  <MaterialIcons name="store" size={24} color={Colors.textSecondary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.storeTopRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[Typography.bodyLg, { fontWeight: '600' }]}>{store.storeName}</Text>
                    <Text style={Typography.caption}>
                      {store.itemCount} articles {store.distanceKm ? `• ${store.distanceKm} km` : ''}
                    </Text>
                  </View>
                  <Text style={Typography.h2}>{formatPrice(store.subtotal)}</Text>
                </View>
                
                {store.thumbnails && store.thumbnails.length > 0 && (
                  <View style={styles.thumbRow}>
                    {store.thumbnails.map((uri: string, i: number) => (
                      <Image key={i} source={{ uri }} style={styles.productThumb} />
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* Indicateur d'itinéraire entre deux points */}
            {selectedScenario === 'malin' && index < currentStores.length - 1 && (
              <View style={styles.pathIndicatorRow}>
                <View style={styles.pathDots}>
                  <View style={styles.pathDot} />
                  <View style={styles.pathDashedLine} />
                  <View style={styles.pathDot} />
                </View>
                <View style={styles.pathPill}>
                  <MaterialIcons name="directions-car" size={16} color={Colors.textSecondary} />
                  <Text style={Typography.caption}>Quelques minutes de trajet estimées</Text>
                </View>
              </View>
            )}
          </React.Fragment>
        ))}

        {/* Mini aperçu carte */}
        <TouchableOpacity style={styles.mapPreview} onPress={onViewMap} activeOpacity={0.9}>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80',
            }}
            style={styles.mapImage}
          />
          <View style={styles.mapOverlayPill}>
            <MaterialIcons name="map" size={18} color={Colors.primary} />
            <Text style={[Typography.caption, { fontWeight: '700', color: Colors.textPrimary }]}>
              Visualiser le trajet complet
            </Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Bouton de validation d'itinéraire */}
      <TouchableOpacity style={styles.validateButton} onPress={onValidateRoute} activeOpacity={0.9}>
        <MaterialIcons name="navigation" size={20} color={Colors.white} />
        <Text style={[Typography.bodyLg, { color: Colors.white, fontWeight: '600' }]}>
          {selectedScenario === 'malin' ? "Valider ce trajet malin" : "Confirmer ce magasin"}
        </Text>
      </TouchableOpacity>

      <BottomNav active="scanner" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarPlaceholder: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerButton: { padding: 4 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  magicBanner: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.card,
    padding: 20,
    marginBottom: 24,
    ...Shadows.active,
  },
  magicBannerStandard: {
    backgroundColor: '#5C6BC0',
  },
  magicHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  scenarioRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  scenarioCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: Radii.card,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  scenarioCardMalin: { backgroundColor: Colors.white, position: 'relative', overflow: 'hidden', ...Shadows.soft },
  scenarioCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.white },
  recommendedBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
  },
  storeCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 4,
    ...Shadows.soft,
  },
  storeLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogo: { width: 34, height: 34, resizeMode: 'contain' },
  storeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  thumbRow: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  productThumb: { width: 32, height: 32, borderRadius: 6, backgroundColor: Colors.border },
  pathIndicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 24, paddingVertical: 8 },
  pathDots: { alignItems: 'center', width: 6 },
  pathDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  pathDashedLine: { width: 1, height: 24, backgroundColor: Colors.border, marginVertical: 2 },
  pathPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  mapPreview: {
    height: 140,
    borderRadius: Radii.card,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 20,
    ...Shadows.soft,
  },
  mapImage: { width: '100%', height: '100%' },
  mapOverlayPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    ...Shadows.soft,
  },
  validateButton: {
    position: 'absolute',
    bottom: 92,
    left: 16,
    right: 16,
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.active,
    zIndex: 10,
  },
});