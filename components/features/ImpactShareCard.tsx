// components/features/ImpactShareCard.tsx
// Carte d'impact social style "Spotify Wrapped" — partage viral PanierMalin

import React, { useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Logo from '../primitives/Logo';

// ─── Grade Sentinelle ─────────────────────────────────────────────────────────

export type SentinelleGrade = 'Éclaireur' | 'Observateur' | 'Expert' | 'Élite';

export function computeGrade(contributions: number): SentinelleGrade {
  if (contributions >= 51) return 'Élite';
  if (contributions >= 16) return 'Expert';
  if (contributions >= 6)  return 'Observateur';
  return 'Éclaireur';
}

const GRADE_META: Record<SentinelleGrade, { bg: string; accent: string; text: string; emoji: string; dark: boolean }> = {
  'Éclaireur':   { bg: '#EFF6FF', accent: '#3B82F6', text: '#1E40AF', emoji: '🔭', dark: false },
  'Observateur': { bg: '#F0FDF4', accent: '#22C55E', text: '#14532D', emoji: '📡', dark: false },
  'Expert':      { bg: '#FFF7ED', accent: '#F97316', text: '#9A3412', emoji: '🏆', dark: false },
  'Élite':       { bg: '#1E1B4B', accent: '#818CF8', text: '#C7D2FE', emoji: '⭐', dark: true  },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ImpactShareCardProps {
  monthlySavings: number;
  contributions:  number;
  malinCoins:     number;
  referralCode:   string;
  appUrl?:        string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

const ImpactShareCard = memo(function ImpactShareCard({
  monthlySavings,
  contributions,
  malinCoins,
  referralCode,
  appUrl = 'https://paniermalin.fr',
}: ImpactShareCardProps) {
  const grade = computeGrade(contributions);
  const meta  = GRADE_META[grade];

  const handleShare = useCallback(async () => {
    const savingsStr = monthlySavings.toFixed(2).replace('.', ',');
    try {
      await Share.share({
        title:   'Mon impact PanierMalin 🛒',
        message: `🛒 Ce mois-ci j'ai économisé ${savingsStr} € grâce à PanierMalin !\n` +
                 `${meta.emoji} Grade : Sentinelle ${grade}\n` +
                 `📊 ${contributions} contribution${contributions > 1 ? 's' : ''} validée${contributions > 1 ? 's' : ''}\n` +
                 `🪙 ${malinCoins} MalinCoins en cagnotte\n\n` +
                 `👉 Rejoins-moi avec le code parrainage : ${referralCode}\n${appUrl}`,
      });
    } catch {
      Alert.alert('Partage annulé', '');
    }
  }, [monthlySavings, contributions, malinCoins, grade, referralCode, appUrl, meta.emoji]);

  const isDark = meta.dark;

  return (
    <View style={[c.card, { backgroundColor: meta.bg }]}>
      {/* Header */}
      <View style={c.header}>
        <Logo size={28} />
        <Text style={[c.appName, { color: isDark ? '#A5B4FC' : '#64748B' }]}>PanierMalin</Text>
        <View style={[c.gradePill, { backgroundColor: meta.accent + '22', borderColor: meta.accent }]}>
          <Text style={c.gradeEmoji}>{meta.emoji}</Text>
          <Text style={[c.gradeText, { color: meta.accent }]}>Sentinelle {grade}</Text>
        </View>
      </View>

      {/* Montant */}
      <View style={c.savingsBlock}>
        <Text style={[c.savingsLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          Économies ce mois-ci
        </Text>
        <Text style={[c.savingsAmount, { color: meta.accent }]}>
          {monthlySavings.toFixed(2).replace('.', ',')} €
        </Text>
      </View>

      {/* Stats 3 colonnes */}
      <View style={[c.statsRow, { borderColor: meta.accent + '30' }]}>
        <View style={c.stat}>
          <Text style={[c.statValue, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>{contributions}</Text>
          <Text style={[c.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>contributions</Text>
        </View>
        <View style={[c.statSep, { backgroundColor: meta.accent + '30' }]} />
        <View style={c.stat}>
          <Text style={[c.statValue, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>🪙 {malinCoins}</Text>
          <Text style={[c.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>MalinCoins</Text>
        </View>
        <View style={[c.statSep, { backgroundColor: meta.accent + '30' }]} />
        <View style={c.stat}>
          <Text style={[c.statValue, { color: meta.accent }]}>{referralCode}</Text>
          <Text style={[c.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>parrainage</Text>
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[c.btn, { backgroundColor: meta.accent }]}
        onPress={handleShare}
        activeOpacity={0.85}
      >
        <MaterialIcons name="share" size={18} color="#FFFFFF" />
        <Text style={c.btnText}>Partager mon impact</Text>
      </TouchableOpacity>
    </View>
  );
});

const c = StyleSheet.create({
  card: {
    borderRadius: 20, padding: 20, gap: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appName: { fontSize: 13, fontWeight: '700', flex: 1 },
  gradePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  gradeEmoji: { fontSize: 14 },
  gradeText: { fontSize: 12, fontWeight: '700' },

  savingsBlock: { alignItems: 'center', paddingVertical: 4 },
  savingsLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  savingsAmount: { fontSize: 42, fontWeight: '900', letterSpacing: -1 },

  statsRow: {
    flexDirection: 'row', borderWidth: 1, borderRadius: 14, overflow: 'hidden',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 },
  statSep: { width: 1 },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '500' },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 48, borderRadius: 14,
  },
  btnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});

export default ImpactShareCard;
