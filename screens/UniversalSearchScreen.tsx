// screens/UniversalSearchScreen.tsx
//
// Recherche de produits dans la base Supabase (par nom ou marque).
// Accessible via app/search.tsx (modal depuis l'onglet "Je cherche").

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';
import { Card, Input, Button, Badge } from '@/components/primitives';
import { Header } from '@/components/features';
import { searchProducts } from '@/services/api';
import type { Product } from '@/types';

export interface UniversalSearchScreenProps {
  onBack: () => void;
  onSelectProduct: (ean: string) => void;
}

const SUGGESTED_KEYWORDS = ['Lait', 'Yaourt', 'Pâtes', 'Farine', 'Céréales', 'Beurre'];

const NUTRISCORE_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: '#2E7D32', text: '#FFFFFF' },
  B: { bg: '#7CB342', text: '#FFFFFF' },
  C: { bg: '#F9A825', text: '#FFFFFF' },
  D: { bg: '#EF6C00', text: '#FFFFFF' },
  E: { bg: '#C62828', text: '#FFFFFF' },
};

function AnimatedResultCard({ children }: { children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function UniversalSearchScreen({
  onBack,
  onSelectProduct,
}: UniversalSearchScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const bannerAnim = useRef(new Animated.Value(0)).current;

  const runSearch = async (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed || isSearching) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const data = await searchProducts(trimmed);
      setResults(data);

      if (data.length > 0) {
        bannerAnim.setValue(0);
        Animated.spring(bannerAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }).start();
      }
    } catch (error) {
      console.error('[UniversalSearchScreen] Recherche échouée', error);
      setSearchError('La recherche a échoué. Vérifie ta connexion et réessaie.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestion = (keyword: string) => {
    setSearchQuery(keyword);
    runSearch(keyword);
  };

  const bannerScale = bannerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <View style={styles.root}>
      <Header
        title="Recherche produits"
        subtitle={
          results.length > 0
            ? `${results.length} produit${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}`
            : undefined
        }
        onBackPress={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          leftIcon="search"
          rightIcon={searchQuery ? 'close' : undefined}
          onRightIconPress={() => {
            setSearchQuery('');
            setResults([]);
            setHasSearched(false);
          }}
          placeholder="Lait entier, Nutella, Danone…"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <Button
          label="Rechercher"
          variant="primary"
          icon="search"
          onPress={() => runSearch(searchQuery)}
          loading={isSearching}
          disabled={!searchQuery.trim()}
          fullWidth
          style={styles.searchButton}
        />

        <View style={styles.suggestedRow}>
          {SUGGESTED_KEYWORDS.map((keyword) => (
            <Pressable key={keyword} onPress={() => handleSuggestion(keyword)}>
              <Badge label={keyword} variant="info" />
            </Pressable>
          ))}
        </View>

        {/* États vides */}
        {!hasSearched && !isSearching && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <MaterialIcons name="local-grocery-store" size={28} color={colors.text.tertiary} />
            <Text style={styles.stateText}>
              Recherche un produit par son nom ou sa marque pour comparer les prix.
            </Text>
          </Card>
        )}

        {isSearching && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Recherche en cours…</Text>
          </Card>
        )}

        {searchError && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <MaterialIcons name="warning" size={28} color={colors.error} />
            <Text style={styles.stateText}>{searchError}</Text>
          </Card>
        )}

        {!isSearching && hasSearched && !searchError && results.length === 0 && (
          <Card padding="lg" shadow="sm" style={styles.stateCard}>
            <MaterialIcons name="search-off" size={28} color={colors.text.tertiary} />
            <Text style={styles.stateText}>
              Aucun produit trouvé pour "{searchQuery}".{'\n'}Essaie un autre terme.
            </Text>
          </Card>
        )}

        {/* Bannière résultats */}
        {!isSearching && results.length > 0 && (
          <Animated.View
            style={[
              styles.celebrationBanner,
              { opacity: bannerAnim, transform: [{ scale: bannerScale }] },
            ]}
          >
            <MaterialIcons name="check-circle" size={16} color={colors.white} />
            <Text style={styles.celebrationText}>
              {results.length} produit{results.length > 1 ? 's' : ''} — tape pour comparer les prix
            </Text>
          </Animated.View>
        )}

        {/* Résultats */}
        {!isSearching &&
          results.map((product) => {
            const ns = product.nutriscore;
            const nsColors = ns ? NUTRISCORE_COLORS[ns] : null;

            return (
              <AnimatedResultCard key={product.id}>
                <Pressable onPress={() => onSelectProduct(product.ean)}>
                  <Card padding="md" shadow="sm" style={styles.resultCard}>
                    <View style={styles.resultRow}>
                      <View style={styles.resultInfo}>
                        <Text style={styles.productName}>{product.name}</Text>
                        {product.brand && (
                          <Text style={styles.productBrand}>{product.brand}</Text>
                        )}
                        {product.category && (
                          <Text style={styles.productCategory}>{product.category}</Text>
                        )}
                        <Text style={styles.productEan}>EAN {product.ean}</Text>
                      </View>

                      <View style={styles.resultRight}>
                        {nsColors && ns && (
                          <View style={[styles.nutriscoreBadge, { backgroundColor: nsColors.bg }]}>
                            <Text style={[styles.nutriscoreText, { color: nsColors.text }]}>
                              {ns}
                            </Text>
                          </View>
                        )}
                        <MaterialIcons
                          name="chevron-right"
                          size={22}
                          color={colors.text.tertiary}
                        />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              </AnimatedResultCard>
            );
          })}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[8],
  },
  searchButton: {
    marginTop: spacing[3],
  },
  suggestedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  stateText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  celebrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    marginTop: spacing[3],
    alignSelf: 'center',
  },
  celebrationText: {
    ...typography.labelMedium,
    color: colors.white,
  },
  resultCard: {
    marginTop: spacing[3],
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  resultInfo: {
    flex: 1,
    gap: spacing[1],
  },
  productName: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
  productBrand: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  productCategory: {
    ...typography.captionSmall,
    color: colors.text.secondary,
  },
  productEan: {
    ...typography.captionSmall,
    color: colors.text.tertiary,
  },
  resultRight: {
    alignItems: 'center',
    gap: spacing[2],
  },
  nutriscoreBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nutriscoreText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
