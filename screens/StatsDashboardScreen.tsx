// screens/StatsDashboardScreen.tsx
// Tableau de bord des économies — graphique SVG natif, barres par enseigne,
// bouton de partage ImpactShareCard. 0 dépendance externe supplémentaire.

import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal,
} from 'react-native';
import Svg, {
  Path, Circle, Defs, LinearGradient, Stop,
  Line as SvgLine,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';
import { useAsync } from '@/hooks/useAsync';
import {
  getUserDashboardStats, getMalinCoinsBalance, ensureReferralCode,
  type WeeklySaving, type StoreSaving,
} from '@/services/api';
import { ImpactShareCard } from '@/components/features';
import { LogoPM } from '@/components/primitives';

// ─── Couleurs par enseigne ────────────────────────────────────────────────────

const STORE_PALETTE: [string, string][] = [
  ['lidl',         '#FFD700'],
  ['leclerc',      '#003DA5'],
  ['carrefour',    '#EF3340'],
  ['intermarché',  '#E2001A'],
  ['système u',    '#FF8C00'],
  ['auchan',       '#E4002B'],
  ['monoprix',     '#C8A951'],
  ['franprix',     '#E8001C'],
  ['casino',       '#009543'],
];

function storeColor(name: string): string {
  const key = name.toLowerCase();
  for (const [brand, color] of STORE_PALETTE) {
    if (key.includes(brand)) return color;
  }
  return '#6366F1';
}

// ─── Graphique courbe d'économies (4 semaines) ────────────────────────────────

const CHART_W = 292;
const CHART_H = 90;
const PAD_X   = 10;
const PAD_Y   = 10;

const WeeklyChart = memo(function WeeklyChart({ data }: { data: WeeklySaving[] }) {
  const maxVal = useMemo(
    () => Math.max(...data.map((d) => d.savings), 1),
    [data]
  );

  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: PAD_X + (i / (data.length - 1)) * (CHART_W - PAD_X * 2),
        y: PAD_Y + (1 - d.savings / maxVal) * (CHART_H - PAD_Y * 2),
        label: d.label,
        savings: d.savings,
      })),
    [data, maxVal]
  );

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x.toFixed(1)} ${(CHART_H - PAD_Y).toFixed(1)}` +
    ` L ${points[0].x.toFixed(1)} ${(CHART_H - PAD_Y).toFixed(1)} Z`;

  const allZero = data.every((d) => d.savings === 0);

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor="#6366F1" stopOpacity="0.25" />
            <Stop offset="1"   stopColor="#6366F1" stopOpacity="0"    />
          </LinearGradient>
        </Defs>

        {/* Ligne de base */}
        <SvgLine
          x1={PAD_X}
          y1={CHART_H - PAD_Y}
          x2={CHART_W - PAD_X}
          y2={CHART_H - PAD_Y}
          stroke="#E2E8F0"
          strokeWidth="1"
        />

        {allZero ? (
          /* État vide : tirets */
          <SvgLine
            x1={PAD_X} y1={CHART_H / 2}
            x2={CHART_W - PAD_X} y2={CHART_H / 2}
            stroke="#CBD5E1" strokeWidth="2" strokeDasharray="6 4"
          />
        ) : (
          <>
            <Path d={areaPath}  fill="url(#areaGrad)" />
            <Path
              d={linePath}
              fill="none"
              stroke="#6366F1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#6366F1" />
            ))}
          </>
        )}
      </Svg>

      {/* Labels axe X */}
      <View style={chart.xLabels}>
        {points.map((p) => (
          <Text key={p.label} style={chart.xLabel}>{p.label}</Text>
        ))}
      </View>
    </View>
  );
});

const chart = StyleSheet.create({
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_X,
    marginTop: 4,
  },
  xLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
});

// ─── Carte stat résumé ────────────────────────────────────────────────────────

function StatCard({
  value, label, icon, accent,
}: {
  value: string; label: string;
  icon: keyof typeof MaterialIcons.glyphMap; accent: string;
}) {
  return (
    <View style={sc.card}>
      <View style={[sc.iconWrap, { backgroundColor: accent + '18' }]}>
        <MaterialIcons name={icon} size={18} color={accent} />
      </View>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderRadius: radii.xl, padding: spacing[3],
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  value: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  label: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textAlign: 'center', letterSpacing: 0.3 },
});

// ─── Barre enseigne ───────────────────────────────────────────────────────────

function StoreBar({ store }: { store: StoreSaving }) {
  const c = storeColor(store.storeName);
  return (
    <View style={sb.row}>
      <View style={sb.nameCol}>
        <View style={[sb.dot, { backgroundColor: c }]} />
        <Text style={sb.name} numberOfLines={1}>{store.storeName}</Text>
      </View>
      <View style={sb.track}>
        <View style={[sb.fill, { width: `${store.percentage}%` as any, backgroundColor: c }]} />
      </View>
      <Text style={sb.amount}>{store.savings.toFixed(2)} €</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  nameCol: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 110 },
  dot:  { width: 8, height: 8, borderRadius: 4 },
  name: { fontSize: 12, fontWeight: '600', color: '#0F172A', flex: 1 },
  track: {
    flex: 1, height: 7, backgroundColor: '#F1F5F9',
    borderRadius: 4, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  amount: { fontSize: 12, fontWeight: '700', color: '#0F172A', width: 52, textAlign: 'right' },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function StatsDashboardScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [shareVisible, setShareVisible] = useState(false);
  const [referralCode, setReferralCode] = useState('MALIN-???');
  const [malinCoins, setMalinCoins]     = useState(0);

  const { data: stats, isLoading } = useAsync(getUserDashboardStats);

  const openShare = useCallback(async () => {
    try {
      const [code, { coins }] = await Promise.all([
        ensureReferralCode(),
        getMalinCoinsBalance(),
      ]);
      setReferralCode(code);
      setMalinCoins(coins);
    } catch {
      // Valeurs par défaut si hors-ligne
    }
    setShareVisible(true);
  }, []);

  const totalSavingsStr = stats
    ? stats.totalSavings.toFixed(2).replace('.', ',') + ' €'
    : '—';
  const contribStr = stats ? String(stats.contributionCount) : '—';
  const avgStr = stats ? stats.avgDiscountPercent.toFixed(0) + ' %' : '—';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mes statistiques</Text>
        <LogoPM size={28} />
      </View>

      {isLoading ? (
        <View style={s.loader}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={s.loaderTxt}>Calcul de vos économies…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Résumé ─────────────────────────────────────────── */}
          <Text style={s.sectionTitle}>Résumé global</Text>
          <View style={s.statsRow}>
            <StatCard value={totalSavingsStr} label="Économies totales" icon="savings"          accent="#10B981" />
            <StatCard value={contribStr}      label="Contributions"     icon="thumb-up"         accent="#6366F1" />
            <StatCard value={avgStr}          label="Remise moyenne"    icon="local-offer"       accent="#F59E0B" />
          </View>

          {/* ── Graphique 4 semaines ───────────────────────────── */}
          <Text style={s.sectionTitle}>Économies — 4 dernières semaines</Text>
          <View style={s.card}>
            {stats ? (
              <WeeklyChart data={stats.weeklyData} />
            ) : (
              <WeeklyChart data={[
                { label: 'S-3', savings: 0 },
                { label: 'S-2', savings: 0 },
                { label: 'S-1', savings: 0 },
                { label: 'Cette sem.', savings: 0 },
              ]} />
            )}
            <Text style={s.chartCaption}>
              {stats?.weeklyData.every((w) => w.savings === 0)
                ? 'Partagez vos premières promos pour voir votre courbe !'
                : 'Économies en € par semaine'}
            </Text>
          </View>

          {/* ── Par enseigne ────────────────────────────────────── */}
          {stats && stats.storeBreakdown.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Par enseigne</Text>
              <View style={s.card}>
                {stats.storeBreakdown.map((store) => (
                  <StoreBar key={store.storeName} store={store} />
                ))}
              </View>
            </>
          )}

          {stats && stats.storeBreakdown.length === 0 && (
            <>
              <Text style={s.sectionTitle}>Par enseigne</Text>
              <View style={[s.card, s.emptyCard]}>
                <MaterialIcons name="store" size={32} color="#CBD5E1" />
                <Text style={s.emptyTxt}>
                  Signalez vos premières promos pour voir vos enseignes favorites.
                </Text>
              </View>
            </>
          )}

          {/* ── CTA partage ─────────────────────────────────────── */}
          <TouchableOpacity style={s.shareBtn} onPress={() => void openShare()} activeOpacity={0.88}>
            <MaterialIcons name="share" size={20} color="#FFFFFF" />
            <Text style={s.shareBtnTxt}>Partager mon impact</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Modal ImpactShareCard ────────────────────────────────── */}
      <Modal
        visible={shareVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <TouchableOpacity style={s.modalClose} onPress={() => setShareVisible(false)}>
              <MaterialIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
            <ImpactShareCard
              monthlySavings={stats?.totalSavings ?? 0}
              contributions={stats?.contributionCount ?? 0}
              malinCoins={malinCoins}
              referralCode={referralCode}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  loader:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderTxt: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  scroll:    { padding: 16, paddingBottom: 32, gap: 12 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#64748B',
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginTop: 8, marginBottom: 4, marginLeft: 2,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: radii['2xl'],
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  chartCaption: {
    fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 8,
  },
  emptyCard: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyTxt:  { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20, maxWidth: 240 },
  shareBtn: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#6366F1', borderRadius: radii.xl,
    paddingVertical: 16,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 5,
  },
  shareBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  modalClose: {
    alignSelf: 'flex-end', padding: 4, marginBottom: 8,
  },
});
