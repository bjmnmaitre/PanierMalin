import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';
import { Card } from '@/components/primitives';
import ModernBottomNav, { type TabKey } from '@/components/features/ModernBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getMyLists } from '@/services/api';
import { formatPrice } from '@/utils/formatters';

export interface HomePlaceholderScreenProps {
  onNavigate: (tab: TabKey) => void;
  onOptimize: () => void;
}

interface QuickAction {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  backgroundColor: string;
  onPress: () => void;
}

export default function HomePlaceholderScreen({ onNavigate, onOptimize }: HomePlaceholderScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isLoading: isProfileLoading } = useAuth();

  const {
    data: lists,
    isLoading: isListsLoading,
  } = useAsync(getMyLists);

  const firstName = profile?.displayName?.trim().split(' ')[0];
  const greeting = firstName ? `Bonjour ${firstName} 👋` : 'Bonjour 👋';

  const savingsLabel = isProfileLoading || !profile ? '…' : formatPrice(profile.totalSavings);
  const activeListsCount = isListsLoading || !lists
    ? '…'
    : String(lists.filter((list) => !list.isArchived).length);
  const pointsLabel = isProfileLoading || !profile ? '…' : String(profile.totalPoints);

  const quickActions: QuickAction[] = [
    {
      key: 'optimize',
      title: 'Optimiser mon panier',
      subtitle: 'Trouver le magasin le moins cher autour de vous',
      icon: 'tune',
      backgroundColor: colors.primary,
      onPress: onOptimize,
    },
    {
      key: 'scanner',
      title: 'Scanner un produit',
      subtitle: 'Comparer les prix et vérifier la fraîcheur',
      icon: 'qr-code-scanner',
      backgroundColor: colors.secondary,
      onPress: () => onNavigate('scanner'),
    },
    {
      key: 'map',
      title: 'Carte des supermarchés',
      subtitle: 'Voir les magasins partenaires à proximité',
      icon: 'map',
      backgroundColor: colors.tertiary,
      onPress: () => onNavigate('map'),
    },
    {
      key: 'community',
      title: 'Communauté & défis',
      subtitle: 'Partager vos bons plans avec la communauté',
      icon: 'people-outline',
      backgroundColor: colors.secondary_dark,
      onPress: () => onNavigate('community'),
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing[4] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subtitle}>Prêt à faire des économies aujourd'hui ?</Text>
        </View>

        <Card
          padding="md"
          shadow="sm"
          onPress={() => router.push('/search')}
          style={styles.searchBarCard}
        >
          <View style={styles.searchBarRow}>
            <MaterialIcons name="search" size={22} color={colors.text.tertiary} />
            <Text style={styles.searchBarPlaceholder}>Boulangerie, pharmacie, artisan...</Text>
          </View>
        </Card>

        <Card
          padding="lg"
          shadow="lg"
          backgroundColor={colors.primary}
          borderRadius={radii['2xl']}
          style={styles.savingsCard}
        >
          <Text style={styles.savingsLabel}>Vos économies ce mois-ci</Text>
          <Text style={styles.savingsValue}>{savingsLabel}</Text>
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activeListsCount}</Text>
              <Text style={styles.statLabel}>Listes actives</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pointsLabel}</Text>
              <Text style={styles.statLabel}>Points fidélité</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Fonctionnalités malines</Text>

        {quickActions.map((action) => (
          <Card
            key={action.key}
            padding="md"
            shadow="sm"
            backgroundColor={action.backgroundColor}
            borderRadius={radii.xl}
            onPress={action.onPress}
            style={styles.actionCard}
          >
            <View style={styles.actionRow}>
              <View style={styles.actionIconContainer}>
                <MaterialIcons name={action.icon} size={28} color={colors.white} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.7)" />
            </View>
          </Card>
        ))}
      </ScrollView>

      <ModernBottomNav active="home" onNavigate={onNavigate} />
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
    paddingBottom: spacing[8],
  },
  header: {
    marginBottom: spacing[6],
  },
  greeting: {
    ...typography.h1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  searchBarCard: {
    marginBottom: spacing[4],
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  searchBarPlaceholder: {
    ...typography.bodyMedium,
    color: colors.text.tertiary,
  },
  savingsCard: {
    marginBottom: spacing[6],
  },
  savingsLabel: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
  },
  savingsValue: {
    ...typography.displaySmall,
    color: colors.white,
    marginTop: spacing[1],
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: spacing[4],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...typography.h3,
    color: colors.white,
  },
  statLabel: {
    ...typography.captionLarge,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing[1],
  },
  verticalDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  actionCard: {
    marginBottom: spacing[3],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 46,
    height: 46,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    ...typography.labelLarge,
    color: colors.white,
  },
  actionSubtitle: {
    ...typography.captionLarge,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
});