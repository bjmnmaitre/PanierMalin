import React, { useMemo, useEffect, useState, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, TextInput, Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '@/design';
import { Card, Button, Badge, Avatar, LogoPM } from '@/components/primitives';
import type { BadgeVariant } from '@/components/primitives';
import ModernBottomNav, { TabKey } from '@/components/features/ModernBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserSentinelStats, updateUserProfile, uploadAvatarImage, getMalinCoinsBalance,
  applyReferralCode, getTopSentinels, getMyRank,
  type SentinelStats, type SentinelRank, type SentinelEntry,
} from '@/services/api';
import {
  loadSavingsHistory, computeSummary, mergeCloudSavings,
  type SavingsSummary,
} from '@/services/savingsService';
import ProfileCard from '@/components/features/ProfileCard';
import * as ImagePicker from 'expo-image-picker';
import type { Allergy, DietType, TransportMode } from '@/types';

export interface ProfilePlaceholderScreenProps {
  onNavigate: (tab: TabKey) => void;
  onViewBaskets: () => void;
  onInviteFriends: () => void;
}

interface FieldMeta {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const DIET_META: Record<DietType, FieldMeta> = {
  none: { label: 'Aucun régime particulier', icon: 'restaurant' },
  vegan: { label: 'Végan', icon: 'eco' },
  vegetarian: { label: 'Végétarien', icon: 'grass' },
  diabetic: { label: 'Diabétique', icon: 'medical-services' },
};

const ALLERGY_META: Record<Allergy, FieldMeta> = {
  gluten: { label: 'Gluten', icon: 'no-food' },
  lactose: { label: 'Lactose', icon: 'icecream' },
  peanuts: { label: 'Arachides', icon: 'warning' },
};

const TRANSPORT_META: Record<TransportMode, FieldMeta> = {
  car_thermal: { label: 'Voiture thermique', icon: 'local-gas-station' },
  car_electric: { label: 'Voiture électrique', icon: 'electric-car' },
  bike: { label: 'Vélo', icon: 'pedal-bike' },
  walk: { label: 'À pied', icon: 'directions-walk' },
};

const PLAN_META: Record<'free' | 'premium' | 'pro', { label: string; variant: BadgeVariant; icon?: keyof typeof MaterialIcons.glyphMap }> = {
  free: { label: 'Membre Malin', variant: 'info' },
  premium: { label: 'Premium', variant: 'secondary', icon: 'stars' },
  pro: { label: 'Pro', variant: 'secondary', icon: 'military-tech' },
};

const NEXT_LEVEL_POINTS = 500;

// ─── Graphique barres horizontales (répartition par catégorie) ────────────────

interface CategoryBar {
  label:  string;
  color:  string;
  pct:    number;   // 0–1
}

const CATEGORY_SPLIT: CategoryBar[] = [
  { label: 'Alimentation', color: '#FF6B00', pct: 0.55 },
  { label: 'Boissons',     color: '#0EA5E9', pct: 0.20 },
  { label: 'Hygiène',      color: '#10B981', pct: 0.15 },
  { label: 'Bazar',        color: '#F59E0B', pct: 0.07 },
  { label: 'Animaux',      color: '#8B5CF6', pct: 0.03 },
];

const SavingsCategoryChart = memo(function SavingsCategoryChart({ totalSavings }: { totalSavings: number }) {
  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.chartTitle}>Répartition des économies</Text>
      {CATEGORY_SPLIT.map((cat) => (
        <View key={cat.label} style={chartStyles.barRow}>
          <Text style={chartStyles.barLabel}>{cat.label}</Text>
          <View style={chartStyles.barTrack}>
            <View style={[chartStyles.barFill, { width: `${Math.round(cat.pct * 100)}%` as any, backgroundColor: cat.color }]} />
          </View>
          <Text style={[chartStyles.barValue, { color: cat.color }]}>
            {(totalSavings * cat.pct).toFixed(2).replace('.', ',')} €
          </Text>
        </View>
      ))}
    </View>
  );
});

// ─── Graphique colonnes mensuelles (3 derniers mois) ─────────────────────────

const COL_HEIGHT = 100;

interface MonthData { month: string; saved: number; }

