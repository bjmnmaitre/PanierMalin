// screens/ImmanquablesScreen.tsx
// Les Immanquables — double onglet (Catalogue + Communauté), grille 2 colonnes, shimmer

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Dimensions, Modal, TextInput, Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ModernBottomNav, { type TabKey } from '@/components/features/ModernBottomNav';
import { colors, spacing, radii, shadows, typography } from '@/design';
import {
  type PromoItem,
  getNationalPromos,
  getCommunityPromos,
  verifyPromoItem,
  pickAndUploadPromoPhoto,
} from '@/services/promoService';
import { useCart } from '@/contexts/CartContext';
import { type HabitList, loadHabitLists } from '@/services/habitListService';
import {
  addToWatchlist,
  removeFromWatchlist,
} from '@/services/watchlistService';
import { estimateBasePrice } from '@/services/inventoryService';
import { apiClient } from '@/services/api/client';

// ─── Types hérités (pour la prop onSelectDeal) ────────────────────────────────

export interface DealItem {
  id: string; name: string; brand: string; discount: number;
  originalPrice: number; currentPrice: number; store: string;
  ean?: string; expiresAt?: string;
}

export interface ImmanquablesScreenProps {
  onNavigate:   (tab: TabKey) => void;
  onSelectDeal: (deal: DealItem) => void;
}

// ─── Constantes layout ───────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD  = spacing[4];
const COL_GAP = spacing[3];
const CARD_W = (SCREEN_W - H_PAD * 2 - COL_GAP) / 2;

// ─── Catégorie → couleur de fond de la carte (mode catalogue) ────────────────

const CATEGORY_COLORS: Record<string, string> = {
  'Boissons':        '#DBEAFE',
  'Bébé':            '#FEE2E2',
  'Épicerie sucrée': '#FEF3C7',
  'Épicerie':        '#D1FAE5',
  'Hygiène':         '#EDE9FE',
  'Crèmerie':        '#FCE7F3',
  'Entretien':       '#E0F2FE',
  'Petit-déjeuner':  '#FFF7ED',
};
const CATEGORY_ICON_COLOR: Record<string, string> = {
  'Boissons':        '#2563EB',
  'Bébé':            '#DC2626',
  'Épicerie sucrée': '#D97706',
  'Épicerie':        '#059669',
  'Hygiène':         '#7C3AED',
  'Crèmerie':        '#DB2777',
  'Entretien':       '#0284C7',
  'Petit-déjeuner':  '#EA580C',
};
const DEFAULT_CAT_COLOR = '#F1F5F9';

// ─── Composant ShimmerCard ────────────────────────────────────────────────────

function ShimmerCard() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View style={[sh.card, { width: CARD_W, opacity: anim }]}>
      <View style={sh.imgPlaceholder} />
      <View style={sh.body}>
        <View style={sh.line} />
        <View style={[sh.line, sh.lineShort]} />
        <View style={[sh.line, sh.lineMini]} />
      </View>
    </Animated.View>
  );
}

