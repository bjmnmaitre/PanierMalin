// screens/RewardsScreen.tsx
// Boutique MalinCoins — solde dynamique, catalogue, portefeuille offline, barcode vectoriel

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Easing, Alert, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Barcode from '../components/primitives/Barcode';
import { getMalinCoinsBalance, redeemVoucher, getUserVouchers, MalinCoinVoucher } from '../services/api';
import { addPurchasedVoucher, loadPurchasedVouchers, PurchasedVoucher } from '../services/offlineStorage';
import { Colors } from '../theme/colors';
import { Radii, Shadows } from '../theme/typography';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 48) / 2;

// ─── Paliers de fidélité ──────────────────────────────────────────────────────

const TIERS = [
  { label: 'Partant',  min: 0,    color: '#94A3B8', icon: '🌱' },
  { label: 'Bronze',   min: 200,  color: '#CD7F32', icon: '🥉' },
  { label: 'Argent',   min: 500,  color: '#6B7280', icon: '🥈' },
  { label: 'Or',       min: 1000, color: '#F59E0B', icon: '🥇' },
  { label: 'Platine',  min: 2000, color: '#818CF8', icon: '💎' },
];

function getTierForCoins(coins: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (coins >= TIERS[i].min) return { tier: TIERS[i], nextTier: TIERS[i + 1] ?? null };
  }
  return { tier: TIERS[0], nextTier: TIERS[1] };
}

// ─── Header avec jauge ────────────────────────────────────────────────────────

function CoinsHeader({ coins }: { coins: number }) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const { tier, nextTier } = getTierForCoins(coins);
  const progress = nextTier
    ? Math.min(1, (coins - tier.min) / (nextTier.min - tier.min))
    : 1;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barW = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={hdr.wrap}>
      <View style={hdr.topRow}>
        <View>
          <Text style={hdr.tier}>{tier.icon} {tier.label}</Text>
          <View style={hdr.coinRow}>
            <Text style={hdr.coins}>{coins.toLocaleString('fr-FR')}</Text>
            <Text style={hdr.label}> MalinCoins</Text>
          </View>
        </View>
        {nextTier && (
          <View style={hdr.nextTierBadge}>
            <Text style={hdr.nextTierText}>Prochain : {nextTier.icon} {nextTier.label}</Text>
            <Text style={hdr.nextTierSub}>{(nextTier.min - coins).toLocaleString('fr-FR')} coins restants</Text>
          </View>
        )}
      </View>

      <View style={hdr.track}>
        <Animated.View style={[hdr.fill, { width: barW, backgroundColor: tier.color }]} />
      </View>

      <View style={hdr.stepsRow}>
        {TIERS.map((t) => (
          <View key={t.label} style={hdr.step}>
            <View style={[hdr.stepDot, coins >= t.min && { backgroundColor: t.color }]} />
            <Text style={[hdr.stepLabel, coins >= t.min && { color: t.color }]}>{t.min}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const hdr = StyleSheet.create({
  wrap: {
    backgroundColor: '#0F172A', borderRadius: Radii.card,
    padding: 20, marginHorizontal: 16, marginBottom: 4, ...Shadows.active,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  tier: { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginBottom: 4 },
  coinRow: { flexDirection: 'row', alignItems: 'flex-end' },
  coins: { fontSize: 40, fontWeight: '900', color: '#FFD700' },
  label: { fontSize: 14, color: '#64748B', fontWeight: '600', paddingBottom: 6 },
  nextTierBadge: { alignItems: 'flex-end' },
  nextTierText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  nextTierSub: { fontSize: 10, color: '#475569', marginTop: 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: '#1E293B', overflow: 'hidden', marginBottom: 10 },
  fill: { height: 8, borderRadius: 4 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { alignItems: 'center', gap: 3 },
  stepDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#334155' },
  stepLabel: { fontSize: 9, color: '#475569' },
});

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#FF6B00', '#FFD700', '#10B981', '#6366F1', '#EF4444', '#0EA5E9'];

function ConfettiPieces({ trigger }: { trigger: number }) {
  const pieces = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      x:     new Animated.Value(SW / 2 + (Math.random() - 0.5) * 50),
      y:     new Animated.Value(-20),
      rot:   new Animated.Value(0),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size:  6 + Math.random() * 8,
    }))
  ).current;

  useEffect(() => {
    if (!trigger) return;
    pieces.forEach((p, i) => {
      p.x.setValue(SW * 0.3 + Math.random() * SW * 0.4);
      p.y.setValue(-20);
      p.rot.setValue(0);
      const delay = i * 28;
      Animated.parallel([
        Animated.timing(p.y, { toValue: 700 + Math.random() * 200, duration: 1400, delay, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(p.x, { toValue: SW * Math.random(), duration: 1400, delay, useNativeDriver: true }),
        Animated.timing(p.rot, { toValue: (Math.random() - 0.5) * 720, duration: 1400, delay, useNativeDriver: true }),
      ]).start();
    });
  }, [trigger]);

  return (
    <>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0,
            width: p.size, height: p.size,
            backgroundColor: p.color, borderRadius: 2,
            transform: [
              { translateX: p.x }, { translateY: p.y },
              { rotate: p.rot.interpolate({ inputRange: [-720, 720], outputRange: ['-720deg', '720deg'] }) },
            ],
          }}
        />
      ))}
    </>
  );
}

