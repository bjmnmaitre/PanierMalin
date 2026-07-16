import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import CommunityPromoSkeleton from '../components/features/CommunityPromoSkeleton';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import {
  getLatestPromotions,
  toggleVotePromotion,
  getUserFavoriteStores,
  reportPromotion,
  subscribeToNewPromotions,
  REPORT_REASONS,
  PROMOTIONS_PAGE_SIZE,
  PromotionFeedItem,
  PromotionFilters,
} from '../services/api';
import {
  getInventoryFeedSignals,
  type InventorySignal,
} from '../services/inventoryService';
import { loadFavoriteStores, saveFavoriteStores } from '../services/offlineStorage';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES = ['Tout', 'Alimentation', 'Hygiène', 'Boissons', 'Bazar', 'Animaux'] as const;
type CategoryLabel = typeof CATEGORIES[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs} h`;
  return `Il y a ${Math.floor(hrs / 24)} j`;
}

// SkeletonCard remplacé par CommunityPromoSkeleton (shimmer sweep horizontal)

// ─── Realtime Toast ───────────────────────────────────────────────────────────

interface ToastProps {
  item: PromotionFeedItem;
  onPress: () => void;
  onDismiss: () => void;
}

const RealtimeToast = memo(function RealtimeToast({ item, onPress, onDismiss }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[toastStyles.wrap, { transform: [{ translateY }], opacity }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={toastStyles.toast}
        onPress={() => {
          onDismiss();
          router.push(`/promo/${item.id}` as any);
        }}
        activeOpacity={0.9}
      >
        <View style={toastStyles.dot} />
        <View style={{ flex: 1 }}>
          <Text style={toastStyles.title} numberOfLines={1}>
            🔥 Nouvelle promo : {item.productName}
          </Text>
          <Text style={toastStyles.sub} numberOfLines={1}>
            {item.storeName} · -{item.discountPercent}% · par {item.authorName}
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={10}>
          <MaterialIcons name="close" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
});

const toastStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 200,
    paddingHorizontal: 16, paddingTop: 8,
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0F172A', borderRadius: 14, padding: 12,
    ...Shadows.active,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  title: { fontSize: 13, fontWeight: '700', color: '#F1F5F9' },
  sub: { fontSize: 11, color: '#64748B', marginTop: 2 },
});

// ─── PromoCard ────────────────────────────────────────────────────────────────

const PromoCard = memo(function PromoCard({ item }: { item: PromotionFeedItem }) {
  const router = useRouter();
  const [votes, setVotes]       = useState(item.votesCount);
  const [hasVoted, setHasVoted] = useState(item.hasUserVoted);
  const [voting, setVoting]     = useState(false);
  const [reported, setReported] = useState(false);
  const isVerified = item.status === 'verified';

  const handleReport = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Signaler cette promo',
      'Pourquoi signales-tu cette promotion ?',
      [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () => {
            reportPromotion(item.id, reason)
              .then(() => {
                setReported(true);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Merci !', 'Ta contribution aide à garder le fil propre.');
              })
              .catch(() => Alert.alert('Erreur', "Impossible d'envoyer le signalement."));
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleVoteToggle = async () => {
    if (voting) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const optimisticVoted = !hasVoted;
    setHasVoted(optimisticVoted);
    setVotes((n) => optimisticVoted ? n + 1 : n - 1);
    setVoting(true);
    try {
      const result = await toggleVotePromotion(item.id);
      setHasVoted(result.voted);
      setVotes(result.count);
    } catch {
      setHasVoted(!optimisticVoted);
      setVotes((n) => optimisticVoted ? n - 1 : n + 1);
    } finally {
      setVoting(false);
    }
  };

  return (
    <TouchableOpacity
      style={[cardStyles.card, Shadows.soft, reported && { opacity: 0.5 }]}
      onPress={() => router.push(`/promo/${item.id}` as any)}
      activeOpacity={0.92}
    >
      <View style={cardStyles.authorRow}>
        <View style={cardStyles.avatarPlaceholder}>
          <Text style={cardStyles.avatarInitial}>
            {item.authorName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.authorName}>{item.authorName}</Text>
          <Text style={cardStyles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        {isVerified && (
          <View style={cardStyles.verifiedBadge}>
            <MaterialIcons name="verified" size={12} color={Colors.success} />
            <Text style={cardStyles.verifiedText}>Vérifié</Text>
          </View>
        )}
        {item.status === 'pending' && (
          <View style={cardStyles.pendingBadge}>
            <Text style={cardStyles.pendingText}>En attente</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); handleReport(); }}
          hitSlop={8}
          style={cardStyles.flagBtn}
          disabled={reported}
        >
          <MaterialIcons
            name="flag"
            size={16}
            color={reported ? Colors.error : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <Text style={cardStyles.productName} numberOfLines={2}>{item.productName}</Text>
      <View style={cardStyles.storeRow}>
        <MaterialIcons name="store" size={13} color={Colors.textMuted} />
        <Text style={cardStyles.storeName}>{item.storeName}</Text>
      </View>

      <View style={cardStyles.priceRow}>
        <View style={cardStyles.discountBadge}>
          <MaterialIcons name="trending-down" size={14} color="#FFFFFF" />
          <Text style={cardStyles.discountText}>-{item.discountPercent}%</Text>
        </View>
        <Text style={cardStyles.promoPrice}>
          {item.promoPrice.toFixed(2).replace('.', ',')} €
        </Text>
        <Text style={cardStyles.originalPrice}>
          {item.originalPrice.toFixed(2).replace('.', ',')} €
        </Text>
        <Text style={cardStyles.savings}>
          -{(item.originalPrice - item.promoPrice).toFixed(2).replace('.', ',')} €
        </Text>
      </View>

      {item.proofImageUrl && (
        <Image
          source={{ uri: item.proofImageUrl }}
          style={cardStyles.proofImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      )}

      <TouchableOpacity
        style={[cardStyles.upvoteBtn, hasVoted && cardStyles.upvoteBtnActive]}
        onPress={() => { void handleVoteToggle(); }}
        disabled={voting}
        activeOpacity={0.75}
      >
        <MaterialIcons
          name={hasVoted ? 'thumb-up' : 'thumb-up-off-alt'}
          size={15}
          color={hasVoted ? Colors.success : Colors.textMuted}
        />
        <Text style={[cardStyles.upvoteText, hasVoted && cardStyles.upvoteTextActive]}>
          {"C'est vrai"} · {votes}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ─── InventorySignalCard ──────────────────────────────────────────────────────

function formatTimeAgoSignal(iso: string): string {
  return formatTimeAgo(iso);
}

const InventorySignalCard = memo(function InventorySignalCard({ signal }: { signal: InventorySignal }) {
  const pct = Math.round(signal.confidence * 100);
  const confColor = signal.confidence >= 0.7 ? Colors.success : signal.confidence >= 0.5 ? Colors.warning : Colors.error;
  return (
    <View style={[signalStyles.card, Shadows.soft]}>
      <View style={signalStyles.row}>
        <View style={signalStyles.iconBox}>
          <MaterialIcons name="inventory-2" size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={signalStyles.name} numberOfLines={1}>{signal.productName}</Text>
          <Text style={signalStyles.store} numberOfLines={1}>{signal.storeName}</Text>
        </View>
        <View style={signalStyles.priceBox}>
          <Text style={signalStyles.price}>{signal.price.toFixed(2).replace('.', ',')} €</Text>
          <View style={[signalStyles.confBadge, { backgroundColor: confColor + '22' }]}>
            <Text style={[signalStyles.confTxt, { color: confColor }]}>fiable à {pct} %</Text>
          </View>
        </View>
      </View>
      <Text style={signalStyles.time}>{formatTimeAgoSignal(signal.lastUpdated)}</Text>
    </View>
  );
});

const signalStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card, padding: 12, gap: 6,
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  name:     { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  store:    { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  priceBox: { alignItems: 'flex-end', gap: 2 },
  price:    { fontSize: 16, fontWeight: '800', color: Colors.success },
  confBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  confTxt:  { fontSize: 10, fontWeight: '700' },
  time:     { fontSize: 10, color: Colors.textMuted, marginLeft: 46 },
});

const cardStyles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 14, gap: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarPlaceholder: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  authorName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  timeAgo: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  verifiedText: { fontSize: 10, fontWeight: '700', color: Colors.success },
  pendingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pendingText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  productName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, lineHeight: 21 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeName: { fontSize: 12, color: Colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  discountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.success, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  discountText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  promoPrice: { fontSize: 18, fontWeight: '800', color: Colors.success },
  originalPrice: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'line-through' },
  savings: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  proofImage: { width: '100%', height: 160, borderRadius: Radii.card, marginTop: 4 },
  upvoteBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, backgroundColor: Colors.background,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginTop: 4,
  },
  upvoteBtnActive: { backgroundColor: '#ECFDF5', borderColor: Colors.success },
  upvoteText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  upvoteTextActive: { color: Colors.success },
  flagBtn: { padding: 4, marginLeft: 4 },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (tab: TabKey) => void;
  onOpenLeaderboard: () => void;
  onInviteFriends: () => void;
  onSharePromo?: () => void;
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function CommunityFeedScreen({
  onNavigate,
  onOpenLeaderboard,
  onInviteFriends,
  onSharePromo,
}: Props) {
  const insets = useSafeAreaInsets();

  const [promos, setPromos]                     = useState<PromotionFeedItem[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [filtering, setFiltering]               = useState(false);
  const [refreshing, setRefreshing]             = useState(false);
  const [loadingMore, setLoadingMore]           = useState(false);
  const [hasMore, setHasMore]                   = useState(true);
  const [page, setPage]                         = useState(0);
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryLabel>('Tout');
  const [favoritesOnly, setFavoritesOnly]       = useState(false);
  const [favoriteIds, setFavoriteIds]           = useState<string[]>([]);
  const [toastItem, setToastItem]               = useState<PromotionFeedItem | null>(null);
  const [inventorySignals, setInventorySignals] = useState<InventorySignal[]>([]);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFilters = useRef<PromotionFilters>({});

  // ── Stale-while-revalidate favoris + flux inventaire communautaire
  useEffect(() => {
    loadFavoriteStores().then((cached) => { if (cached) setFavoriteIds(cached); });
    getUserFavoriteStores()
      .then((ids) => { setFavoriteIds(ids); void saveFavoriteStores(ids); })
      .catch(() => {});
    getInventoryFeedSignals(12)
      .then(setInventorySignals)
      .catch(() => {});
  }, []);

  // ── Supabase Realtime
  useEffect(() => {
    const unsub = subscribeToNewPromotions((item) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setToastItem(item);
      // Insérer en tête de liste
      setPromos((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
    });
    return unsub;
  }, []);

  // ── Chargement / rechargement
  const loadPromos = useCallback(async (opts?: {
    isRefresh?: boolean;
    isFilter?: boolean;
    overrideQuery?: string;
    resetPage?: boolean;
  }) => {
    const { isRefresh = false, isFilter = false, overrideQuery, resetPage = false } = opts ?? {};
    if (isRefresh) setRefreshing(true);
    else if (isFilter) setFiltering(true);
    else setLoading(true);

    const currentPage = resetPage ? 0 : 0;
    const filters: PromotionFilters = {
      query:            overrideQuery !== undefined ? overrideQuery : searchQuery,
      category:         selectedCategory,
      favoriteStoreIds: favoritesOnly ? favoriteIds : undefined,
      page:             currentPage,
    };
    activeFilters.current = filters;

    try {
      const items = await getLatestPromotions(filters);
      setPromos(items);
      setPage(0);
      setHasMore(items.length === PROMOTIONS_PAGE_SIZE);
    } catch (err) {
      console.error('[CommunityFeedScreen] getLatestPromotions failed', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setFiltering(false);
    }
  }, [searchQuery, selectedCategory, favoritesOnly, favoriteIds]);

  // ── Chargement page suivante (infinite scroll)
  const loadNextPage = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const filters: PromotionFilters = {
        ...activeFilters.current,
        page: nextPage,
      };
      const items = await getLatestPromotions(filters);
      setPromos((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...items.filter((i) => !ids.has(i.id))];
      });
      setPage(nextPage);
      setHasMore(items.length === PROMOTIONS_PAGE_SIZE);
    } catch {
      /* silent */
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page]);

  useEffect(() => { void loadPromos(); }, []);
  useEffect(() => { void loadPromos({ isFilter: true }); }, [selectedCategory, favoritesOnly]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadPromos({ isFilter: true, overrideQuery: text });
    }, 400);
  };

  const handleCategorySelect = (cat: CategoryLabel) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(cat);
  };

  const handleFavoritesToggle = (value: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavoritesOnly(value);
  };

  // ── Rendu FlatList items
  const renderItem = useCallback(({ item }: { item: PromotionFeedItem }) => (
    <PromoCard item={item} />
  ), []);

  const ListHeaderComponent = useCallback(() => (
    <>
      {/* ── Prix signalés par la communauté (store_inventory feed) ─────── */}
      {inventorySignals.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.sectionLabel}>📦 Prix signalés récemment</Text>
          {inventorySignals.map((sig) => (
            <View key={sig.id} style={{ marginBottom: 8 }}>
              <InventorySignalCard signal={sig} />
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={[styles.referralCard, Shadows.soft]} onPress={onInviteFriends} activeOpacity={0.85}>
        <View style={styles.referralIconBox}>
          <MaterialIcons name="card-giftcard" size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.labelSm, { color: Colors.primary, textTransform: 'uppercase' }]}>Parrainage actif</Text>
          <Text style={[Typography.bodyMd, { fontWeight: '700', color: Colors.textPrimary, marginTop: 1 }]}>
            Offrez 5€, gagnez 5€ en bons d'achat
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.rankingCard, Shadows.soft]} onPress={onOpenLeaderboard} activeOpacity={0.85}>
        <View style={styles.rankingLeft}>
          <View style={styles.trophyCircle}>
            <MaterialIcons name="military-tech" size={24} color={Colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.labelSm, { color: Colors.textSecondary }]}>CLASSEMENT SENTINELLE</Text>
            <Text style={[Typography.bodyLg, { fontWeight: '700', color: Colors.textPrimary, marginTop: 1 }]}>
              Voir le classement complet
            </Text>
          </View>
        </View>
        <View style={styles.rankingLink}>
          <MaterialIcons name="analytics" size={18} color={Colors.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.feedHeader}>
        <Text style={[Typography.h2, { color: Colors.textPrimary }]}>Promos en direct</Text>
        {!loading && !filtering && (
          <Text style={styles.resultCount}>{promos.length} résultat{promos.length !== 1 ? 's' : ''}</Text>
        )}
        <View style={styles.liveDot} />
      </View>

      {loading && (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4].map((i) => <CommunityPromoSkeleton key={i} />)}
        </View>
      )}
    </>
  ), [loading, filtering, promos.length, inventorySignals, onInviteFriends, onOpenLeaderboard]);

  const ListEmptyComponent = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <MaterialIcons name="local-offer" size={40} color={Colors.border} />
        <Text style={[Typography.bodyMd, { color: Colors.textMuted, marginTop: 12, textAlign: 'center' }]}>
          {searchQuery || selectedCategory !== 'Tout' || favoritesOnly
            ? 'Aucune promo ne correspond à tes filtres.'
            : "Aucune promo pour l'instant.\nSois le premier à en partager une !"}
        </Text>
        {onSharePromo && !searchQuery && (
          <TouchableOpacity style={styles.emptyShareBtn} onPress={onSharePromo} activeOpacity={0.8}>
            <MaterialIcons name="camera-alt" size={16} color={Colors.white} />
            <Text style={styles.emptyShareBtnText}>Partager une promo</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [loading, searchQuery, selectedCategory, favoritesOnly, onSharePromo]);

  const ListFooterComponent = useCallback(() => {
    if (!loadingMore) return <View style={{ height: 16 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={Colors.primary} size="small" />
        <Text style={styles.footerLoaderText}>Chargement…</Text>
      </View>
    );
  }, [loadingMore]);

  return (
    <View style={styles.root}>
      {/* ── Realtime Toast ─────────────────────────────────────────────────── */}
      {toastItem && (
        <RealtimeToast
          item={toastItem}
          onPress={() => {}}
          onDismiss={() => setToastItem(null)}
        />
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="groups" size={24} color={Colors.primary} />
          <Text style={[Typography.h1, { color: Colors.textPrimary }]}>La Commu</Text>
        </View>
        <TouchableOpacity style={styles.notifButton} onPress={onOpenLeaderboard} activeOpacity={0.7}>
          <MaterialIcons name="emoji-events" size={22} color={Colors.warning} />
        </TouchableOpacity>
      </View>

      {/* ── Barre de recherche ─────────────────────────────────────────────── */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un produit ou un magasin…"
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {filtering && <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 4 }} />}
      </View>

      {/* ── Chips catégories ───────────────────────────────────────────────── */}
      <FlatList
        data={CATEGORIES as unknown as CategoryLabel[]}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesRow}
        renderItem={({ item: cat }) => {
          const isActive = selectedCategory === cat;
          return (
            <TouchableOpacity
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => handleCategorySelect(cat)}
              activeOpacity={0.75}
            >
              <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Toggle favoris ─────────────────────────────────────────────────── */}
      <View style={styles.favToggleRow}>
        <MaterialIcons name="star" size={16} color={favoritesOnly ? Colors.warning : Colors.textMuted} />
        <Text style={[styles.favToggleLabel, favoritesOnly && { color: Colors.textPrimary }]}>
          Mes magasins favoris uniquement
        </Text>
        <Switch
          value={favoritesOnly}
          onValueChange={handleFavoritesToggle}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor={Colors.white}
          ios_backgroundColor={Colors.border}
        />
      </View>

      {/* ── Flux paginé ─────────────────────────────────────────────────────── */}
      <FlatList
        data={promos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.3}
        windowSize={10}
        maxToRenderPerBatch={6}
        initialNumToRender={5}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS !== 'ios'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadPromos({ isRefresh: true })}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      />

      {/* ── FABs ───────────────────────────────────────────────────────────── */}
      {onSharePromo && (
        <TouchableOpacity style={[styles.fabPromo, Shadows.active]} onPress={onSharePromo} activeOpacity={0.85}>
          <MaterialIcons name="camera-alt" size={18} color={Colors.white} />
          <Text style={styles.fabText}>Partager une promo</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.fab, Shadows.active]} onPress={onInviteFriends} activeOpacity={0.85}>
        <MaterialIcons name="person-add" size={18} color={Colors.white} />
        <Text style={styles.fabText}>Parrainer</Text>
      </TouchableOpacity>

      <BottomNav active="community" onNavigate={onNavigate} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, minHeight: 56,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifButton: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Radii.button, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, paddingVertical: 0 },

  categoriesRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  categoryChipTextActive: { color: Colors.white },

  favToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.border,
  },
  favToggleLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textMuted },

  feedContent:   { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8 },
  skeletonList: { gap: 12, marginBottom: 12 },

  referralCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primaryLight, padding: 14, borderRadius: Radii.card, marginBottom: 12,
  },
  referralIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: Colors.border,
  },
  rankingCard: {
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  rankingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  trophyCircle: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  rankingLink: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },

  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  resultCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, marginTop: 16,
  },
  emptyShareBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  footerLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
  footerLoaderText: { fontSize: 13, color: Colors.textMuted },

  fabPromo: {
    position: 'absolute', bottom: 144, right: 16,
    backgroundColor: Colors.success, flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 18, height: 48, borderRadius: 24,
  },
  fab: {
    position: 'absolute', bottom: 84, right: 16,
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 18, height: 48, borderRadius: 24,
  },
  fabText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
