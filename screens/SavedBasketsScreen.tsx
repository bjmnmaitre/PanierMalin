import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';
import { Card, Button } from '@/components/primitives';
import { GamificationBanner } from '@/components/features';
import ModernBottomNav, { type TabKey } from '@/components/features/ModernBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getSavedBaskets } from '@/services/api';
import type { SavedBasketData } from '@/types';

export interface SavedBasketsScreenProps {
  /** Navigation vers un autre onglet (barre de navigation) */
  onNavigate: (tab: TabKey) => void;
  onEditBasket: (basketId: string) => void;
  /** Lance l'optimisation réelle (navigation vers app/optimize.tsx) */
  onOptimize: (basketId: string) => void;
  onCreateBasket: () => void;
}

const ICON_STYLES: Record<string, { background: string; color: string }> = {
  'shopping-basket': { background: colors.primary_light, color: colors.primary },
  celebration: { background: colors.secondary_light, color: colors.secondary },
  'bakery-dining': { background: colors.tertiary_light, color: colors.tertiary },
};
const DEFAULT_ICON_STYLE = { background: colors.primary_light, color: colors.primary };

function resolveIconName(icon: string): keyof typeof MaterialIcons.glyphMap {
  return (icon && icon in MaterialIcons.glyphMap ? icon : 'shopping-basket') as keyof typeof MaterialIcons.glyphMap;
}

export default function SavedBasketsScreen({ onNavigate, onEditBasket, onOptimize, onCreateBasket }: SavedBasketsScreenProps) {
  const insets = useSafeAreaInsets();
  const { profile, isLoading: isProfileLoading } = useAuth();

  const { data: baskets, isLoading: isBasketsLoading } = useAsync<SavedBasketData[]>(getSavedBaskets);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing[4] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Mes paniers habituels</Text>
          <Text style={styles.subtitle}>Sélectionne un panier et lance l'optimisation en un tap</Text>
        </View>

        <GamificationBanner
          sentinelLevel={profile?.sentinelLevel}
          totalPoints={profile?.totalPoints}
          loading={isProfileLoading}
        />

        {isBasketsLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
        ) : !baskets || baskets.length === 0 ? (
          <Text style={styles.emptyText}>
            Aucun panier habituel pour l'instant — crée-en un pour lancer l'optimisation en un tap la prochaine fois.
          </Text>
        ) : (
          <View style={styles.basketsContainer}>
            {baskets.map((basket) => {
              const iconStyle = ICON_STYLES[basket.icon] ?? DEFAULT_ICON_STYLE;

              return (
                <Card key={basket.id} padding="md" shadow="sm" style={styles.basketCard}>
                  <View style={styles.basketTopRow}>
                    <View style={styles.basketInfoRow}>
                      <View style={[styles.iconBox, { backgroundColor: iconStyle.background }]}>
                        <MaterialIcons name={resolveIconName(basket.icon)} size={24} color={iconStyle.color} />
                      </View>
                      <View style={styles.basketTextBlock}>
                        <Text style={styles.basketName} numberOfLines={1}>
                          {basket.name}
                        </Text>
                        <View style={styles.basketMetaRow}>
                          <MaterialIcons name="format-list-bulleted" size={14} color={colors.text.secondary} />
                          <Text style={styles.basketMetaText}>
                            {basket.itemCount} article{basket.itemCount > 1 ? 's' : ''}
                          </Text>
                          {basket.isShared && (
                            <>
                              <View style={styles.dotSeparator} />
                              <MaterialIcons name="group" size={14} color={colors.tertiary} />
                              <Text style={styles.basketSharedText}>
                                {basket.collaboratorCount} membre{basket.collaboratorCount > 1 ? 's' : ''}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => onEditBasket(basket.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Modifier ${basket.name}`}
                    >
                      <Text style={styles.editLink}>Modifier</Text>
                    </Pressable>
                  </View>

                  <Button
                    label="Lancer l'optimisation"
                    icon="bolt"
                    variant="primary"
                    fullWidth
                    onPress={() => onOptimize(basket.id)}
                  />
                </Card>
              );
            })}
          </View>
        )}

        <Text style={styles.hintText}>
          Tes paniers habituels te permettent de comparer les prix de tes indispensables dans tous les magasins alentours en un clic.
        </Text>
      </ScrollView>

      <View style={styles.createButtonBar}>
        <Button label="Créer un panier habituel" icon="add" variant="primary" fullWidth onPress={onCreateBasket} />
      </View>

      <ModernBottomNav active="lists" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[6],
  },
  header: {
    marginBottom: spacing[4],
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  loadingIndicator: {
    marginVertical: spacing[6],
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing[6],
  },
  basketsContainer: {
    gap: spacing[3],
  },
  basketCard: {
    width: '100%',
  },
  basketTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
  },
  basketInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flex: 1,
    paddingRight: spacing[2],
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  basketTextBlock: {
    flex: 1,
  },
  basketName: {
    ...typography.labelLarge,
    color: colors.text.primary,
  },
  basketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  basketMetaText: {
    ...typography.captionLarge,
    color: colors.text.secondary,
  },
  basketSharedText: {
    ...typography.captionLarge,
    color: colors.tertiary,
    fontWeight: '600',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.tertiary,
    marginHorizontal: 2,
  },
  editLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  hintText: {
    ...typography.captionLarge,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    lineHeight: 16,
  },
  createButtonBar: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    backgroundColor: colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});