// ─── Popup bon acheté ─────────────────────────────────────────────────────────

interface VoucherPopupProps {
  voucher: PurchasedVoucher;
  onClose: () => void;
}

function VoucherPopup({ voucher, onClose }: VoucherPopupProps) {
  const scale   = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setConfettiKey((k) => k + 1);
  }, []);

  const expiryDate = new Date(voucher.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <View style={pop.backdrop}>
      <ConfettiPieces trigger={confettiKey} />
      <Animated.View style={[pop.card, { transform: [{ scale }], opacity }]}>
        <TouchableOpacity style={pop.closeBtn} onPress={onClose} hitSlop={12}>
          <MaterialIcons name="close" size={22} color="#64748B" />
        </TouchableOpacity>

        <View style={pop.successRow}>
          <MaterialIcons name="check-circle" size={24} color="#10B981" />
          <Text style={pop.successText}>Bon activé avec succès !</Text>
        </View>

        <Text style={pop.emoji}>{voucher.emoji}</Text>
        <Text style={pop.title}>{voucher.title}</Text>
        <Text style={pop.faceValue}>{voucher.faceValue} € de réduction</Text>

        <View style={pop.barcodeWrap}>
          <Barcode code={voucher.barcodeCode} width={SW - 112} height={70} />
        </View>

        <Text style={pop.expiry}>Valable jusqu'au {expiryDate}</Text>
        <Text style={pop.hint}>Présentez ce code en caisse · Fonctionne hors-ligne</Text>

        <TouchableOpacity style={pop.doneBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={pop.doneBtnText}>Parfait, à plus tard !</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const pop = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', zIndex: 100,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24,
    width: SW - 40, alignItems: 'center', gap: 8,
  },
  closeBtn: { position: 'absolute', top: 16, right: 16 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  successText: { fontSize: 15, fontWeight: '700', color: '#10B981' },
  emoji: { fontSize: 44 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  faceValue: { fontSize: 14, color: '#64748B', marginBottom: 4 },
  barcodeWrap: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 8, width: '100%', alignItems: 'center' },
  expiry: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  hint: { fontSize: 11, color: '#CBD5E1', textAlign: 'center' },
  doneBtn: { backgroundColor: '#0F172A', borderRadius: 14, height: 48, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: '#FFD700' },
});

// ─── Carte catalogue ──────────────────────────────────────────────────────────

const VoucherCard = memo(({ voucher, coins, onPress }: {
  voucher: MalinCoinVoucher;
  coins: number;
  onPress: () => void;
}) => {
  const canAfford = coins >= voucher.costCoins;
  return (
    <TouchableOpacity
      style={[vc.card, !canAfford && vc.cardLocked]}
      onPress={canAfford ? onPress : undefined}
      activeOpacity={0.82}
    >
      {!canAfford && (
        <View style={vc.lockBadge}>
          <MaterialIcons name="lock" size={14} color="#94A3B8" />
          <Text style={vc.lockTxt}>{voucher.costCoins - coins} coins manquants</Text>
        </View>
      )}
      <Text style={vc.emoji}>{voucher.emoji}</Text>
      <Text style={vc.brand}>{voucher.brand}</Text>
      <Text style={vc.title} numberOfLines={2}>{voucher.title}</Text>
      <Text style={vc.desc} numberOfLines={2}>{voucher.description}</Text>
      <View style={vc.footer}>
        <View style={[vc.costBadge, !canAfford && vc.costBadgeLocked]}>
          <Text style={[vc.costTxt, !canAfford && vc.costTxtLocked]}>🪙 {voucher.costCoins}</Text>
        </View>
        <Text style={[vc.faceValue, !canAfford && { color: '#94A3B8' }]}>{voucher.faceValue}€</Text>
      </View>
    </TouchableOpacity>
  );
});

