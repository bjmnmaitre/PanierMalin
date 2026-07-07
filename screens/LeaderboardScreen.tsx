// screens/LeaderboardScreen.tsx
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
import { getLeaderboard } from '../services/api';
import { LeaderboardEntry } from '../types';

type FilterTab = 'friends' | 'city' | 'france';

const MEDAL_COLOR: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };

function formatSavings(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}€`;
}

interface Props {
  onNavigate: (tab: TabKey) => void;
  onBack: () => void;
}

export default function LeaderboardScreen({ onNavigate, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>('friends');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(activeTab)
      .then((data) => setEntries(data))
      .catch((err) => console.error('[LeaderboardScreen] getLeaderboard failed', err))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const podium = entries.filter((e) => e.rank <= 3).sort((a, b) => a.rank - b.rank);
  // Réordonné pour l'affichage du podium : 2e à gauche, 1er au centre, 3e à droite.
  const podiumOrdered = [
    podium.find((p) => p.rank === 2),
    podium.find((p) => p.rank === 1),
    podium.find((p) => p.rank === 3),
  ].filter(Boolean) as LeaderboardEntry[];
  const rankList = entries.filter((e) => e.rank > 3).sort((a, b) => a.rank - b.rank);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialIcons name="group" size={20} color={Colors.primary} />
          <Text style={Typography.h1}>Classement</Text>
        </View>
        <MaterialIcons name="notifications" size={24} color={Colors.textSecondary} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Filter tabs */}
        <View style={styles.tabsRow}>
          {([
            { key: 'friends', label: 'Mes amis' },
            { key: 'city', label: 'Ma ville' },
            { key: 'france', label: 'France' },
          ] as { key: FilterTab; label: string }[]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  Typography.bodyLg,
                  { color: activeTab === tab.key ? Colors.primary : Colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Défi de la semaine */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeaderRow}>
            <View style={styles.challengeTitleRow}>
              <MaterialIcons name="local-fire-department" size={20} color={Colors.secondary} />
              <Text style={Typography.h2}>Défi de la semaine</Text>
            </View>
            <View style={styles.rewardBadge}>
              <Text style={[Typography.labelSm, { color: Colors.secondary, textTransform: 'none' }]}>
                +50 pts
              </Text>
            </View>
          </View>
          <Text style={[Typography.bodyMd, { marginTop: 8 }]}>Confirme 3 prix cette semaine</Text>
          <View style={styles.progressRow}>
            <Text style={[Typography.caption, { color: Colors.secondary }]}>2/3 confirmés</Text>
            <Text style={Typography.caption}>66%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '66%', backgroundColor: Colors.secondary }]} />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
        ) : (
        <>
        {/* Podium */}
        <View style={styles.podiumRow}>
          {podiumOrdered.map((p) => (
            <View key={p.rank} style={styles.podiumItem}>
              <View style={styles.podiumAvatarWrap}>
                <Image
                  source={{ uri: p.avatarUri }}
                  style={[styles.podiumAvatar, p.rank === 1 && styles.podiumAvatarFirst]}
                />
                <MaterialIcons
                  name="military-tech"
                  size={p.rank === 1 ? 28 : 22}
                  color={MEDAL_COLOR[p.rank]}
                  style={styles.medalIcon}
                />
              </View>
              <View
                style={[
                  styles.podiumBar,
                  {
                    height: p.rank === 1 ? 128 : p.rank === 2 ? 96 : 80,
                    backgroundColor: p.rank === 1 ? Colors.primary : Colors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    Typography.bodyLg,
                    { color: p.rank === 1 ? Colors.white : Colors.textPrimary },
                  ]}
                >
                  {p.name}
                </Text>
                <Text
                  style={[
                    Typography.labelSm,
                    { color: p.rank === 1 ? Colors.white : Colors.primary, textTransform: 'none' },
                  ]}
                >
                  {formatSavings(p.savings ?? p.totalSavings ?? 0)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Liste de classement */}
        <View style={styles.rankListCard}>
          <View style={styles.rankListHeader}>
            <Text style={[Typography.labelSm, { width: 32 }]}>#</Text>
            <Text style={[Typography.labelSm, { flex: 1 }]}>UTILISATEUR</Text>
            <Text style={Typography.labelSm}>ÉCONOMIES</Text>
          </View>
          {rankList.map((row) => (
            <View
              key={row.rank}
              style={[styles.rankRow, row.isMe && styles.rankRowMe]}
            >
              <Text style={[Typography.bodyLg, { width: 32, color: row.isMe ? Colors.primary : Colors.textSecondary, fontFamily: row.isMe ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>
                {row.rank}
              </Text>
              <View style={styles.rankUserCell}>
                <Image source={{ uri: row.avatarUri }} style={styles.rankAvatar} />
                <Text style={[Typography.bodyMd, row.isMe && { fontFamily: 'Inter_600SemiBold', color: Colors.primary }]}>
                  {row.name}
                </Text>
              </View>
              <Text style={[Typography.bodyLg, row.isMe && { color: Colors.primary }]}>{formatSavings(row.savings ?? row.totalSavings ?? 0)}</Text>
            </View>
          ))}
        </View>
        </>
        )}
      </ScrollView>

      <BottomNav active="community" onNavigate={onNavigate} />
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
    height: 56,
    backgroundColor: Colors.surface,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 16 },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: Radii.card,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabButtonActive: { backgroundColor: Colors.surface, ...Shadows.soft },
  challengeCard: {
    backgroundColor: Colors.secondaryLight,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 24,
    ...Shadows.soft,
  },
  challengeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rewardBadge: {
    backgroundColor: '#FFDBD0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 4 },
  progressTrack: { height: 8, backgroundColor: Colors.surface, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  podiumRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 8, marginBottom: 24, marginTop: 8 },
  podiumItem: { flex: 1, alignItems: 'center' },
  podiumAvatarWrap: { marginBottom: 8 },
  podiumAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: Colors.border },
  podiumAvatarFirst: { width: 72, height: 72, borderRadius: 36, borderColor: Colors.primaryLight },
  medalIcon: { position: 'absolute', bottom: -4, right: -4 },
  podiumBar: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    ...Shadows.soft,
  },
  rankListCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  rankListHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rankRowMe: { backgroundColor: Colors.primaryLight, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  rankUserCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border },
});
