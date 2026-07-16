// app/store/[id].tsx
// Écran Détails Magasin — Hub communautaire B2B de chaque enseigne.
// Route : /store/:id   (expo-router dynamic segment)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiClient } from '@/services/api/client';
import { toggleVotePromotion, awardMalinCoins } from '@/services/api';
import type { PromotionFeedItem } from '@/services/api';
import { reportInventoryPrice } from '@/services/inventoryService';
import { getBrandAbbr, getBrandPalette } from '@/utils/brandUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreDetail {
  id:                 string;
  name:               string;
  brand:              string;
  address:            string;
  city:               string;
  openingHours:       string | null;
  reliabilityScore:   number;
  promoCount:         number;
  verificationStatus: string;
  isSponsored:        boolean;
  phone:              string | null;
}

// Produits "Prix en Ligne" — placeholder réaliste jusqu'à PrixEnLigneService
const ONLINE_PRICE_PLACEHOLDER = [
  { name: 'Lait demi-écrémé 1L',         price: 0.99,  trend: -2  },
  { name: 'Yaourt nature 4×125g',          price: 1.89,  trend: 0   },
  { name: 'Pain de mie complet 550g',      price: 1.45,  trend: +3  },
  { name: 'Pâtes spaghetti 500g',          price: 0.75,  trend: -5  },
  { name: "Jus d'orange 100% 1L",          price: 2.29,  trend: +1  },
  { name: 'Fromage râpé 200g',             price: 1.99,  trend: -1  },
  { name: 'Beurre doux 250g',              price: 2.15,  trend: +4  },
  { name: 'Coca-Cola 1,5L',                price: 1.89,  trend: 0   },
];

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchStoreDetail(id: string): Promise<StoreDetail | null> {
  const supabase = apiClient.getSupabase();
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, brand, address, city, opening_hours, reliability_score, promo_count, verification_status, is_sponsored, phone')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const d = data as {
    id: string; name: string; brand: string; address: string; city: string;
    opening_hours: string | null; reliability_score: number | null;
    promo_count: number | null; verification_status: string | null;
    is_sponsored: boolean | null; phone: string | null;
  };

  return {
    id:                 d.id,
    name:               d.name,
    brand:              d.brand,
    address:            d.address,
    city:               d.city,
    openingHours:       d.opening_hours,
    reliabilityScore:   d.reliability_score ?? 90,
    promoCount:         d.promo_count ?? 0,
    verificationStatus: d.verification_status ?? 'none',
    isSponsored:        d.is_sponsored ?? false,
    phone:              d.phone,
  };
}

