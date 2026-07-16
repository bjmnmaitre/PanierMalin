import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import Svg, {
  Rect, Defs, LinearGradient, Stop, Line as SvgLine, Text as SvgText,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { radii } from '@/design';
import { LogoPM } from '@/components/primitives';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getProAnalytics, activateProSubscription } from '@/services/proService';
import type { DailyViewStat } from '@/services/proService';

// ─── Graphique barres 7 jours ─────────────────────────────────────────────────

const CHART_W  = 300;
const CHART_H  = 100;
const BAR_W    = 28;
const CHART_PY = 10;

const DayBarChart = memo(function DayBarChart({
  data,
  locked,
}: {
  data: DailyViewStat[];
  locked: boolean;
}) {
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.views), 1), [data]);
  const barSlot = CHART_W / data.length;

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FF6B00" stopOpacity={locked ? '0.2' : '1'} />
            <Stop offset="1" stopColor="#FFB800" stopOpacity={locked ? '0.1' : '0.7'} />
          </LinearGradient>
        </Defs>

        {/* Ligne de base */}
        <SvgLine
          x1={0} y1={CHART_H - CHART_PY}
          x2={CHART_W} y2={CHART_H - CHART_PY}
          stroke="#E2E8F0" strokeWidth="1"
        />

        {data.map((d, i) => {
          const barH = Math.max(4, ((d.views / maxVal) * (CHART_H - CHART_PY * 2)));
          const x    = i * barSlot + (barSlot - BAR_W) / 2;
          const y    = CHART_H - CHART_PY - barH;
          return (
            <Rect
              key={d.date}
              x={x} y={y}
              width={BAR_W} height={barH}
              rx={6}
              fill="url(#barGrad)"
            />
          );
        })}

        {/* Labels X */}
        {data.map((d, i) => (
          <SvgText
            key={`lbl-${d.date}`}
            x={i * barSlot + barSlot / 2}
            y={CHART_H - 1}
            textAnchor="middle"
            fontSize="9"
            fill="#94A3B8"
          >
            {d.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
});

// ─── Carte avantage ───────────────────────────────────────────────────────────

function BenefitRow({ icon, title, sub }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; sub: string }) {
  return (
    <View style={b.row}>
      <View style={b.iconWrap}>
        <MaterialIcons name={icon} size={20} color="#FF6B00" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={b.title}>{title}</Text>
        <Text style={b.sub}>{sub}</Text>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center',
  },
  title:   { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sub:     { fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 17 },
});

// ─── Composant principal ──────────────────────────────────────────────────────

export interface ProDashboardScreenProps {
  onBack: () => void;
}

export default function ProDashboardScreen({ onBack }: ProDashboardScreenProps) {
  const insets    = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();

  const isSubscribed = profile?.plan === 'pro';

  const [subscribing, setSubscribing] = useState(false);

  const fetchAnalytics = useCallback(() => getProAnalytics(), []);
  const { data: analytics, isLoading } = useAsync(fetchAnalytics, true);

  // Données de démonstration si pas encore d'analytics réels
  const displayData: DailyViewStat[] = analytics?.dailyBreakdown ?? [
    { date: '', label: 'Lun', views: 12 },
    { date: '', label: 'Mar', views: 19 },
    { date: '', label: 'Mer', views: 8  },
    { date: '', label: 'Jeu', views: 27 },
    { date: '', label: 'Ven', views: 34 },
    { date: '', label: 'Sam', views: 41 },
    { date: '', label: 'Dim', views: 15 },
  ];

  const monthViews = analytics?.monthViews ?? displayData.reduce((a, d) => a + d.views, 0);

  const handleSubscribe = async () => {
    Alert.alert(
      "S'abonner à PanierMalin Pro",
      "29 €/mois · Accès complet au dashboard, publications certifiées et badge Pro sur la carte.\n\nActivation immédiate (phase test — paiement sécurisé Stripe en préparation).",
      [
        { text: "Annuler", style: 'cancel' },
        {
          text: "Activer maintenant",
          onPress: async () => {
            setSubscribing(true);
            try {
              const result = await activateProSubscription();
              if (result.success) {
                await refreshProfile();
                Alert.alert(
                  "Bienvenue dans PanierMalin Pro !",
                  "Votre badge Pro est maintenant actif sur la carte. Publiez vos premières promos certifiées dès maintenant."
                );
              } else {
                Alert.alert("Erreur", result.message);
              }
            } catch {
              Alert.alert("Erreur", "Impossible d'activer l'abonnement. Réessaie dans un instant.");
            } finally {
              setSubscribing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Espace Professionnel</Text>
        <LogoPM size={28} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Badge Pro ou teasing ────────────────────────────────────────── */}
        {isSubscribed ? (
          <View style={s.proBadgeCard}>
            <MaterialIcons name="verified" size={28} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={s.proBadgeTitle}>Compte Pro Actif</Text>
              <Text style={s.proBadgeSub}>Publications certifiées · Badge sur la carte · Statistiques complètes</Text>
            </View>
          </View>
        ) : (
          <View style={s.teaserBanner}>
            <MaterialIcons name="lock-outline" size={20} color="#FF6B00" />
            <Text style={s.teaserTxt}>Débloquez l'accès complet pour voir toutes vos statistiques et publier en direct</Text>
          </View>
        )}

        {/* ── Statistique principale ──────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Audience ce mois-ci</Text>
        <View style={s.heroCard}>
          {isLoading ? (
            <ActivityIndicator color="#FF6B00" />
          ) : (
            <>
              <Text style={s.heroNumber}>
                {isSubscribed ? monthViews : '???'}
              </Text>
              <Text style={s.heroLabel}>
                {isSubscribed
                  ? "clients potentiels ont consulté votre magasin"
                  : `Déjà ${monthViews}+ clients potentiels ont consulté votre magasin ce mois-ci sur PanierMalin.`
                }
              </Text>
            </>
          )}
        </View>

        {/* ── Graphique 7 jours ───────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Vues des 7 derniers jours</Text>
        <View style={s.chartCard}>
          <DayBarChart data={displayData} locked={!isSubscribed} />
          {!isSubscribed && (
            <View style={s.lockOverlay}>
              <MaterialIcons name="lock" size={36} color="#FFFFFF" />
              <Text style={s.lockTxt}>Abonnez-vous pour voir le détail des visites</Text>
            </View>
          )}
        </View>

        {/* ── Stats rapides ────────────────────────────────────────────────── */}
        <View style={s.quickStats}>
          <View style={s.statBox}>
            <Text style={s.statVal}>{isSubscribed ? (analytics?.totalClicks ?? 0) : '—'}</Text>
            <Text style={s.statLbl}>Clics GPS</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statVal}>{isSubscribed ? (analytics?.totalViews ?? 0) : '—'}</Text>
            <Text style={s.statLbl}>Vues (7j)</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={[s.statVal, { color: '#10B981' }]}>∞</Text>
            <Text style={s.statLbl}>Promos publiables</Text>
          </View>
        </View>

        {/* ── Avantages ────────────────────────────────────────────────────── */}
        {!isSubscribed && (
          <>
            <Text style={s.sectionTitle}>Ce que vous obtenez avec Pro</Text>
            <View style={s.card}>
              <BenefitRow
                icon="bolt"
                title="Publication instantanée"
                sub="Vos promos sont publiées sans délai de validation communautaire."
              />
              <BenefitRow
                icon="verified"
                title='Badge "Certifié Pro" sur la carte'
                sub="Un liseré vert et un badge Pro pour rassurer vos clients et vous démarquer."
              />
              <BenefitRow
                icon="bar-chart"
                title="Statistiques de conversion détaillées"
                sub="Vues, clics GPS, taux de conversion, historique complet sur 12 mois."
              />
              <BenefitRow
                icon="campaign"
                title="Bannière exclusive au clic"
                sub="Affichez votre bannière promotionnelle à chaque client qui touche votre fiche."
              />
              <BenefitRow
                icon="people"
                title="Accès à la base de Sentinelles"
                sub="Votre magasin est promu auprès de notre communauté d'économiseurs actifs."
              />
            </View>
          </>
        )}

        {/* ── CTA abonnement ───────────────────────────────────────────────── */}
        {!isSubscribed && (
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => void handleSubscribe()}
            activeOpacity={0.88}
            disabled={subscribing}
          >
            {subscribing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <MaterialIcons name="workspace-premium" size={22} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={s.ctaTitle}>S'abonner à PanierMalin Pro</Text>
                  <Text style={s.ctaSub}>29 €/mois · Sans engagement · Résiliable à tout moment</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── Lien vers la publication de promo ───────────────────────────── */}
        {isSubscribed && (
          <TouchableOpacity style={s.publishBtn} activeOpacity={0.85}>
            <MaterialIcons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={s.publishBtnTxt}>Publier une promotion certifiée</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },

  scroll: { padding: 16, paddingBottom: 32, gap: 12 },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#64748B',
    letterSpacing: 0.6, textTransform: 'uppercase',
    marginTop: 8, marginBottom: 4, marginLeft: 2,
  },

  // Badge Pro
  proBadgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0',
    borderRadius: radii['2xl'], padding: 16,
  },
  proBadgeTitle: { fontSize: 15, fontWeight: '800', color: '#065F46' },
  proBadgeSub:   { fontSize: 12, color: '#047857', marginTop: 2, lineHeight: 17 },

  // Teaser
  teaserBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA',
    borderRadius: radii.xl, padding: 14,
  },
  teaserTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: '#C2410C', lineHeight: 18 },

  // Héros stats
  heroCard: {
    backgroundColor: '#FFFFFF', borderRadius: radii['2xl'], padding: 24,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  heroNumber: { fontSize: 52, fontWeight: '900', color: '#FF6B00', letterSpacing: -2 },
  heroLabel:  { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, maxWidth: 260 },

  // Graphique
  chartCard: {
    backgroundColor: '#FFFFFF', borderRadius: radii['2xl'], padding: 16,
    alignItems: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.65)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radii['2xl'],
  },
  lockTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  // Stats rapides
  quickStats: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderRadius: radii['2xl'],
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    paddingVertical: 16,
  },
  statBox:     { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },
  statVal:     { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  statLbl:     { fontSize: 11, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },

  // Card avantages
  card: {
    backgroundColor: '#FFFFFF', borderRadius: radii['2xl'], padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  // CTA
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FF6B00', borderRadius: radii.xl,
    paddingVertical: 18, paddingHorizontal: 20, marginTop: 8,
    shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 7,
  },
  ctaTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  ctaSub:   { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // Bouton publication Pro
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#10B981', borderRadius: radii.xl,
    paddingVertical: 16, marginTop: 8,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 5,
  },
  publishBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
