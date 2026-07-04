// components/FreshnessBadge.tsx
// Le composant central du mécanisme différenciant face à Bonial.
// Calcule automatiquement la couleur à partir d'un timestamp réel,
// pour ne jamais avoir à coder la couleur en dur.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

interface FreshnessBadgeProps {
  /** Date ISO de la dernière vérification du prix */
  verifiedAt: string;
  size?: 'sm' | 'md';
}

function getFreshnessLevel(verifiedAt: string): {
  color: string;
  label: string;
} {
  const now = Date.now();
  const verifiedTime = new Date(verifiedAt).getTime();
  const diffHours = (now - verifiedTime) / (1000 * 60 * 60);

  if (diffHours < 6) {
    const minutes = Math.round(diffHours * 60);
    const label = minutes < 1 ? 'à l\'instant' : minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.round(diffHours)}h`;
    return { color: Colors.freshGreen, label };
  }
  if (diffHours < 24 * 5) {
    const days = Math.max(1, Math.round(diffHours / 24));
    return { color: Colors.freshOrange, label: days === 1 ? 'il y a 1 jour' : `il y a ${days} jours` };
  }
  const days = Math.round(diffHours / 24);
  return { color: Colors.freshGray, label: `il y a ${days} jours — à confirmer` };
}

export default function FreshnessBadge({ verifiedAt, size = 'sm' }: FreshnessBadgeProps) {
  const { color, label } = getFreshnessLevel(verifiedAt);
  const dotSize = size === 'sm' ? 6 : 8;

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: color, width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]} />
      <Text style={[Typography.caption, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    marginRight: 2,
  },
});