const sh = StyleSheet.create({
  card:           { borderRadius: radii.xl, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  imgPlaceholder: { height: 90, backgroundColor: '#CBD5E1' },
  body:           { padding: spacing[3], gap: spacing[2] },
  line:           { height: 10, borderRadius: 5, backgroundColor: '#CBD5E1' },
  lineShort:      { width: '60%' },
  lineMini:       { width: '40%' },
});

// ─── Composant PromoCard ─────────────────────────────────────────────────────

interface PromoCardProps {
  promo:        PromoItem;
  verified:     boolean;
  addedToCart:  boolean;
  watched:      boolean;
  isNew:        boolean;
  isHot:        boolean;
  onVerify:     () => void;
  onPress:      () => void;
  onAddToCart:  () => void;
  onWatch:      () => void;
  onLongPress:  () => void;
}

function PromoCard({
  promo, verified, addedToCart, watched, isNew, isHot,
  onVerify, onPress, onAddToCart, onWatch, onLongPress,
}: PromoCardProps) {
  const catBg   = CATEGORY_COLORS[promo.category] ?? DEFAULT_CAT_COLOR;
  const catClr  = CATEGORY_ICON_COLOR[promo.category] ?? '#64748B';
  const fmtDate = promo.expiresAt
    ? promo.expiresAt.slice(5).replace('-', '/')
    : null;

  return (
    <TouchableOpacity style={[pc.card, { width: CARD_W }]} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.88}>
      {/* Image communautaire ou bandeau catégorie */}
      {promo.source === 'community' && promo.imageUrl ? (
        <ExpoImage
          source={{ uri: promo.imageUrl }}
          style={pc.promoImg}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : (
        <View style={[pc.catBand, { backgroundColor: catBg }]}>
          <MaterialIcons name="local-offer" size={20} color={catClr} />
          <Text style={[pc.catLabel, { color: catClr }]} numberOfLines={1}>{promo.category}</Text>
        </View>
      )}

      {/* Badge -X% */}
      {promo.discount > 0 && (
        <View style={pc.discBadge}>
          <Text style={pc.discTxt}>-{promo.discount}%</Text>
        </View>
      )}

      {/* Badge Realtime */}
      {isHot && (
        <View style={[pc.rtBadge, pc.rtBadgeHot]}>
          <Text style={pc.rtBadgeTxt}>🔥 Hot !</Text>
        </View>
      )}
      {!isHot && isNew && (
        <View style={[pc.rtBadge, pc.rtBadgeNew]}>
          <Text style={pc.rtBadgeTxt}>Nouveau !</Text>
        </View>
      )}

      <View style={pc.body}>
        <Text style={pc.name} numberOfLines={2}>{promo.name}</Text>
        <Text style={pc.sub}  numberOfLines={1}>{promo.brand} · {promo.store}</Text>

        <View style={pc.priceRow}>
          <Text style={pc.price}>{promo.currentPrice.toFixed(2)}€</Text>
          {promo.originalPrice > promo.currentPrice && (
            <Text style={pc.originalPrice}>{promo.originalPrice.toFixed(2)}€</Text>
          )}
        </View>

        {fmtDate && <Text style={pc.expiry}>Jusqu'au {fmtDate}</Text>}

        <TouchableOpacity
          style={[pc.verifyBtn, verified && pc.verifyBtnActive]}
          onPress={onVerify}
          activeOpacity={0.8}
          hitSlop={6}
        >
          <MaterialIcons name="thumb-up" size={11} color={verified ? '#fff' : '#64748B'} />
          <Text style={[pc.verifyTxt, verified && pc.verifyTxtActive]}>
            {verified ? 'Vérifié !' : `Vérifié · ${promo.verifiedCount}`}
          </Text>
        </TouchableOpacity>

        {/* Actions rapides : panier + alerte prix */}
        <View style={pc.actionRow}>
          <TouchableOpacity
            style={[pc.actionBtn, addedToCart && pc.actionBtnGreen]}
            onPress={onAddToCart}
            activeOpacity={0.8}
            hitSlop={4}
          >
            <MaterialIcons
              name={addedToCart ? 'check' : 'add-shopping-cart'}
              size={14}
              color={addedToCart ? '#fff' : '#1D9E75'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[pc.actionBtn, watched && pc.actionBtnAmber]}
            onPress={onWatch}
            activeOpacity={0.8}
            hitSlop={4}
          >
            <Ionicons
              name={watched ? 'notifications' : 'notifications-outline'}
              size={14}
              color={watched ? '#fff' : '#F59E0B'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  card: {
    borderRadius: radii.xl, backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...shadows.sm,
  },
  promoImg: { width: '100%', height: 90 },
  catBand: {
    height: 72, paddingHorizontal: spacing[3],
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
  },
  catLabel: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  discBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#EF4444', borderRadius: radii.sm,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  discTxt: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },
  body: { padding: spacing[3], gap: 4 },
  name: { fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 17 },
  sub:  { fontSize: 10, color: '#64748B' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 2 },
  price: { fontSize: 16, fontWeight: '900', color: '#1D9E75' },
  originalPrice: { fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through' },
  expiry: { fontSize: 9, color: '#F59E0B', fontWeight: '600', marginTop: 1 },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F1F5F9', borderRadius: radii.sm,
    paddingHorizontal: 7, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start',
  },
  verifyBtnActive:  { backgroundColor: '#1D9E75' },
  verifyTxt:        { fontSize: 9, fontWeight: '700', color: '#64748B' },
  verifyTxtActive:  { color: '#FFFFFF' },
  actionRow: {
    flexDirection: 'row', gap: 6, marginTop: 6,
  },
  actionBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  actionBtnGreen: { backgroundColor: '#1D9E75' },
  actionBtnAmber: { backgroundColor: '#F59E0B' },
  rtBadge: {
    position: 'absolute', top: 8, left: 8,
    borderRadius: radii.sm, paddingHorizontal: 5, paddingVertical: 2,
  },
  rtBadgeNew: { backgroundColor: '#3B82F6' },
  rtBadgeHot: { backgroundColor: '#EF4444' },
  rtBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },
});

// ─── Composant principal ──────────────────────────────────────────────────────

type TabId = 'catalogue' | 'community';

export default function ImmanquablesScreen({ onNavigate, onSelectDeal }: ImmanquablesScreenProps) {
  const insets = useSafeAreaInsets();
  const cart   = useCart();

  const [activeTab, setActiveTab]           = useState<TabId>('catalogue');
  const [cataloguePromos]                   = useState<PromoItem[]>(getNationalPromos);
  const [communityPromos, setCommunityPromos] = useState<PromoItem[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [verifiedIds, setVerifiedIds]       = useState<Set<string>>(new Set());
  const [addedToCartIds, setAddedToCartIds] = useState<Set<string>>(new Set());
  const [watchedIds, setWatchedIds]         = useState<Set<string>>(new Set());
  const [signalLoading, setSignalLoading]   = useState(false);
  // Realtime : ids des promos fraîchement arrivées (badge "Nouveau !")
  const [newIds, setNewIds]   = useState<Set<string>>(new Set());
  // Realtime : ids des promos très intéressantes (badge "🔥 Hot !")
  const [hotIds, setHotIds]   = useState<Set<string>>(new Set());

  // Feuille de sélection liste d'habitude (long-press)
  const [habitSheetVisible, setHabitSheetVisible] = useState(false);
  const [selectedPromo, setSelectedPromo]         = useState<PromoItem | null>(null);
  const [habitLists, setHabitLists]               = useState<HabitList[]>([]);

  // Modal "Signaler une promo"
  const [signalModal, setSignalModal] = useState(false);
  const [signalName,  setSignalName]  = useState('');
  const [signalPrice, setSignalPrice] = useState('');
  const [signalStore, setSignalStore] = useState('');
  const [signalImageUrl, setSignalImageUrl] = useState<string | null>(null);
  const [signalSubmitting, setSignalSubmitting] = useState(false);

  useEffect(() => {
    getCommunityPromos()
      .then(setCommunityPromos)
      .catch(() => setCommunityPromos([]))
      .finally(() => setCommunityLoading(false));
  }, []);

  useEffect(() => {
    loadHabitLists().then(setHabitLists).catch(() => {});
  }, []);

  // ── Abonnement Realtime Supabase (store_inventory) ─────────────────────────
  useEffect(() => {
    const supabase = apiClient.getSupabase();
    const channel  = supabase
      .channel('pm-community-promos')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'store_inventory',
          filter: "source=in.(user,scan)",
        },
        (payload) => {
          const row = payload.new as {
            id: string; product_name: string; price: number;
            confidence_score: number; store_id?: string;
          } | null;
          if (!row) return;

          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          const base      = estimateBasePrice(row.product_name);
          const current   = Number(row.price);
          const original  = Math.max(current * 1.15, base);
          const discount  = Math.round(Math.max(0, (1 - current / original) * 100));
          const promoId   = `comm-${row.id}`;
          const isHot     = Number(row.confidence_score) >= 0.8 || discount >= 30;

          const newPromo: PromoItem = {
            id:               promoId,
            storeInventoryId: row.id,
            name:             row.product_name,
            brand:            'Communauté',
            store:            'Magasin',
            discount,
            originalPrice:    Math.round(original * 100) / 100,
            currentPrice:     current,
            source:           'community',
            verifiedCount:    Math.round(Number(row.confidence_score) * 10),
            category:         'Épicerie',
          };

          setCommunityPromos((prev) => {
            const idx = prev.findIndex((p) => p.id === promoId);
            return idx >= 0
              ? prev.map((p, i) => (i === idx ? newPromo : p))
              : [newPromo, ...prev];
          });

          // Badge "Nouveau !" pendant 8 s
          setNewIds((prev) => new Set([...prev, promoId]));
          setTimeout(() => {
            setNewIds((prev) => { const n = new Set(prev); n.delete(promoId); return n; });
          }, 8000);

          if (isHot) {
            setHotIds((prev) => new Set([...prev, promoId]));
            setTimeout(() => {
              setHotIds((prev) => { const n = new Set(prev); n.delete(promoId); return n; });
            }, 15000);
          }
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, []);

  const displayPromos = activeTab === 'catalogue' ? cataloguePromos : communityPromos;
  const isLoading     = activeTab === 'community' && communityLoading;

  const handleVerify = useCallback((promo: PromoItem) => {
    if (verifiedIds.has(promo.id)) return;
    setVerifiedIds((prev) => new Set([...prev, promo.id]));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (promo.source === 'community') {
      setCommunityPromos((prev) =>
        prev.map((p) => p.id === promo.id ? { ...p, verifiedCount: p.verifiedCount + 1 } : p),
      );
    }
    if (promo.storeInventoryId) {
      verifyPromoItem(promo.storeInventoryId).catch(() => {
        setVerifiedIds((prev) => { const next = new Set(prev); next.delete(promo.id); return next; });
      });
    }
  }, [verifiedIds]);

  const doAddToCart = useCallback((promo: PromoItem) => {
    cart.addItem(promo.name);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddedToCartIds((prev) => new Set([...prev, promo.id]));
    setTimeout(() => {
      setAddedToCartIds((prev) => { const next = new Set(prev); next.delete(promo.id); return next; });
    }, 1500);
  }, [cart]);

  const handleAddToCart = useCallback((promo: PromoItem) => {
    const promoStore   = promo.store;
    const locked       = cart.lockedStore;

    // Pas de magasin verrouillé → ajout direct + verrouillage
    if (!locked || locked === promoStore || cart.items.length === 0) {
      if (promoStore) cart.setLockedStore(promoStore);
      doAddToCart(promo);
      return;
    }

    // Conflit détecté → boîte de dialogue stylisée
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      '⚠️ Conflit de panier',
      `Ce produit est en promotion chez ${promoStore}, mais votre panier est actuellement optimisé pour ${locked}.\n\nQue souhaitez-vous faire ?`,
      [
        {
          text: `Démarrer chez ${promoStore}`,
          style: 'destructive',
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            cart.clearCart();
            cart.setLockedStore(promoStore);
            doAddToCart(promo);
          },
        },
        {
          text: 'Fusionner (Multi-store)',
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            cart.setLockedStore(null);   // mode multi-store, pas de verrou
            doAddToCart(promo);
          },
        },
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
        },
      ],
    );
  }, [cart, doAddToCart]);

  const handleWatch = useCallback(async (promo: PromoItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (watchedIds.has(promo.id)) {
      setWatchedIds((prev) => { const next = new Set(prev); next.delete(promo.id); return next; });
      await removeFromWatchlist(promo.id);
    } else {
      setWatchedIds((prev) => new Set([...prev, promo.id]));
      await addToWatchlist({
        id:           promo.id,
        name:         promo.name,
        category:     promo.category,
        basePrice:    estimateBasePrice(promo.name),
        currentPrice: promo.currentPrice,
        store:        promo.store,
      });
    }
  }, [watchedIds]);

  const handleLongPressPromo = useCallback((promo: PromoItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPromo(promo);
    setHabitSheetVisible(true);
  }, []);

  const handleAddToHabitList = useCallback((_list: HabitList) => {
    if (!selectedPromo) return;
    // Note : la modification de la liste d'habitude s'effectue via habitListService
    // mais pour l'instant on ferme simplement la sheet (modification AsyncStorage
    // en écriture directe alourdirait la UX pour ce flow secondaire)
    setHabitSheetVisible(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedPromo]);

  const handlePickPhoto = useCallback(async () => {
    const url = await pickAndUploadPromoPhoto();
    if (url) { setSignalImageUrl(url); setSignalModal(true); }
  }, []);

  const handleSignalFAB = useCallback(async () => {
    setSignalLoading(true);
    try { await handlePickPhoto(); }
    finally { setSignalLoading(false); }
  }, [handlePickPhoto]);

  const handleSignalSubmit = useCallback(async () => {
    if (!signalName.trim()) return;
    setSignalSubmitting(true);
    try {
      const price = parseFloat(signalPrice) || 0;
      const newPromo: PromoItem = {
        id: `local-${Date.now()}`,
        name: signalName.trim(),
        brand: 'Communauté',
        store: signalStore.trim() || 'Magasin local',
        discount: 0,
        originalPrice: price * 1.2,
        currentPrice: price,
        imageUrl: signalImageUrl ?? undefined,
        source: 'community',
        verifiedCount: 0,
        category: 'Épicerie',
      };
      setCommunityPromos((prev) => [newPromo, ...prev]);
      setActiveTab('community');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSignalModal(false);
      setSignalName(''); setSignalPrice(''); setSignalStore(''); setSignalImageUrl(null);
      Alert.alert('Merci !', 'Votre signalement a été ajouté à la communauté.');
    } finally {
      setSignalSubmitting(false);
    }
  }, [signalName, signalPrice, signalStore, signalImageUrl]);

  const switchTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const tabSubtitle = useMemo(() => activeTab === 'catalogue'
    ? `${cataloguePromos.length} offres nationales cette semaine`
    : `${communityPromos.length} signalements de la communauté`,
    [activeTab, cataloguePromos.length, communityPromos.length],
  );

  return (
    <View style={styles.container}>
      {/* ── En-tête BlurView ───────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.headerRow}>
          <MaterialIcons name="local-fire-department" size={26} color="#FF6B00" />
          <Text style={styles.headerTitle}>Les Immanquables</Text>
          <TouchableOpacity
            style={styles.signalBtn}
            onPress={handleSignalFAB}
            disabled={signalLoading}
            hitSlop={8}
          >
            {signalLoading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="camera-outline" size={22} color={colors.primary} />}
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>{tabSubtitle}</Text>

        {/* Tabs pills */}
        <View style={styles.tabsRow}>
          {([
            { id: 'catalogue' as TabId, label: '🌐 Offres Catalogues' },
            { id: 'community' as TabId, label: '👥 Vu en magasin' },
          ]).map(({ id, label }) => (
            <TouchableOpacity
              key={id}
              style={[styles.tabPill, activeTab === id && styles.tabPillActive]}
              onPress={() => switchTab(id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabTxt, activeTab === id && styles.tabTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Grille de promos ───────────────────────────────────── */}
      {isLoading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => <ShimmerCard key={i} />)}
        </View>
      ) : displayPromos.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="inbox" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTxt}>
            {activeTab === 'community'
              ? 'Aucune promo signalée encore.\nSoyez le premier !'
              : 'Aucune offre disponible.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {displayPromos.map((promo) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                verified={verifiedIds.has(promo.id)}
                addedToCart={addedToCartIds.has(promo.id)}
                watched={watchedIds.has(promo.id)}
                isNew={newIds.has(promo.id)}
                isHot={hotIds.has(promo.id)}
                onVerify={() => handleVerify(promo)}
                onAddToCart={() => handleAddToCart(promo)}
                onWatch={() => { void handleWatch(promo); }}
                onLongPress={() => handleLongPressPromo(promo)}
                onPress={() => onSelectDeal({
                  id: promo.id,
                  name: promo.name,
                  brand: promo.brand,
                  discount: promo.discount,
                  originalPrice: promo.originalPrice,
                  currentPrice: promo.currentPrice,
                  store: promo.store,
                  ean: promo.ean,
                  expiresAt: promo.expiresAt,
                })}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Modal "Signaler une promo" ─────────────────────────── */}
      <Modal
        visible={signalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setSignalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Signaler une promo</Text>

            {signalImageUrl && (
              <ExpoImage
                source={{ uri: signalImageUrl }}
                style={[styles.signalPreview, { borderRadius: radii.lg }]}
                contentFit="cover"
              />
            )}

            <TextInput
              style={styles.modalInput}
              placeholder="Nom du produit *"
              placeholderTextColor="#94A3B8"
              value={signalName}
              onChangeText={setSignalName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Prix promo (€)"
              placeholderTextColor="#94A3B8"
              value={signalPrice}
              onChangeText={setSignalPrice}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Nom du magasin"
              placeholderTextColor="#94A3B8"
              value={signalStore}
              onChangeText={setSignalStore}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setSignalModal(false)}
                disabled={signalSubmitting}
              >
                <Text style={styles.modalBtnCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSubmit, !signalName.trim() && styles.modalBtnDisabled]}
                onPress={handleSignalSubmit}
                disabled={signalSubmitting || !signalName.trim()}
              >
                {signalSubmitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnSubmitTxt}>Publier</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Feuille de sélection liste d'habitude (long-press) ─── */}
      <Modal
        visible={habitSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHabitSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setHabitSheetVisible(false)}
        >
          <View style={styles.habitSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              Ajouter à une liste d'habitude
            </Text>
            {selectedPromo && (
              <Text style={styles.habitSheetSub} numberOfLines={1}>
                {selectedPromo.name}
              </Text>
            )}
            <ScrollView style={{ maxHeight: 260 }}>
              {habitLists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={styles.habitListRow}
                  onPress={() => handleAddToHabitList(list)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.habitListEmoji}>{list.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.habitListName}>{list.title}</Text>
                    <Text style={styles.habitListMeta}>
                      {list.items.length} article{list.items.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="add" size={20} color={colors.primary} />
                </TouchableOpacity>
              ))}
              {habitLists.length === 0 && (
                <Text style={styles.habitEmptyTxt}>
                  Aucune liste — créez-en une dans Mes listes.
                </Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ModernBottomNav active="immanquables" onNavigate={onNavigate} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header BlurView
  header: {
    overflow: 'hidden',
    borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.7)',
    paddingHorizontal: H_PAD,
    paddingBottom: spacing[3],
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingTop: spacing[3], paddingBottom: spacing[1],
  },
  headerTitle: { ...typography.h2, color: '#0F172A', flex: 1 },
  signalBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primary_light,
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: { ...typography.bodyMedium, color: '#64748B', marginBottom: spacing[3] },
  tabsRow: { flexDirection: 'row', gap: spacing[2] },
  tabPill: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radii.full, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  tabPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  tabTxt:        { fontSize: 13, fontWeight: '600', color: '#475569' },
  tabTxtActive:  { color: '#FFFFFF' },

  // Grille
  scrollContent: { paddingBottom: spacing[20] },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: COL_GAP, paddingHorizontal: H_PAD, paddingTop: spacing[4],
  },

  // État vide
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3] },
  emptyTxt:   { ...typography.bodyMedium, color: '#94A3B8', textAlign: 'center' },

  // Modal signalement
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing[5], paddingBottom: spacing[8], paddingTop: spacing[2],
    gap: spacing[3],
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: '#CBD5E1',
    borderRadius: 2, alignSelf: 'center', marginBottom: spacing[2],
  },
  modalTitle: { ...typography.h3, color: '#0F172A', textAlign: 'center' },
  signalPreview: { width: '100%', height: 160 },
  modalInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radii.lg,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    fontSize: 15, color: '#0F172A', backgroundColor: '#F8FAFC',
  },
  modalBtnRow:      { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  modalBtnCancel:   { flex: 1, height: 48, borderRadius: radii.lg, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  modalBtnCancelTxt:{ fontSize: 15, fontWeight: '600', color: '#475569' },
  modalBtnSubmit:   { flex: 1, height: 48, borderRadius: radii.lg, backgroundColor: '#1D9E75', alignItems: 'center', justifyContent: 'center' },
  modalBtnDisabled: { opacity: 0.5 },
  modalBtnSubmitTxt:{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Habit selection sheet
  habitSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'],
    paddingHorizontal: H_PAD, paddingTop: spacing[2], paddingBottom: spacing[6],
    ...shadows.lg,
  },
  habitSheetSub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: spacing[3] },
  habitListRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  habitListEmoji: { fontSize: 24 },
  habitListName:  { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  habitListMeta:  { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  habitEmptyTxt:  { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: spacing[4] },
});
