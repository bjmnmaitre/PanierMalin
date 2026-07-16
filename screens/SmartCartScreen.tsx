// screens/SmartCartScreen.tsx
// Panier Malin — optimisateur multi-enseignes + Mode Course

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Platform, Modal, ActionSheetIOS,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radii, shadows } from '@/design';
import { useCart } from '@/contexts/CartContext';
import { useCoinRain } from '@/contexts/CoinRainContext';
import { recordShoppingSession } from '@/services/savingsService';
import { getSupabaseNearbyStores } from '@/services/api';
import { optimizeCartDetailed, calculateSplitShopping } from '@/services/cartService';
import type { StoreScore, DetailedOptimResult, StoreCandidate, SplitResult } from '@/services/cartService';
import { getSmartSubstitution } from '@/services/inventoryService';
import type { SubstitutionSuggestion } from '@/services/inventoryService';
import { estimateBasePrice } from '@/services/inventoryService';
import type { Store } from '@/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SmartCartScreenProps {
  onBack: () => void;
}

// ─── Navigation GPS ───────────────────────────────────────────────────────────

function openNavigationApp(storeName: string, lat: number, lng: number) {
  const wazeUrl  = `waze://?ll=${lat},${lng}&navigate=yes`;
  const wazeFb   = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const gMapsUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
  const gMapsFb  = `https://maps.google.com/?daddr=${lat},${lng}`;
  const appleMaps = `maps://?daddr=${lat},${lng}`;

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Waze', 'Google Maps', 'Plans (Apple)', 'Annuler'], cancelButtonIndex: 3, title: `Itinéraire vers ${storeName}` },
      (idx) => {
        if (idx === 0) void Linking.openURL(wazeUrl).catch(() => Linking.openURL(wazeFb));
        if (idx === 1) void Linking.openURL(gMapsUrl).catch(() => Linking.openURL(gMapsFb));
        if (idx === 2) void Linking.openURL(appleMaps);
      },
    );
  } else {
    Alert.alert(`Itinéraire vers ${storeName}`, 'Application de navigation', [
      { text: 'Waze',        onPress: () => void Linking.openURL(wazeUrl).catch(() => Linking.openURL(wazeFb)) },
      { text: 'Google Maps', onPress: () => void Linking.openURL(gMapsUrl).catch(() => Linking.openURL(gMapsFb)) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }
}

// ─── Ligne de score magasin ────────────────────────────────────────────────────

function StoreScoreRow({
  score, rank,
}: {
  score: StoreScore;
  rank:  number;
}) {
  const isBest = rank === 0;
  return (
    <View style={[st.storeRow, isBest && st.storeRowBest]}>
      <View style={st.storeLeft}>
        <Text style={[st.storeRank, isBest && st.storeRankBest]}>#{rank + 1}</Text>
        <View style={st.storeInfo}>
          <Text style={st.storeName} numberOfLines={1}>{score.store.name}</Text>
          <Text style={st.storeFoundTxt}>
            {score.itemsFound}/{score.totalItems} articles trouvés
          </Text>
        </View>
      </View>
      <View style={st.storeRight}>
        <Text style={[st.storePrice, isBest && st.storePriceBest]}>
          {score.totalPrice.toFixed(2)} €
        </Text>
        {score.savings > 0.01 && (
          <Text style={st.storeSavings}>-{score.savings.toFixed(2)} €</Text>
        )}
        {isBest && score.store.latitude != null && (
          <TouchableOpacity
            style={st.goBtn}
            onPress={() => openNavigationApp(
              score.store.name,
              score.store.latitude!,
              score.store.longitude!,
            )}
          >
            <MaterialIcons name="navigation" size={14} color={colors.white} />
            <Text style={st.goBtnTxt}>Y aller</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Composant principal ───────────────────────────────────────────────────────

export default function SmartCartScreen({ onBack }: SmartCartScreenProps) {
  const insets             = useSafeAreaInsets();
  const cart               = useCart();
  const { triggerCoinRain } = useCoinRain();

  const [newItemText, setNewItemText]   = useState('');
  const [loadingOptim, setLoadingOptim] = useState(false);
  const [result, setResult]             = useState<DetailedOptimResult | null>(null);
  const [optimError, setOptimError]     = useState<string | null>(null);

  // Mode Course
  const [courseVisible, setCourseVisible] = useState(false);
  const [checkedItems, setCheckedItems]   = useState<Set<string>>(new Set());

  const runOptim = useCallback(async () => {
    if (cart.items.length === 0) { setResult(null); setOptimError(null); return; }
    setLoadingOptim(true);
    setOptimError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setOptimError('La localisation est nécessaire pour trouver les magasins proches.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const stores = (await getSupabaseNearbyStores(
        loc.coords.latitude, loc.coords.longitude, 15
      )) as Store[];
      if (stores.length === 0) {
        setOptimError('Aucun magasin trouvé à proximité.');
        return;
      }
      const candidates = stores.map((s) => ({
        id: s.id, name: s.name, brand: s.brand,
        latitude: s.latitude, longitude: s.longitude,
      }));
      const res = await optimizeCartDetailed(cart.items, candidates);
      setResult(res);
      if (!res) setOptimError('Aucun prix trouvé pour les articles du panier.');
    } catch {
      setOptimError('Erreur lors de l\'optimisation du panier.');
    } finally {
      setLoadingOptim(false);
    }
  }, [cart.items]);

  useEffect(() => { void runOptim(); }, [runOptim]);

  const addItem = useCallback(() => {
    const name = newItemText.trim();
    if (!name) return;
    cart.addItem(name);
    setNewItemText('');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [newItemText, cart]);

  const toggleCheck = useCallback((id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === cart.items.length && cart.items.length > 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        triggerCoinRain(10);
        // Enregistrement de la session d'économies
        const storeName = result?.bestStore?.name ?? 'Magasin';
        const spent     = result?.scores?.[0]?.totalPrice ?? 0;
        const maxPrice  = result?.maxPrice ?? spent;
        void recordShoppingSession({
          storeName,
          amountSpent:  spent,
          amountSaved:  Math.max(0, maxPrice - spent),
          itemCount:    cart.items.length,
        });
      }
      return next;
    });
  }, [cart.items.length, triggerCoinRain, result]);

  const allChecked = useMemo(
    () => cart.items.length > 0 && checkedItems.size === cart.items.length,
    [cart.items.length, checkedItems.size],
  );

  // ── Split-Shopping & substitutions ──────────────────────────────────────────
  const [splitResult, setSplitResult]         = useState<SplitResult | null>(null);
  const [splitMode, setSplitMode]             = useState(false);
  const [courseStep, setCourseStep]           = useState<0 | 1>(0);
  const [substitutions, setSubstitutions]     = useState<Map<string, SubstitutionSuggestion>>(new Map());
  const [expandedSubIds, setExpandedSubIds]   = useState<Set<string>>(new Set());
  const step2AlertRef                         = useRef(false);

  const launchGPS = useCallback((store: StoreCandidate) => {
    if (store.latitude == null || store.longitude == null) return;
    openNavigationApp(store.name, store.latitude, store.longitude);
  }, []);

  useEffect(() => {
    if (!result || result.scores.length < 2) { setSplitResult(null); return; }
    const topStores = result.scores.slice(0, 5).map((s) => s.store);
    void calculateSplitShopping(cart.items, topStores, result.scores[0].totalPrice).then(setSplitResult);
  }, [result, cart.items]);

  useEffect(() => {
    if (!result?.bestStore) { setSubstitutions(new Map()); return; }
    const storeId = result.bestStore.id;
    void (async () => {
      const entries = await Promise.all(
        cart.items.map(async (item) => {
          const base = estimateBasePrice(item.productName);
          const sub  = await getSmartSubstitution(item.productName, storeId, base);
          return sub ? ([item.id, sub] as [string, SubstitutionSuggestion]) : null;
        }),
      );
      const map = new Map<string, SubstitutionSuggestion>();
      for (const e of entries) if (e) map.set(e[0], e[1]);
      setSubstitutions(map);
    })();
  }, [result?.bestStore?.id, cart.items]);

  // Transition to step 2 when all step-1 items are checked
  useEffect(() => {
    if (!splitMode || !splitResult || courseStep !== 0) { step2AlertRef.current = false; return; }
    const step0ids = new Set(splitResult.itemsA.map((i) => i.id));
    if (step0ids.size === 0) return;
    const allDone = [...step0ids].every((aid) => checkedItems.has(aid));
    if (allDone && !step2AlertRef.current) {
      step2AlertRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        `Étape 1 terminée chez ${splitResult.storeA.name} !`,
        `Rendez-vous chez ${splitResult.storeB.name} pour ${splitResult.itemsB.length} article(s).`,
        [
          { text: 'Étape 2 →', onPress: () => setCourseStep(1) },
          { text: 'Rester ici', style: 'cancel' },
        ],
      );
    }
    if (!allDone) step2AlertRef.current = false;
  }, [checkedItems, splitMode, splitResult, courseStep]);

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={st.header}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={st.title}>Panier Malin</Text>
        {cart.items.length > 0 && (
          <TouchableOpacity
            style={st.courseBtn}
            onPress={() => { setCheckedItems(new Set()); setCourseVisible(true); }}
          >
            <MaterialIcons name="checklist" size={20} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Articles ─────────────────────────────────────────────────── */}
        <Text style={st.sectionTitle}>Articles ({cart.totalItems})</Text>

        {cart.items.length === 0 ? (
          <View style={st.emptyBox}>
            <MaterialIcons name="shopping-cart" size={40} color={colors.text.tertiary} />
            <Text style={st.emptyTxt}>Ton panier est vide</Text>
          </View>
        ) : (
          cart.items.map((item) => {
            const sub      = substitutions.get(item.id);
            const expanded = expandedSubIds.has(item.id);
            return (
              <React.Fragment key={item.id}>
                <View style={st.itemRow}>
                  <Text style={st.itemName} numberOfLines={1}>{item.productName}</Text>
                  <View style={st.qtyRow}>
                    <TouchableOpacity
                      style={st.qtyBtn}
                      hitSlop={6}
                      onPress={() => {
                        if (item.quantity <= 1) cart.removeItem(item.id);
                        else cart.updateQuantity(item.id, item.quantity - 1);
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <MaterialIcons name="remove" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={st.qtyTxt}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={st.qtyBtn}
                      hitSlop={6}
                      onPress={() => {
                        cart.updateQuantity(item.id, item.quantity + 1);
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                    >
                      <MaterialIcons name="add" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={st.deleteBtn}
                      hitSlop={6}
                      onPress={() => {
                        cart.removeItem(item.id);
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                    >
                      <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                {sub && (
                  <TouchableOpacity
                    style={st.subBanner}
                    activeOpacity={0.8}
                    onPress={() => setExpandedSubIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                      return next;
                    })}
                  >
                    <View style={st.subBannerHeader}>
                      <MaterialIcons name="swap-vert" size={14} color="#F59E0B" />
                      <Text style={st.subBannerTitle} numberOfLines={1}>
                        Économisez {sub.savingsPct}% · {sub.altName}
                      </Text>
                      <MaterialIcons
                        name={expanded ? 'expand-less' : 'expand-more'}
                        size={16}
                        color={colors.text.tertiary}
                      />
                    </View>
                    {expanded && (
                      <View style={st.subBannerDetail}>
                        <Text style={st.subBannerDetailTxt}>
                          {sub.altName} — {sub.altPrice.toFixed(2)} € (vs {sub.originalPrice.toFixed(2)} €)
                        </Text>
                        <TouchableOpacity
                          style={st.subReplaceBtn}
                          onPress={() => {
                            cart.removeItem(item.id);
                            cart.addItem(sub.altName);
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                        >
                          <Text style={st.subReplaceBtnTxt}>Remplacer</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </React.Fragment>
            );
          })
        )}

        {/* Ajouter un article */}
        <View style={st.addRow}>
          <TextInput
            style={st.addInput}
            value={newItemText}
            onChangeText={setNewItemText}
            placeholder="Ajouter un article…"
            placeholderTextColor={colors.text.tertiary}
            returnKeyType="done"
            onSubmitEditing={addItem}
          />
          <TouchableOpacity style={st.addBtn} onPress={addItem} activeOpacity={0.8}>
            <MaterialIcons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* ── Comparatif magasins ───────────────────────────────────────── */}
        <Text style={[st.sectionTitle, { marginTop: spacing[5] }]}>
          Comparatif magasins
        </Text>

        {loadingOptim ? (
          <View style={st.emptyBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={st.emptyTxt}>Recherche des meilleurs prix…</Text>
          </View>
        ) : optimError ? (
          <View style={st.emptyBox}>
            <MaterialIcons name="info-outline" size={32} color={colors.text.tertiary} />
            <Text style={st.emptyTxt}>{optimError}</Text>
            <TouchableOpacity style={st.retryBtn} onPress={() => void runOptim()}>
              <Text style={st.retryTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : result ? (
          <>
            {result.scores.map((score, idx) => (
              <StoreScoreRow key={score.store.id} score={score} rank={idx} />
            ))}
            {splitResult && (
              <View style={st.splitBanner}>
                <View style={st.splitBannerHeader}>
                  <Text style={st.splitBannerIcon}>💡</Text>
                  <Text style={st.splitBannerTitle}>Option Double-Économie</Text>
                  <Text style={st.splitBannerSavings}>-{splitResult.netSavings.toFixed(2)} €</Text>
                </View>
                <Text style={st.splitBannerDesc}>
                  {splitResult.itemsA.length} art. chez {splitResult.storeA.name} + {splitResult.itemsB.length} art. chez {splitResult.storeB.name}
                </Text>
                <TouchableOpacity
                  style={st.splitBannerBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSplitMode(true);
                    setCourseStep(0);
                    step2AlertRef.current = false;
                    setCheckedItems(new Set());
                    setCourseVisible(true);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                >
                  <MaterialIcons name="route" size={16} color={colors.white} />
                  <Text style={st.splitBannerBtnTxt}>Démarrer l'itinéraire double</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : cart.items.length === 0 ? (
          <View style={st.emptyBox}>
            <Text style={st.emptyTxt}>Ajoute des articles pour voir le comparatif.</Text>
          </View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Modal Mode Course ─────────────────────────────────────────────── */}
      <Modal
        visible={courseVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setCourseVisible(false); setSplitMode(false); }}
      >
        <View style={[st.modalRoot, { paddingTop: insets.top }]}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>{splitMode ? 'Double-Course' : 'Mode Course'}</Text>
            <TouchableOpacity
              onPress={() => { setCourseVisible(false); setSplitMode(false); }}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={22} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Step tabs — split mode only */}
          {splitMode && splitResult && (
            <View style={st.stepTabs}>
              <TouchableOpacity
                style={[st.stepTab, courseStep === 0 && st.stepTabActive]}
                onPress={() => setCourseStep(0)}
              >
                <Text style={[st.stepTabTxt, courseStep === 0 && st.stepTabTxtActive]}>
                  Étape 1 · {splitResult.storeA.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.stepTab, courseStep === 1 && st.stepTabActive]}
                onPress={() => setCourseStep(1)}
              >
                <Text style={[st.stepTabTxt, courseStep === 1 && st.stepTabTxtActive]}>
                  Étape 2 · {splitResult.storeB.name}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* GPS button — split mode */}
          {splitMode && splitResult && (() => {
            const cur = courseStep === 0 ? splitResult.storeA : splitResult.storeB;
            return cur.latitude != null ? (
              <TouchableOpacity style={st.stepGpsBtn} onPress={() => launchGPS(cur)}>
                <MaterialIcons name="navigation" size={16} color={colors.white} />
                <Text style={st.stepGpsBtnTxt}>Itinéraire vers {cur.name}</Text>
              </TouchableOpacity>
            ) : null;
          })()}

          <Text style={st.modalSubtitle}>
            {checkedItems.size}/{cart.items.length} articles cochés
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {(splitMode && splitResult
              ? (courseStep === 0 ? splitResult.itemsA : splitResult.itemsB)
              : cart.items
            ).map((item) => {
              const checked = checkedItems.has(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[st.checkRow, checked && st.checkRowDone]}
                  onPress={() => toggleCheck(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[st.checkbox, checked && st.checkboxChecked]}>
                    {checked && <MaterialIcons name="check" size={18} color={colors.white} />}
                  </View>
                  <Text style={[st.checkName, checked && st.checkNameDone]}>
                    {item.productName}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {allChecked && (
              <View style={st.allDoneBox}>
                <MaterialIcons name="celebration" size={36} color="#1D9E75" />
                <Text style={st.allDoneTxt}>Tous les articles sont cochés !</Text>
                <Text style={st.allDoneSub}>Bon retour à la maison 🏠</Text>
              </View>
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing[2],
  },
  backBtn: { padding: spacing[2] },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    flex: 1,
  },
  courseBtn: {
    backgroundColor: colors.primary,
    padding: spacing[2],
    borderRadius: radii.md,
  },
  scroll:   { flex: 1 },
  content:  { paddingHorizontal: spacing[4], paddingTop: spacing[4] },
  sectionTitle: {
    ...typography.labelLarge,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },

  // Empty / error states
  emptyBox: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[6],
  },
  emptyTxt: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  retryTxt: {
    ...typography.labelMedium,
    color: colors.white,
  },

  // Cart item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  itemName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyTxt: {
    ...typography.labelMedium,
    color: colors.text.primary,
    minWidth: 20,
    textAlign: 'center',
  },
  deleteBtn: { padding: 4, marginLeft: spacing[1] },

  // Add row
  addRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  addInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    ...typography.bodyMedium,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  addBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Store score rows
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing[3],
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  storeRowBest: {
    borderWidth: 1.5,
    borderColor: '#1D9E75',
    backgroundColor: '#F0FDF4',
  },
  storeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  storeRank: {
    ...typography.h3,
    color: colors.text.tertiary,
    width: 32,
    textAlign: 'center',
  },
  storeRankBest: { color: '#1D9E75' },
  storeInfo:     { flex: 1 },
  storeName: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },
  storeFoundTxt: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  storeRight: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  storePrice: {
    ...typography.h3,
    color: colors.text.primary,
  },
  storePriceBest: { color: '#1D9E75' },
  storeSavings: {
    ...typography.bodySmall,
    color: '#10B981',
    fontWeight: '600',
  },
  goBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1D9E75',
    paddingHorizontal: spacing[3],
    paddingVertical: 5,
    borderRadius: radii.md,
    marginTop: 2,
  },
  goBtnTxt: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '700',
  },

  // Mode Course modal
  modalRoot: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  checkRowDone: { opacity: 0.5 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1D9E75',
    borderColor: '#1D9E75',
  },
  checkName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  checkNameDone: {
    textDecorationLine: 'line-through',
    color: colors.text.tertiary,
  },
  allDoneBox: {
    alignItems: 'center',
    paddingVertical: spacing[8],
    gap: spacing[2],
  },
  allDoneTxt: {
    ...typography.h3,
    color: '#1D9E75',
    textAlign: 'center',
  },
  allDoneSub: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // Split-Shopping banner
  splitBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: radii.lg,
    padding: spacing[4],
    marginTop: spacing[4],
    borderWidth: 1,
    borderColor: '#FCD34D',
    ...shadows.sm,
  },
  splitBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  splitBannerIcon: {
    fontSize: 18,
  },
  splitBannerTitle: {
    ...typography.labelMedium,
    color: '#92400E',
    flex: 1,
  },
  splitBannerSavings: {
    ...typography.labelMedium,
    color: '#D97706',
    fontWeight: '700',
  },
  splitBannerDesc: {
    ...typography.bodySmall,
    color: '#B45309',
    marginBottom: spacing[3],
  },
  splitBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: '#F59E0B',
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
  },
  splitBannerBtnTxt: {
    ...typography.labelMedium,
    color: colors.white,
  },

  // Substitution suggestion banner
  subBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginTop: -spacing[1],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  subBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  subBannerTitle: {
    ...typography.bodySmall,
    color: '#166534',
    flex: 1,
  },
  subBannerDetail: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  subBannerDetailTxt: {
    ...typography.bodySmall,
    color: '#166534',
  },
  subReplaceBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#10B981',
    paddingVertical: 4,
    paddingHorizontal: spacing[3],
    borderRadius: radii.sm,
  },
  subReplaceBtnTxt: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },

  // Mode Course — step tabs & GPS
  stepTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  stepTab: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  stepTabActive: {
    borderBottomColor: colors.primary,
  },
  stepTabTxt: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  stepTabTxtActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepGpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    margin: spacing[4],
    marginBottom: spacing[2],
    backgroundColor: '#3B82F6',
    paddingVertical: spacing[3],
    borderRadius: radii.md,
  },
  stepGpsBtnTxt: {
    ...typography.labelMedium,
    color: colors.white,
  },
});