async function fetchStorePromotions(storeId: string): Promise<PromotionFeedItem[]> {
  const supabase = apiClient.getSupabase();
  const { data, error } = await supabase
    .from('promotions')
    .select(`
      id, user_id, product_name, ean, original_price, promo_price,
      discount_percent, proof_image_url, status, created_at, votes_count,
      users_profiles(display_name, avatar_url)
    `)
    .eq('store_id', storeId)
    .eq('status', 'verified')
    .order('votes_count', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  type PromoRow = {
    id: string; user_id: string; product_name: string; ean: string | null;
    original_price: number; promo_price: number; discount_percent: number;
    proof_image_url: string | null; status: string; created_at: string;
    votes_count: number;
    users_profiles: { display_name: string | null; avatar_url: string | null } | null;
  };
  return (data as unknown as PromoRow[]).map((row) => ({
    id:              row.id,
    userId:          row.user_id,
    authorName:      row.users_profiles?.display_name ?? 'Sentinelle',
    authorAvatar:    row.users_profiles?.avatar_url ?? null,
    productName:     row.product_name,
    ean:             row.ean,
    storeName:       '',
    originalPrice:   row.original_price,
    promoPrice:      row.promo_price,
    discountPercent: row.discount_percent,
    proofImageUrl:   row.proof_image_url,
    status:          row.status as PromotionFeedItem['status'],
    createdAt:       row.created_at,
    votesCount:      row.votes_count,
    hasUserVoted:    false,
  }));
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function BrandBadge({ brand }: { brand: string }) {
  const pal   = getBrandPalette(brand);
  const abbr  = getBrandAbbr(brand);
  return (
    <View style={[badge.wrap, { backgroundColor: pal.main, borderColor: pal.text === '#FFFFFF' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.10)' }]}>
      <Text style={[badge.txt, { color: pal.text, fontSize: abbr.length > 2 ? 11 : 13 }]}>
        {abbr}
      </Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    width: 64, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  txt: { fontWeight: '900', letterSpacing: 0.5 },
});

function ReliabilityBadge({ score }: { score: number }) {
  const color = score >= 90 ? '#10B981' : score >= 75 ? '#F59E0B' : '#EF4444';
  const label = score >= 90 ? 'Très fiable' : score >= 75 ? 'Fiable' : 'Peu fiable';
  return (
    <View style={[rel.wrap, { backgroundColor: color + '18', borderColor: color + '44' }]}>
      <MaterialIcons name="shield" size={13} color={color} />
      <Text style={[rel.txt, { color }]}>{score}% — {label}</Text>
    </View>
  );
}

const rel = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  txt: { fontSize: 12, fontWeight: '700' },
});

function PromoCard({ item, onFlag }: { item: PromotionFeedItem; onFlag: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [votes, setVotes]       = useState(item.votesCount);
  const [hasVoted, setHasVoted] = useState(item.hasUserVoted);
  const [voting, setVoting]     = useState(false);

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1.00, useNativeDriver: true, speed: 30 }).start();

  const handleVote = async () => {
    if (voting) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const optimistic = !hasVoted;
    setHasVoted(optimistic);
    setVotes((n) => optimistic ? n + 1 : n - 1);
    setVoting(true);
    try {
      const res = await toggleVotePromotion(item.id);
      setHasVoted(res.voted);
      setVotes(res.count);
    } catch {
      setHasVoted(!optimistic);
      setVotes((n) => optimistic ? n - 1 : n + 1);
    } finally {
      setVoting(false);
    }
  };

  const ago = (() => {
    const diff = Date.now() - new Date(item.createdAt).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1)  return 'à l\'instant';
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  })();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={pc.card}
      >
        <View style={pc.row}>
          {/* Avatar auteur */}
          <View style={pc.avatar}>
            <Text style={pc.avatarTxt}>{item.authorName[0]?.toUpperCase() ?? 'S'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pc.product} numberOfLines={2}>{item.productName}</Text>
            <Text style={pc.meta}>{item.authorName} · {ago}</Text>
          </View>
          {/* Pill prix */}
          <View style={pc.pricePill}>
            <Text style={pc.priceNew}>{item.promoPrice.toFixed(2)} €</Text>
            {item.originalPrice > item.promoPrice && (
              <Text style={pc.priceOld}>{item.originalPrice.toFixed(2)} €</Text>
            )}
          </View>
        </View>

        <View style={pc.footer}>
          <View style={pc.discountBadge}>
            <Text style={pc.discountTxt}>-{item.discountPercent}%</Text>
          </View>
          <TouchableOpacity
            style={[pc.voteRow, hasVoted && pc.voteRowActive]}
            onPress={() => void handleVote()}
            disabled={voting}
            activeOpacity={0.75}
          >
            <MaterialIcons
              name={hasVoted ? 'thumb-up' : 'thumb-up-off-alt'}
              size={13}
              color={hasVoted ? '#10B981' : '#94A3B8'}
            />
            <Text style={[pc.voteTxt, hasVoted && pc.voteTxtActive]}>{votes}</Text>
          </TouchableOpacity>
          <View style={pc.verifiedChip}>
            <MaterialIcons name="check-circle" size={12} color="#10B981" />
            <Text style={pc.verifiedTxt}>Vérifié communauté</Text>
          </View>
          <TouchableOpacity
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onFlag(); }}
            hitSlop={10}
            style={pc.flagBtn}
          >
            <MaterialIcons name="flag" size={14} color="#CBD5E1" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const pc = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FF6B00', alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  product:   { fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 18, flex: 1 },
  meta:      { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  pricePill: { alignItems: 'flex-end' },
  priceNew:  { fontSize: 16, fontWeight: '800', color: '#10B981' },
  priceOld:  { fontSize: 11, color: '#94A3B8', textDecorationLine: 'line-through' },
  footer:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  discountBadge: {
    backgroundColor: '#FF6B00', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  discountTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  voteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
  },
  voteRowActive: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  voteTxt:       { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  voteTxtActive: { color: '#10B981', fontWeight: '700' },
  verifiedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F0FDF4', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    marginLeft: 'auto',
  },
  verifiedTxt: { fontSize: 10, color: '#10B981', fontWeight: '700' },
  flagBtn: { padding: 4, marginLeft: 'auto' },
});