const MonthlySavingsChart = memo(function MonthlySavingsChart({
  data,
}: { data: MonthData[] }) {
  const maxVal = Math.max(...data.map((d) => d.saved), 0.01);
  const isReal = data.length > 0;

  // Formate "2026-07" → "Juil." etc.
  const monthLabel = (ym: string) => {
    const [, m] = ym.split('-');
    const LABELS = ['Jan.','Fév.','Mars','Avr.','Mai','Juin','Juil.','Août','Sep.','Oct.','Nov.','Déc.'];
    return LABELS[parseInt(m, 10) - 1] ?? ym;
  };

  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.chartTitle}>Évolution mensuelle</Text>
      {!isReal ? (
        <Text style={chartStyles.chartCaption}>
          Tes économies apparaîtront ici après ta première course optimisée.
        </Text>
      ) : (
        <>
          <View style={chartStyles.colRow}>
            {data.map((d, i) => {
              const fillH  = Math.round((d.saved / maxVal) * COL_HEIGHT);
              const isLast = i === data.length - 1;
              return (
                <View key={d.month} style={chartStyles.colItem}>
                  <Text style={[chartStyles.colValue, isLast && chartStyles.colValueAccent]}>
                    {d.saved.toFixed(2).replace('.', ',')} €
                  </Text>
                  <View style={[chartStyles.colTrack, { height: COL_HEIGHT }]}>
                    <View
                      style={[
                        chartStyles.colFill,
                        { height: fillH, backgroundColor: isLast ? '#FF6B00' : '#CBD5E1' },
                      ]}
                    />
                  </View>
                  <Text style={chartStyles.colLabel}>{monthLabel(d.month)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={chartStyles.chartCaption}>Économies réelles enregistrées par PanierMalin</Text>
        </>
      )}
    </View>
  );
});

const chartStyles = StyleSheet.create({
  container: { marginBottom: spacing[5] },
  chartTitle: {
    ...typography.labelLarge,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  // Barres horizontales
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  barLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    width: 90,
  },
  barTrack: {
    flex: 1, height: 10, borderRadius: 5,
    backgroundColor: colors.gray[200],
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5 },
  barValue: {
    ...typography.bodySmall,
    fontWeight: '700',
    width: 56,
    textAlign: 'right',
  },
  // Colonnes mensuelles
  colRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[4],
    paddingHorizontal: spacing[2],
  },
  colItem: { flex: 1, alignItems: 'center', gap: spacing[1] },
  colValue: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  colValueAccent: { color: '#FF6B00' },
  colTrack: {
    width: '100%', borderRadius: 6,
    backgroundColor: colors.gray[100],
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  colFill: { width: '100%', borderRadius: 6 },
  colLabel: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  chartCaption: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing[3],
    fontStyle: 'italic',
  },
});

const SENTINEL_RANK_META: Record<SentinelRank, { label: string; color: string; variant: BadgeVariant; nextAt: number }> = {
  'Éclaireur':  { label: 'Éclaireur',  color: '#78716C', variant: 'info',      nextAt: 5  },
  'Observateur':{ label: 'Observateur',color: '#0EA5E9', variant: 'info',      nextAt: 15 },
  'Expert':     { label: 'Expert',     color: '#F59E0B', variant: 'secondary', nextAt: 30 },
  'Élite':      { label: 'Élite',      color: '#8B5CF6', variant: 'secondary', nextAt: Infinity },
};

export default function ProfilePlaceholderScreen({
  onNavigate,
  onViewBaskets,
  onInviteFriends,
}: ProfilePlaceholderScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isLoading, signOut } = useAuth();
  const [sentinelStats, setSentinelStats]   = useState<SentinelStats | null>(null);
  const [malinCoins, setMalinCoins]         = useState<number | null>(null);
  const [savingsSummary, setSavingsSummary] = useState<SavingsSummary | null>(null);

  // ── Parrainage
  const [referralInput, setReferralInput]   = useState('');
  const [referralStatus, setReferralStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [referralMsg, setReferralMsg]       = useState('');

  // ── Classement Sentinelles + accordion coins
  const [leaderboard, setLeaderboard]         = useState<SentinelEntry[]>([]);
  const [myRank, setMyRank]                   = useState<number | null>(null);
  const [leaderLoading, setLeaderLoading]     = useState(false);
  const [coinsHowExpanded, setCoinsHowExpanded] = useState(false);

  // ── Mode édition
  const [isEditing, setIsEditing]         = useState(false);
  const [editName, setEditName]           = useState('');
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    getUserSentinelStats()
      .then(setSentinelStats)
      .catch(() => setSentinelStats({ contributionCount: 0, sentinelRank: 'Éclaireur' }));
    getMalinCoinsBalance()
      .then(({ coins }) => setMalinCoins(coins))
      .catch(() => setMalinCoins(0));
    setLeaderLoading(true);
    void Promise.all([
      getTopSentinels(5).then(setLeaderboard).catch(() => setLeaderboard([])),
      getMyRank().then(setMyRank).catch(() => setMyRank(null)),
    ]).finally(() => setLeaderLoading(false));
    // Charger l'historique des économies (merge cloud en arrière-plan)
    void mergeCloudSavings().catch(() => {});
    loadSavingsHistory()
      .then((sessions) => setSavingsSummary(computeSummary(sessions)))
      .catch(() => {});
  }, []);

  const openEditMode = useCallback(() => {
    setEditName(profile?.displayName ?? '');
    setEditAvatarUri(null);
    setIsEditing(true);
  }, [profile?.displayName]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditAvatarUri(null);
  }, []);

  const pickAvatar = useCallback(async () => {
    const launchPicker = async (source: 'camera' | 'library') => {
      const fn = source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
      const result = await fn({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        setEditAvatarUri(result.assets[0].uri);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Prendre une photo', 'Choisir dans la galerie'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await launchPicker('camera');
          if (idx === 2) await launchPicker('library');
        }
      );
    } else {
      Alert.alert('Changer la photo', undefined, [
        { text: 'Prendre une photo', onPress: () => void launchPicker('camera') },
        { text: 'Galerie', onPress: () => void launchPicker('library') },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  }, []);

  const saveProfile = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      let avatarUrl: string | undefined;
      if (editAvatarUri) {
        avatarUrl = await uploadAvatarImage(editAvatarUri);
      }
      await updateUserProfile({
        displayName: editName.trim() || undefined,
        avatarUrl,
      });
      setIsEditing(false);
      setEditAvatarUri(null);
    } catch (err) {
      Alert.alert('Erreur', 'La sauvegarde a échoué, réessaie.');
    } finally {
      setSaving(false);
    }
  }, [editName, editAvatarUri, saving]);

  const handleApplyReferral = useCallback(async () => {
    const code = referralInput.trim().toUpperCase();
    if (!code) return;
    setReferralStatus('loading');
    try {
      const res = await applyReferralCode(code);
      setReferralStatus(res.success ? 'ok' : 'err');
      setReferralMsg(res.message);
      if (res.success) {
        setReferralInput('');
        setMalinCoins((prev) => (prev !== null ? prev + 50 : null));
      }
    } catch {
      setReferralStatus('err');
      setReferralMsg('Erreur réseau, réessaie plus tard.');
    }
  }, [referralInput]);

  const progressPercent = useMemo(() => {
    const points = profile?.totalPoints ?? 0;
    return Math.min((points / NEXT_LEVEL_POINTS) * 100, 100);
  }, [profile?.totalPoints]);

  const sentinelMeta = SENTINEL_RANK_META[sentinelStats?.sentinelRank ?? 'Éclaireur'];

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centerContainer]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.root}>
        <View style={[styles.centerContainer, { flex: 1, gap: spacing[3] }]}>
          <MaterialIcons name="warning" size={32} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>Impossible de charger ton profil pour le moment.</Text>
        </View>
        <ModernBottomNav active="profile" onNavigate={onNavigate} />
      </View>
    );
  }

  const dietMeta = DIET_META[profile.dietType];
  const transportMeta = TRANSPORT_META[profile.transportMode];
  const planMeta = PLAN_META[profile.plan];

  return (
    <View style={styles.root}>
      <View style={[styles.mainHeader, { paddingTop: insets.top + spacing[3] }]}>
        <Text style={styles.headerTitle}>Mon QG</Text>
        {isEditing ? (
          <View style={styles.editActions}>
            <TouchableOpacity onPress={cancelEdit} disabled={saving} style={styles.headerBtn}>
              <MaterialIcons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void saveProfile()} disabled={saving} style={[styles.headerBtn, styles.saveBtn]}>
              {saving
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.saveBtnText}>Sauver</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={openEditMode} style={styles.headerBtn}>
            <MaterialIcons name="edit" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileIdentityRow}>
          {isEditing ? (
            <TouchableOpacity onPress={() => void pickAvatar()} activeOpacity={0.75}>
              <Avatar
                size="lg"
                name={editName || profile.displayName}
                source={
                  editAvatarUri
                    ? { uri: editAvatarUri }
                    : profile.avatarUrl
                    ? { uri: profile.avatarUrl }
                    : undefined
                }
              />
              <View style={styles.cameraOverlay}>
                <MaterialIcons name="camera-alt" size={14} color={colors.white} />
              </View>
            </TouchableOpacity>
          ) : (
            <Avatar
              size="lg"
              name={profile.displayName}
              source={profile.avatarUrl ? { uri: profile.avatarUrl } : undefined}
            />
          )}
          <View style={styles.identityInfo}>
            {isEditing ? (
              <TextInput
                style={styles.editNameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ton prénom ou pseudo"
                placeholderTextColor={colors.text.tertiary}
                autoFocus
                maxLength={40}
              />
            ) : (
              <Text style={styles.displayName}>{profile.displayName}</Text>
            )}
            <View style={styles.badgeRow}>
              <Badge label={planMeta.label} variant={planMeta.variant} icon={planMeta.icon} />
              <Badge label={sentinelMeta.label} variant={sentinelMeta.variant} icon="military-tech" />
              {!profile.onboardingCompleted && (
                <Badge label="Profil à compléter" variant="warning" />
              )}
            </View>
          </View>
        </View>

        {/* ── Mon Impact Malin ─────────────────────────────────────── */}
        <Text style={styles.blockTitle}>Mon Impact Malin</Text>
        <View style={styles.impactGrid}>
          <View style={styles.impactCard}>
            <MaterialIcons name="savings" size={22} color="#1D9E75" />
            <Text style={styles.impactValue}>
              {savingsSummary ? `${savingsSummary.totalSaved.toFixed(2)} €` : profile.totalSavings.toFixed(2) + ' €'}
            </Text>
            <Text style={styles.impactLabel}>Total économisé</Text>
          </View>
          <View style={styles.impactCard}>
            <MaterialIcons name="shopping-cart" size={22} color="#FF6B00" />
            <Text style={styles.impactValue}>
              {savingsSummary?.totalSessions ?? 0}
            </Text>
            <Text style={styles.impactLabel}>Courses optimisées</Text>
          </View>
          <View style={styles.impactCard}>
            <MaterialIcons name="trending-up" size={22} color="#3B82F6" />
            <Text style={styles.impactValue}>
              {savingsSummary && savingsSummary.avgSavings > 0
                ? `${savingsSummary.avgSavings.toFixed(2)} €`
                : '—'}
            </Text>
            <Text style={styles.impactLabel}>Économie moy./course</Text>
          </View>
        </View>

        <View style={styles.statsGridRow}>
          <Card padding="md" shadow="sm" style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.totalSavings.toFixed(2)}€</Text>
            <Text style={styles.statLabel}>Économisés</Text>
          </Card>
          <Card padding="md" shadow="sm" style={styles.statBox}>
            <Text style={[styles.statNumber, { color: colors.secondary }]}>
              {sentinelStats?.contributionCount ?? '—'}
            </Text>
            <Text style={styles.statLabel}>Contributions</Text>
          </Card>
          <Card padding="md" shadow="sm" style={styles.statBox}>
            <Text style={[styles.statNumber, { color: sentinelMeta.color }]}>
              {sentinelStats?.sentinelRank ?? '—'}
            </Text>
            <Text style={styles.statLabel}>Rang</Text>
          </Card>
        </View>

        <Card padding="md" shadow="sm" style={styles.sectionCard}>
          <View style={styles.evolutionHeader}>
            <Text style={styles.sectionTitle}>Progression Sentinelle</Text>
            <Text style={styles.evolutionCount}>
              {sentinelStats?.contributionCount ?? 0} contribution{(sentinelStats?.contributionCount ?? 0) > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, {
              width: `${Math.min(((sentinelStats?.contributionCount ?? 0) / Math.min(sentinelMeta.nextAt, 30)) * 100, 100)}%`,
              backgroundColor: sentinelMeta.color,
            }]} />
          </View>
          <Text style={styles.evolutionCaption}>
            {sentinelMeta.nextAt === Infinity
              ? 'Rang Élite atteint — tu es une légende de la communauté !'
              : `Encore ${sentinelMeta.nextAt - (sentinelStats?.contributionCount ?? 0)} contributions pour devenir ${
                  (() => {
                    const ranks: SentinelRank[] = ['Éclaireur','Observateur','Expert','Élite'];
                    const cur = sentinelStats?.sentinelRank ?? 'Éclaireur';
                    return ranks[ranks.indexOf(cur) + 1] ?? 'Élite';
                  })()
                }.`
            }
          </Text>
        </Card>

        {/* ── Carte de niveau MalinCoins ────────────────────────────────── */}
        {malinCoins !== null && (
          <ProfileCard
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl ?? undefined}
            malinCoins={malinCoins}
            subtitle={sentinelStats?.sentinelRank}
          />
        )}

        {/* ── Mini-dashboard statistiques visuelles ─────────────────────── */}
        <Text style={styles.blockTitle}>Mes économies en détail</Text>
        <Card padding="md" shadow="sm" style={styles.sectionCard}>
          <MonthlySavingsChart data={savingsSummary?.byMonth ?? []} />
          <View style={styles.chartDivider} />
          <SavingsCategoryChart totalSavings={profile.totalSavings} />
        </Card>

        {/* ── Classement Sentinelles ────────────────────────────────────── */}
        <Text style={styles.blockTitle}>Classement Sentinelles</Text>
        <Card padding="md" shadow="sm" style={styles.sectionCard}>
          {leaderLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing[3] }} />
          ) : leaderboard.length === 0 ? (
            <Text style={styles.infoLabelMuted}>Aucune donnée disponible.</Text>
          ) : (
            leaderboard.map((entry, idx) => (
              <View key={entry.userId} style={styles.lbRow}>
                <Text style={styles.lbMedal}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </Text>
                <Text
                  style={[styles.lbName, entry.isMe && styles.lbNameMe]}
                  numberOfLines={1}
                >
                  {entry.displayName}
                </Text>
                <Text style={styles.lbCoins}>{entry.malinCoins} 🪙</Text>
              </View>
            ))
          )}

          {myRank !== null && (
            <View style={styles.myRankCard}>
              <View style={styles.myRankRow}>
                <Text style={styles.myRankBadge}>#{myRank}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myRankLabel}>Votre position</Text>
                  <Text style={styles.myRankTier}>{sentinelMeta.label}</Text>
                </View>
                {sentinelMeta.nextAt !== Infinity && (
                  <Text style={styles.myRankNext}>
                    {Math.max(0, sentinelMeta.nextAt - (sentinelStats?.contributionCount ?? 0))} contrib. pour monter
                  </Text>
                )}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.lbSeeAll}
            onPress={() => router.push('/community/leaderboard' as any)}
          >
            <Text style={styles.lbSeeAllTxt}>Voir le classement complet</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
          </TouchableOpacity>
        </Card>

        {/* ── Comment gagner des MalinCoins ? ──────────────────────────── */}
        <Text style={styles.blockTitle}>Comment gagner des MalinCoins ?</Text>
        <Card padding="md" shadow="sm" style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setCoinsHowExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Guide des récompenses</Text>
            <MaterialIcons
              name={coinsHowExpanded ? 'expand-less' : 'expand-more'}
              size={22}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
          {coinsHowExpanded && (
            <View style={styles.coinsHowList}>
              {([
                { icon: 'receipt-long',  label: 'Scanner un ticket de caisse', coins: 50 },
                { icon: 'local-offer',   label: 'Signaler une promotion',       coins: 25 },
                { icon: 'flag',          label: 'Signaler une erreur de prix',  coins: 5  },
              ] as const).map(({ icon, label, coins }) => (
                <View key={label} style={styles.coinsHowRow}>
                  <MaterialIcons name={icon} size={18} color={colors.primary} />
                  <Text style={styles.coinsHowLabel}>{label}</Text>
                  <View style={styles.coinsBadge}>
                    <Text style={styles.coinsBadgeTxt}>+{coins}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Text style={styles.blockTitle}>Santé & régime</Text>
        <Card padding="md" shadow="sm" style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <MaterialIcons name={dietMeta.icon} size={20} color={colors.primary} />
            <Text style={styles.infoLabel}>{dietMeta.label}</Text>
          </View>
          {profile.allergies.length > 0 && (
            <View style={styles.chipsRow}>
              {profile.allergies.map((allergy) => (
                <Badge
                  key={allergy}
                  label={ALLERGY_META[allergy].label}
                  variant="warning"
                  icon={ALLERGY_META[allergy].icon}
                />
              ))}
            </View>
          )}
          <View style={styles.infoRow}>
            <MaterialIcons name="local-fire-department" size={20} color={colors.text.tertiary} />
            <Text style={styles.infoLabelMuted}>
              {profile.dailyCalorieGoal ? `${profile.dailyCalorieGoal} kcal / jour` : 'Objectif calorique non renseigné'}
            </Text>
          </View>
        </Card>

        <Text style={styles.blockTitle}>Logistique</Text>
        <Card padding="md" shadow="sm" style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <MaterialIcons name={transportMeta.icon} size={20} color={colors.primary} />
            <Text style={styles.infoLabel}>{transportMeta.label}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="schedule" size={20} color={colors.text.tertiary} />
            <Text style={styles.infoLabelMuted}>
              {profile.maxShoppingTimeMinutes ? `${profile.maxShoppingTimeMinutes} min max par course` : 'Temps de course non renseigné'}
            </Text>
          </View>
        </Card>

        <Text style={styles.blockTitle}>Budget</Text>
        <Card padding="md" shadow="sm" style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <MaterialIcons name="account-balance-wallet" size={20} color={colors.primary} />
            <Text style={styles.infoLabel}>
              {profile.monthlyBudget ? `${profile.monthlyBudget.toFixed(2)}€ / mois` : 'Budget mensuel non renseigné'}
            </Text>
          </View>
        </Card>

        <Text style={styles.blockTitle}>MalinCoins & Récompenses</Text>
        <Card padding="md" shadow="sm" onPress={() => router.push('/rewards' as any)}>
          <View style={styles.menuItemContent}>
            <View style={styles.coinsIconWrap}>
              <LogoPM size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemLabel}>Mes MalinCoins</Text>
              <Text style={styles.coinsSubtitle}>
                {malinCoins === null ? 'Chargement…' : `${malinCoins} coins — Voir les bons d'achat`}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
          </View>
        </Card>

        <Text style={styles.blockTitle}>Code de parrainage</Text>
        <Card padding="md" shadow="sm" style={styles.sectionCard}>
          <Text style={styles.infoLabelMuted}>
            Tu as un code ? Entre-le pour gagner 50 MalinCoins.
          </Text>
          <View style={styles.referralRow}>
            <TextInput
              style={styles.referralInput}
              value={referralInput}
              onChangeText={(t) => { setReferralInput(t); setReferralStatus('idle'); }}
              placeholder="MALIN-XXXXXX"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={referralStatus !== 'loading' && referralStatus !== 'ok'}
            />
            <TouchableOpacity
              style={[
                styles.referralBtn,
                (referralStatus === 'loading' || referralStatus === 'ok') && styles.referralBtnDisabled,
              ]}
              onPress={() => void handleApplyReferral()}
              disabled={referralStatus === 'loading' || referralStatus === 'ok'}
              activeOpacity={0.8}
            >
              {referralStatus === 'loading'
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.referralBtnTxt}>
                    {referralStatus === 'ok' ? '✓' : 'Valider'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
          {referralMsg !== '' && (
            <Text style={[
              styles.referralFeedback,
              { color: referralStatus === 'ok' ? '#10B981' : '#EF4444' },
            ]}>
              {referralMsg}
            </Text>
          )}
        </Card>

        <Text style={styles.blockTitle}>Gestion & outils</Text>
        <View style={styles.menuGroup}>
          <Card padding="md" shadow="sm" onPress={onViewBaskets}>
            <View style={styles.menuItemContent}>
              <MaterialIcons name="shopping-basket" size={20} color={colors.primary} />
              <Text style={styles.menuItemLabel}>Mes paniers favoris</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
            </View>
          </Card>
          <Card padding="md" shadow="sm" onPress={() => router.push('/scan-receipt' as any)}>
            <View style={styles.menuItemContent}>
              <MaterialIcons name="receipt-long" size={20} color={colors.primary} />
              <Text style={styles.menuItemLabel}>Scanner un ticket de caisse</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
            </View>
          </Card>
          <Card padding="md" shadow="sm" onPress={onInviteFriends}>
            <View style={styles.menuItemContent}>
              <MaterialIcons name="card-giftcard" size={20} color={colors.secondary} />
              <Text style={styles.menuItemLabel}>Parrainer mes proches</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
            </View>
          </Card>
          <Card padding="md" shadow="sm" onPress={() => router.push('/settings' as any)}>
            <View style={styles.menuItemContent}>
              <MaterialIcons name="settings" size={20} color={colors.text.secondary} />
              <Text style={styles.menuItemLabel}>Paramètres</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.text.tertiary} />
            </View>
          </Card>
        </View>

        <Button
          label="Se déconnecter"
          variant="outline"
          icon="logout"
          onPress={signOut}
          fullWidth
          style={styles.signOutButton}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      <ModernBottomNav active="profile" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing[6],
  },
  mainHeader: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text.primary,
  },
  editActions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  headerBtn: {
    padding: spacing[2],
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[3],
    minWidth: 70,
  },
  saveBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  editNameInput: {
    ...typography.h3,
    color: colors.text.primary,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
    paddingVertical: spacing[1],
    marginBottom: spacing[1],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    paddingBottom: spacing[8],
  },
  profileIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[5],
  },
  identityInfo: {
    flex: 1,
  },
  displayName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  statsGridRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    ...typography.h3,
    color: colors.primary,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  sectionCard: {
    marginBottom: spacing[5],
  },
  evolutionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  sectionTitle: {
    ...typography.labelLarge,
    color: colors.text.primary,
  },
  evolutionCount: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: radii.full,
    overflow: 'hidden',
    marginBottom: spacing[2],
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.tertiary,
    borderRadius: radii.full,
  },
  evolutionCaption: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  blockTitle: {
    ...typography.labelLarge,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[1],
  },
  infoLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  infoLabelMuted: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginVertical: spacing[2],
  },
  menuGroup: {
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  menuItemLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  coinsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  coinsEmoji: {
    fontSize: 18,
  },
  coinsSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  referralRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  referralInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: 10,
    paddingHorizontal: spacing[3],
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    backgroundColor: colors.white,
    letterSpacing: 1,
  },
  referralBtn: {
    height: 44,
    paddingHorizontal: spacing[4],
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  referralBtnTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  referralFeedback: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: spacing[2],
  },
  signOutButton: {
    marginTop: spacing[1],
  },

  // Mon Impact Malin
  impactGrid: {
    flexDirection: 'row', gap: spacing[3], marginBottom: spacing[5],
  },
  impactCard: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderRadius: radii.xl, padding: spacing[3],
    alignItems: 'center', gap: spacing[1],
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  impactValue: {
    fontSize: 18, fontWeight: '900', color: '#0F172A', textAlign: 'center',
  },
  impactLabel: {
    fontSize: 9, fontWeight: '600', color: '#94A3B8',
    textAlign: 'center', lineHeight: 12,
  },
  chartDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing[4],
  },

  // Leaderboard preview
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  lbMedal: { fontSize: 18, width: 28, textAlign: 'center' },
  lbName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  lbNameMe: { fontWeight: '700', color: colors.primary },
  lbCoins: {
    ...typography.labelMedium,
    color: '#D97706',
  },
  myRankCard: {
    marginTop: spacing[3],
    backgroundColor: '#F0F9FF',
    borderRadius: radii.md,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  myRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  myRankBadge: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '900',
    width: 44,
  },
  myRankLabel: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  myRankTier: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  myRankNext: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'right',
    maxWidth: 110,
  },
  lbSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing[3],
    gap: spacing[1],
  },
  lbSeeAllTxt: {
    ...typography.labelMedium,
    color: colors.primary,
  },

  // Comment gagner des coins — accordion
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coinsHowList: {
    marginTop: spacing[3],
    gap: spacing[3],
  },
  coinsHowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  coinsHowLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  coinsBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  coinsBadgeTxt: {
    ...typography.labelSmall,
    color: '#D97706',
    fontWeight: '700',
  },
});