const vc = StyleSheet.create({
  card: {
    width: CARD_W, backgroundColor: Colors.surface,
    borderRadius: Radii.card, padding: 14, gap: 6, ...Shadows.soft,
  },
  cardLocked: { opacity: 0.55 },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  lockTxt: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
  emoji: { fontSize: 28 },
  brand: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 14, fontWeight: '800', color: '#0F172A', lineHeight: 18 },
  desc: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  costBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  costBadgeLocked: { backgroundColor: '#F1F5F9' },
  costTxt: { fontSize: 12, fontWeight: '700', color: '#FF6B00' },
  costTxtLocked: { color: '#94A3B8' },
  faceValue: { fontSize: 18, fontWeight: '900', color: '#10B981' },
});

// ─── Carte bon acheté (portefeuille) ─────────────────────────────────────────

function WalletCard({ voucher, onPress }: { voucher: PurchasedVoucher; onPress: () => void }) {
  const expired = new Date(voucher.expiresAt) < new Date();
  const expDate = new Date(voucher.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return (
    <TouchableOpacity
      style={[wc.card, (expired || voucher.used) && wc.cardDim]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={wc.row}>
        <Text style={wc.emoji}>{voucher.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={wc.title} numberOfLines={1}>{voucher.title}</Text>
          <Text style={wc.brand}>{voucher.brand}</Text>
        </View>
        <View style={wc.valueWrap}>
          <Text style={[wc.value, (expired || voucher.used) && { color: '#94A3B8' }]}>{voucher.faceValue}€</Text>
        </View>
      </View>
      <View style={wc.barcodeRow}>
        <Barcode code={voucher.barcodeCode} width={SW - 100} height={44} showLabel={false} />
      </View>
      <View style={wc.footerRow}>
        <Text style={wc.code}>{voucher.barcodeCode}</Text>
        {expired ? (
          <View style={wc.expiredBadge}><Text style={wc.expiredTxt}>Expiré</Text></View>
        ) : voucher.used ? (
          <View style={wc.usedBadge}><Text style={wc.usedTxt}>Utilisé</Text></View>
        ) : (
          <Text style={wc.expiryTxt}>Expire le {expDate}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const wc = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 14, marginBottom: 10, gap: 10, ...Shadows.soft },
  cardDim: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji: { fontSize: 26 },
  title: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  brand: { fontSize: 11, color: '#64748B', marginTop: 2 },
  valueWrap: { backgroundColor: '#ECFDF5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  value: { fontSize: 16, fontWeight: '900', color: '#10B981' },
  barcodeRow: { alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 6 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 9, color: '#CBD5E1', letterSpacing: 1.5 },
  expiryTxt: { fontSize: 11, color: '#94A3B8' },
  expiredBadge: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  expiredTxt: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  usedBadge: { backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  usedTxt: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function RewardsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();

  const [coins, setCoins]                       = useState(0);
  const [catalogue, setCatalogue]               = useState<MalinCoinVoucher[]>([]);
  const [wallet, setWallet]                     = useState<PurchasedVoucher[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [purchasing, setPurchasing]             = useState<string | null>(null);
  const [activePopup, setActivePopup]           = useState<PurchasedVoucher | null>(null);
  const [viewingWallet, setViewingWallet]       = useState<PurchasedVoucher | null>(null);

  // ── Chargement initial
  const loadAll = useCallback(async () => {
    const [balance, offlineWallet] = await Promise.all([
      getMalinCoinsBalance(),
      loadPurchasedVouchers(),
    ]);
    setCoins(balance.coins);
    setCatalogue(balance.vouchers);

    // Merge online + offline (dédupliqué par id)
    try {
      const onlineVouchers = await getUserVouchers();
      const merged = [...onlineVouchers];
      for (const ov of offlineWallet) {
        if (!merged.find((v) => v.id === ov.id)) merged.push(ov);
      }
      merged.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
      setWallet(merged);
      // Sync cache local avec les données en ligne
      await loadPurchasedVouchers(); // just in case save
    } catch {
      setWallet(offlineWallet);
    }

    setLoading(false);
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ── Achat d'un bon
  const handlePurchase = async (voucher: MalinCoinVoucher) => {
    if (coins < voucher.costCoins) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      `Échanger ${voucher.costCoins} MalinCoins`,
      `Obtenir "${voucher.title}" (${voucher.faceValue}€)\n\nSolde après échange : ${coins - voucher.costCoins} coins`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setPurchasing(voucher.id);
            try {
              const purchased = await redeemVoucher(voucher);
              await addPurchasedVoucher(purchased);
              setCoins((c) => Math.max(0, c - voucher.costCoins));
              setWallet((w) => [purchased, ...w]);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setActivePopup(purchased);
            } catch (err) {
              Alert.alert('Erreur', "L'échange a échoué. Réessaie dans un instant.");
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[s.root, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#FF6B00" size="large" />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Boutique MalinCoins</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Jauge + palier */}
        <CoinsHeader coins={coins} />

        {/* ── Portefeuille ───────────────────────────────────────────── */}
        {wallet.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <MaterialIcons name="account-balance-wallet" size={18} color="#0F172A" />
              <Text style={s.sectionTitle}>Mon portefeuille ({wallet.length})</Text>
              <View style={s.offlineBadge}>
                <MaterialIcons name="wifi-off" size={10} color="#64748B" />
                <Text style={s.offlineTxt}>Hors-ligne</Text>
              </View>
            </View>
            <View style={s.walletSection}>
              {wallet.map((v) => (
                <WalletCard key={v.id} voucher={v} onPress={() => setViewingWallet(v)} />
              ))}
            </View>
          </>
        )}

        {/* ── Comment gagner ─────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <MaterialIcons name="info-outline" size={18} color="#0F172A" />
          <Text style={s.sectionTitle}>Comment gagner des coins ?</Text>
        </View>
        <View style={s.howToCard}>
          {[
            { icon: 'camera-alt',   label: 'Partager une promo',        coins: '+15 🪙' },
            { icon: 'thumb-up',     label: 'Vote reçu sur ta promo',     coins: '+5 🪙' },
            { icon: 'person-add',   label: 'Parrainer un ami',           coins: '+100 🪙' },
            { icon: 'receipt-long', label: 'Scanner un ticket de caisse', coins: '+50 🪙' },
          ].map((item) => (
            <View key={item.label} style={s.howToRow}>
              <View style={s.howToIcon}>
                <MaterialIcons name={item.icon as any} size={17} color="#FF6B00" />
              </View>
              <Text style={s.howToLabel}>{item.label}</Text>
              <Text style={s.howToCoins}>{item.coins}</Text>
            </View>
          ))}
        </View>

        {/* ── Catalogue ──────────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <MaterialIcons name="storefront" size={18} color="#0F172A" />
          <Text style={s.sectionTitle}>Bons disponibles</Text>
        </View>
        <View style={s.grid}>
          {catalogue.map((v) => (
            <View key={v.id} style={{ position: 'relative' }}>
              <VoucherCard
                voucher={v}
                coins={coins}
                onPress={() => void handlePurchase(v)}
              />
              {purchasing === v.id && (
                <View style={s.cardLoading}>
                  <ActivityIndicator color="#FF6B00" />
                </View>
              )}
            </View>
          ))}
        </View>

        <Text style={s.legal}>
          Bons valables 30 jours · Non cumulables · Accessibles hors-ligne
        </Text>
      </ScrollView>

      {/* Popup succès achat */}
      {activePopup && (
        <VoucherPopup
          voucher={activePopup}
          onClose={() => setActivePopup(null)}
        />
      )}

      {/* Popup portefeuille */}
      {viewingWallet && (
        <View style={pop.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setViewingWallet(null)} />
          <View style={[pop.card, { gap: 12 }]}>
            <TouchableOpacity style={pop.closeBtn} onPress={() => setViewingWallet(null)} hitSlop={12}>
              <MaterialIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
            <Text style={pop.emoji}>{viewingWallet.emoji}</Text>
            <Text style={pop.title}>{viewingWallet.title}</Text>
            <View style={pop.barcodeWrap}>
              <Barcode code={viewingWallet.barcodeCode} width={SW - 112} height={70} />
            </View>
            <Text style={pop.expiry}>
              Expire le {new Date(viewingWallet.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
            <Text style={pop.hint}>Présentez ce code en caisse · Fonctionne hors-ligne</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  scroll: { paddingTop: 20, paddingBottom: 48, gap: 0 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', flex: 1 },
  offlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  offlineTxt: { fontSize: 10, color: '#64748B', fontWeight: '600' },

  walletSection: { paddingHorizontal: 16 },

  howToCard: {
    marginHorizontal: 16, backgroundColor: Colors.surface,
    borderRadius: Radii.card, padding: 16, gap: 10, ...Shadows.soft, marginBottom: 4,
  },
  howToRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  howToIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center',
  },
  howToLabel: { flex: 1, fontSize: 13, color: '#475569' },
  howToCoins: { fontSize: 13, fontWeight: '800', color: '#FF6B00' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
    paddingHorizontal: 16, marginBottom: 8,
  },
  cardLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: Radii.card,
    alignItems: 'center', justifyContent: 'center',
  },

  legal: { fontSize: 11, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 24 },
});