function OnlinePriceRow({
  name, price, trend, onFlag,
}: { name: string; price: number; trend: number; onFlag: () => void }) {
  const trendColor = trend < 0 ? '#10B981' : trend > 0 ? '#EF4444' : '#94A3B8';
  const trendIcon  = trend < 0 ? 'trending-down' : trend > 0 ? 'trending-up' : 'trending-flat';
  return (
    <View style={op.row}>
      <MaterialIcons name="inventory-2" size={14} color="#94A3B8" />
      <Text style={op.name} numberOfLines={1}>{name}</Text>
      <View style={op.right}>
        <MaterialIcons name={trendIcon as 'trending-up' | 'trending-down' | 'trending-flat'} size={14} color={trendColor} />
        <Text style={op.price}>{price.toFixed(2)} €</Text>
        <TouchableOpacity
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onFlag(); }}
          hitSlop={8}
        >
          <MaterialIcons name="flag" size={13} color="#E2E8F0" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const op = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  name:  { flex: 1, fontSize: 13, color: '#334155' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
});

// ─── Flag / Signalement de prix erroné ───────────────────────────────────────

const FLAG_REASONS = [
  { id: 'wrong_price',   label: 'Prix incorrect',    icon: 'error-outline'   as const },
  { id: 'out_of_stock',  label: 'Rupture de stock',  icon: 'remove-circle-outline' as const },
  { id: 'wrong_product', label: 'Mauvais produit',   icon: 'report-problem'  as const },
] as const;
type FlagReasonId = typeof FLAG_REASONS[number]['id'];

interface FlagModalProps {
  visible:     boolean;
  productName: string;
  storeId:     string;
  onClose:     () => void;
}

