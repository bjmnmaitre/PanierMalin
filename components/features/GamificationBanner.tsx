import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';

export interface GamificationBannerProps {
  sentinelLevel?: number;
  totalPoints?: number;
  loading?: boolean;
}

const SENTINEL_LABELS: Record<number, string> = {
  1: 'Sentinelle Bronze',
  2: 'Sentinelle Argent',
  3: 'Sentinelle Or',
  4: 'Sentinelle Platine',
  5: 'Sentinelle Diamant',
};

export default function GamificationBanner({
  sentinelLevel = 1,
  totalPoints = 0,
  loading = false,
}: GamificationBannerProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const label = SENTINEL_LABELS[sentinelLevel] ?? `Niveau ${sentinelLevel}`;

  return (
    <View style={styles.container}>
      <MaterialIcons name="shield" size={20} color={colors.primary} />
      <View style={styles.info}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.points}>{totalPoints} pts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary_light,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[3],
    gap: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  label: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: '600',
  },
  points: {
    ...typography.captionSmall,
    color: colors.text.secondary,
  },
});