function FlagReportModal({ visible, productName, storeId, onClose }: FlagModalProps) {
  const [selectedReason, setSelectedReason] = useState<FlagReasonId | ''>('');
  const [submitting, setSubmitting]         = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 400, friction: 9, tension: 65, useNativeDriver: true,
    }).start();
    if (!visible) setSelectedReason('');
  }, [visible, slideAnim]);

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!selectedReason || submitting) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      await reportInventoryPrice(storeId, productName, selectedReason);
      try { await awardMalinCoins(5); } catch { /* best-effort */ }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={fm.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[fm.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={fm.handle} />
        <Text style={fm.title}>Signaler un problème</Text>
        <Text style={fm.product} numberOfLines={2}>{productName}</Text>

        <View style={fm.reasons}>
          {FLAG_REASONS.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[fm.reasonBtn, selectedReason === r.id && fm.reasonBtnActive]}
              onPress={() => { setSelectedReason(r.id); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={r.icon}
                size={18}
                color={selectedReason === r.id ? '#EF4444' : '#64748B'}
              />
              <Text style={[fm.reasonTxt, selectedReason === r.id && fm.reasonTxtActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[fm.submitBtn, (!selectedReason || submitting) && fm.submitBtnDisabled]}
          onPress={() => void handleSubmit()}
          activeOpacity={0.85}
          disabled={!selectedReason || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={fm.submitTxt}>Soumettre le signalement</Text>
          }
        </TouchableOpacity>

        <Text style={fm.disclaimer}>
          Signalements validés par la communauté = +5 MalinCoins.
        </Text>
      </Animated.View>
    </>
  );
}

const fm = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 50,
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 36, zIndex: 51,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 14,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 20,
  },
  title:   { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  product: { fontSize: 13, color: '#64748B', marginBottom: 20, lineHeight: 18 },
  reasons: { gap: 10, marginBottom: 24 },
  reasonBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
    backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  reasonBtnActive: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  reasonTxt:       { fontSize: 14, fontWeight: '600', color: '#475569' },
  reasonTxtActive: { color: '#EF4444' },
  submitBtn: {
    height: 50, borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#CBD5E1' },
  submitTxt:  { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  disclaimer: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 12 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function StoreDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const [store, setStore]             = useState<StoreDetail | null>(null);
  const [promos, setPromos]           = useState<PromotionFeedItem[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [flagTarget, setFlagTarget]   = useState<string | null>(null);

  // Animation d'entrée du header
  const headerY = useRef(new Animated.Value(-20)).current;
  const headerO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerY, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(headerO, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadingStore(true);
    setLoadingPromos(true);

    const [storeData, promosData] = await Promise.all([
      fetchStoreDetail(id),
      fetchStorePromotions(id),
    ]);

    setStore(storeData);
    setLoadingStore(false);
    setPromos(promosData);
    setLoadingPromos(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const pal = store ? getBrandPalette(store.brand) : { main: '#1A202C', text: '#FFFFFF', light: '#F1F5F9' };

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── Header couleur enseigne ──────────────────────────────────────── */}
      <Animated.View style={[s.header, { backgroundColor: pal.main, opacity: headerO, transform: [{ translateY: headerY }] }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtnWrap}>
          <BlurView intensity={35} tint="dark" style={s.backBtn}>
            <MaterialIcons name="arrow-back" size={20} color="#F8FAFC" />
          </BlurView>
        </TouchableOpacity>

        {loadingStore ? (
          <ActivityIndicator color={pal.text} />
        ) : store ? (
          <View style={s.headerContent}>
            <BrandBadge brand={store.brand} />
            <View style={{ flex: 1 }}>
              <Text style={[s.storeName, { color: pal.text }]} numberOfLines={1}>{store.name}</Text>
              <Text style={[s.storeAddress, { color: pal.text === '#FFFFFF' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.55)' }]} numberOfLines={1}>
                {store.address}, {store.city}
              </Text>
              {store.openingHours && (
                <View style={s.hoursRow}>
                  <MaterialIcons name="access-time" size={11} color={pal.text === '#FFFFFF' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)'} />
                  <Text style={[s.hoursText, { color: pal.text === '#FFFFFF' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)' }]}>{store.openingHours}</Text>
                </View>
              )}
            </View>
            {store.isSponsored && (
              <View style={s.sponsoredBadge}>
                <MaterialIcons name="star" size={11} color="#FF6B00" />
                <Text style={s.sponsoredTxt}>Pro</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={s.storeName}>Magasin introuvable</Text>
        )}

        {/* Score de fiabilité */}
        {store && (
          <View style={s.reliabilityRow}>
            <ReliabilityBadge score={store.reliabilityScore} />
            <Text style={s.promoCountTxt}>
              {store.promoCount} signalement{store.promoCount !== 1 ? 's' : ''} communautaire{store.promoCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* ── Modal de signalement ─────────────────────────────────────────── */}
      <FlagReportModal
        visible={flagTarget !== null}
        productName={flagTarget ?? ''}
        storeId={typeof id === 'string' ? id : ''}
        onClose={() => setFlagTarget(null)}
      />

      {/* ── Contenu scrollable ────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1 : Promotions Confirmées ─────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionDot, { backgroundColor: '#FF6B00' }]} />
            <Text style={s.sectionTitle}>Promotions Confirmées</Text>
            <Text style={s.sectionCount}>{promos.length}</Text>
          </View>

          {loadingPromos ? (
            <View style={s.loadingRow}>
              <ActivityIndicator color="#FF6B00" size="small" />
              <Text style={s.loadingTxt}>Chargement des promos…</Text>
            </View>
          ) : promos.length === 0 ? (
            <View style={s.emptyCard}>
              <MaterialIcons name="local-offer" size={32} color="#CBD5E1" />
              <Text style={s.emptyTitle}>Aucune promo vérifiée</Text>
              <Text style={s.emptySub}>
                Soyez la première Sentinelle à signaler une promo dans ce magasin !
              </Text>
            </View>
          ) : (
            promos.map((item) => (
              <PromoCard
                key={item.id}
                item={item}
                onFlag={() => setFlagTarget(item.productName)}
              />
            ))
          )}
        </View>

        {/* ── Section 2 : Prix en Ligne ─────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={s.sectionTitle}>Prix en Ligne</Text>
            <View style={s.todoBadge}>
              <Text style={s.todoTxt}>Sources digitales</Text>
            </View>
          </View>

          <View style={s.onlineCard}>
            <View style={s.onlineCardHeader}>
              <MaterialIcons name="public" size={15} color="#3B82F6" />
              <Text style={s.onlineCardTitle}>
                Prix constatés — {store?.name ?? 'ce magasin'}
              </Text>
              <Text style={s.onlineCardDate}>Aujourd'hui</Text>
            </View>

            {ONLINE_PRICE_PLACEHOLDER.map((item) => (
              <OnlinePriceRow
                key={item.name}
                {...item}
                onFlag={() => setFlagTarget(item.name)}
              />
            ))}

            <View style={s.onlineCardFooter}>
              <MaterialIcons name="info-outline" size={12} color="#94A3B8" />
              <Text style={s.onlineCardFooterTxt}>
                Données issues des tickets scannés par la communauté · Mise à jour quotidienne
              </Text>
            </View>
          </View>
        </View>

        {/* ── CTA Signaler ──────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.ctaBtn}
          activeOpacity={0.88}
          onPress={() => router.push('/report-promo')}
        >
          <MaterialIcons name="add-circle" size={20} color="#FFFFFF" />
          <Text style={s.ctaBtnTxt}>Signaler une promo dans ce magasin</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header (backgroundColor injecté inline = couleur officielle de l'enseigne)
  header: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  backBtnWrap: { alignSelf: 'flex-start' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  storeName: {
    fontSize: 17, fontWeight: '800', color: '#F8FAFC', lineHeight: 22,
  },
  storeAddress: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  hoursRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  hoursText:    { fontSize: 11, color: '#64748B' },
  sponsoredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FF6B0018', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#FF6B0044',
  },
  sponsoredTxt: { fontSize: 10, fontWeight: '800', color: '#FF6B00' },
  reliabilityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 4,
  },
  promoCountTxt: { fontSize: 12, color: '#64748B' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },

  // Sections
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12,
  },
  sectionDot:   { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', flex: 1 },
  sectionCount: {
    fontSize: 12, fontWeight: '700', color: '#94A3B8',
    backgroundColor: '#F1F5F9', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  todoBadge: {
    backgroundColor: '#DBEAFE', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  todoTxt: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },

  // Loading & Empty
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 20,
  },
  loadingTxt: { fontSize: 13, color: '#94A3B8' },
  emptyCard: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16,
    backgroundColor: '#FFFFFF', borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginTop: 10 },
  emptySub:   { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4, lineHeight: 18 },

  // Carte prix en ligne
  onlineCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  onlineCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  onlineCardTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1E40AF' },
  onlineCardDate:  { fontSize: 11, color: '#94A3B8' },
  onlineCardFooter: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 5,
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  onlineCardFooterTxt: { flex: 1, fontSize: 10, color: '#94A3B8', lineHeight: 14 },

  // CTA
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FF6B00', borderRadius: 16,
    paddingVertical: 16, marginTop: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
