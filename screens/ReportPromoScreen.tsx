import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { radii } from '@/design';
import { LogoPM } from '@/components/primitives';
import { BarcodeScannerModal } from '@/components/features';
import { getStoresByDepartment } from '@/services/api';
import { publishPromoReport } from '@/services/promoService';
import { fetchProductByEan } from '@/services/productService';
import type { Store } from '@/types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const FALLBACK_STORES: Pick<Store, 'id' | 'name'>[] = [
  { id: 'fallback-leclerc-lr',   name: 'E.Leclerc La Rochelle Nord' },
  { id: 'fallback-su-puil',      name: 'Super U Puilboreau' },
  { id: 'fallback-inter-lr',     name: 'Intermarché La Rochelle' },
  { id: 'fallback-carrefour-lr', name: 'Carrefour Market La Rochelle' },
  { id: 'fallback-auchan-per',   name: 'Auchan Supermarché Périgny' },
  { id: 'fallback-lidl-lr',      name: 'Lidl La Rochelle' },
  { id: 'fallback-leclerc-sai',  name: 'E.Leclerc Saintes' },
  { id: 'fallback-su-sai',       name: 'Super U Saintes' },
  { id: 'fallback-leclerc-roch', name: 'E.Leclerc Rochefort' },
  { id: 'fallback-su-roch',      name: 'Super U Rochefort' },
  { id: 'fallback-leclerc-roy',  name: 'E.Leclerc Royan' },
  { id: 'fallback-su-roy',       name: 'Super U Royan' },
];

const CATEGORIES = [
  "Fruits & Légumes",
  "Viandes & Poissons",
  "Produits Laitiers",
  "Epicerie Salée",
  "Epicerie Sucrée",
  "Boissons",
  "Surgelés",
  "Hygiène & Beauté",
  "Entretien",
  "Bio & Santé",
  "Boulangerie",
  "Autre",
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReportPromoScreenProps {
  onBack:       () => void;
  onPublished?: () => void;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ReportPromoScreen({ onBack, onPublished }: ReportPromoScreenProps) {
  const insets = useSafeAreaInsets();

  // ── État des enseignes ─────────────────────────────────────────────────────
  const [stores, setStores]           = useState<Pick<Store, 'id' | 'name'>[]>(FALLBACK_STORES);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [selectedStore, setSelectedStore]     = useState<Pick<Store, 'id' | 'name'> | null>(null);

  // ── Catégorie ──────────────────────────────────────────────────────────────
  const [catPickerOpen, setCatPickerOpen]   = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  // ── Formulaire produit ─────────────────────────────────────────────────────
  const [productName, setProductName] = useState('');
  const [ean, setEan]                 = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [promoPrice, setPromoPrice]       = useState('');

  // ── Scanner & résolution produit ───────────────────────────────────────────
  const [scannerOpen, setScannerOpen]     = useState(false);
  const [manualEanMode, setManualEanMode] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [productImage, setProductImage]   = useState<string | null>(null);
  const [productBrand, setProductBrand]   = useState('');
  const [productNotFound, setProductNotFound] = useState(false);

  // ── Soumission ─────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);

  // ── Feedback visuel post-scan ──────────────────────────────────────────────
  const [productAutoFilled, setProductAutoFilled] = useState(false);
  const checkScale = useRef(new Animated.Value(0)).current;

  const animateCheck = useCallback(() => {
    checkScale.setValue(0);
    Animated.spring(checkScale, {
      toValue:         1,
      friction:        5,
      tension:         140,
      useNativeDriver: true,
    }).start();
  }, [checkScale]);

  // ── Chargement des enseignes ───────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    getStoresByDepartment('17')
      .then((data) => { if (alive && data.length > 0) setStores(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // ── Calculs dynamiques ─────────────────────────────────────────────────────
  const origNum  = parseFloat(originalPrice.replace(',', '.'));
  const promoNum = parseFloat(promoPrice.replace(',', '.'));
  const savingsValid =
    !Number.isNaN(origNum) && !Number.isNaN(promoNum) &&
    promoNum < origNum && origNum > 0 && promoNum >= 0;
  const discountPct  = savingsValid ? Math.round(((origNum - promoNum) / origNum) * 100) : 0;
  const savingsAmt   = savingsValid ? origNum - promoNum : 0;

  const discountTooHigh = savingsValid && discountPct > 85;
  const priceSuspect    = savingsValid && promoNum < 0.15;

  const canSubmit =
    productName.trim().length > 0 &&
    savingsValid &&
    selectedStore !== null &&
    selectedCategory !== '' &&
    !submitting &&
    !productLoading;

  // ── Handler scanner ────────────────────────────────────────────────────────
  const handleEanScanned = useCallback(async (scannedEan: string) => {
    setScannerOpen(false);
    setEan(scannedEan);
    setProductLoading(true);
    setProductNotFound(false);
    setProductImage(null);
    setProductBrand('');

    const product = await fetchProductByEan(scannedEan);

    if (product) {
      setProductName(product.name);
      setProductBrand(product.brand);
      setProductImage(product.imageUrl);
      if (product.suggestedCategory) {
        setSelectedCategory(product.suggestedCategory);
      }
      setProductAutoFilled(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      animateCheck();
    } else {
      setProductNotFound(true);
      setProductAutoFilled(false);
    }

    setProductLoading(false);
  }, []);

  // ── Réinitialisation du champ EAN ─────────────────────────────────────────
  const handleClearEan = useCallback(() => {
    setEan('');
    setProductName('');
    setProductBrand('');
    setProductImage(null);
    setProductNotFound(false);
    setManualEanMode(false);
    setSelectedCategory('');
    setProductAutoFilled(false);
  }, []);

  // ── Publication ────────────────────────────────────────────────────────────
  const doPublish = async () => {
    if (!canSubmit || !selectedStore) return;
    setSubmitting(true);
    try {
      const result = await publishPromoReport({
        productName: productName.trim(),
        ean:         ean.trim(),
        storeName:   selectedStore.name,
        storeId:     selectedStore.id,
        originalPrice: origNum,
        promoPrice:    promoNum,
        category:    selectedCategory,
      });

      if (!result.ok) {
        if (result.reason === 'duplicate') {
          Alert.alert(
            "Promo déjà signalée",
            "Ce produit a déjà été signalé dans ce magasin dans les dernières 24h. Merci quand même !"
          );
        } else {
          Alert.alert("Erreur", result.message ?? "Impossible de publier. Vérifie ta connexion.");
        }
        return;
      }

      Alert.alert(
        "Promo signalée !",
        "Merci pour ta contribution — la communauté te remercie.",
        [{ text: "Super !", onPress: onPublished ?? onBack }]
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!canSubmit) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (discountTooHigh || priceSuspect) {
      Alert.alert(
        "Attention",
        priceSuspect
          ? `Ce prix de ${promoNum.toFixed(2).replace('.', ',')} € semble très bas. Confirmes-tu ?`
          : `Une réduction de ${discountPct}% semble très élevée. Confirmes-tu ?`,
        [
          { text: "Corriger", style: 'cancel' },
          { text: "Oui, publier", onPress: () => void doPublish() },
        ]
      );
      return;
    }

    await doPublish();
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Scanner plein-écran */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onEanScanned={(scannedEan) => void handleEanScanned(scannedEan)}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[s.root, { paddingTop: insets.top }]}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Signaler une promo</Text>
            <LogoPM size={32} />
          </View>

          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Badge communautaire ───────────────────────────────────── */}
            <View style={s.badge}>
              <MaterialIcons name="people" size={16} color="#FF6B00" />
              <Text style={s.badgeTxt}>Tu aides toute la communauté PanierMalin</Text>
            </View>

            {/* ── Enseigne ─────────────────────────────────────────────── */}
            <Text style={s.label}>Enseigne *</Text>
            <TouchableOpacity
              style={[s.picker, !selectedStore && s.pickerEmpty]}
              onPress={() => setStorePickerOpen(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="store" size={18} color={selectedStore ? '#0F172A' : '#94A3B8'} />
              <Text style={[s.pickerTxt, !selectedStore && s.pickerPlaceholder]}>
                {selectedStore ? selectedStore.name : "Sélectionner un magasin"}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color="#94A3B8" />
            </TouchableOpacity>

            {/* ── Code-barres EAN ──────────────────────────────────────── */}
            <Text style={s.label}>Code-barres EAN</Text>

            {ean ? (
              /* Chip EAN après scan ou saisie */
              <View style={s.eanChip}>
                <MaterialIcons name="qr-code" size={16} color="#FF6B00" />
                <Text style={s.eanChipTxt} numberOfLines={1}>{ean}</Text>
                <TouchableOpacity onPress={handleClearEan} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ) : (
              /* Actions : scanner OU saisir manuellement */
              <>
                <TouchableOpacity
                  style={s.scanBtn}
                  onPress={() => setScannerOpen(true)}
                  activeOpacity={0.87}
                >
                  <MaterialIcons name="qr-code-scanner" size={22} color="#FFFFFF" />
                  <Text style={s.scanBtnTxt}>Scanner le code-barres</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.manualLink}
                  onPress={() => setManualEanMode((v) => !v)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="keyboard" size={14} color="#94A3B8" />
                  <Text style={s.manualLinkTxt}>Saisir manuellement</Text>
                </TouchableOpacity>

                {manualEanMode && (
                  <View style={s.manualInputWrap}>
                    <TextInput
                      style={[s.input, { marginTop: 0 }]}
                      placeholder="Ex: 3017620422003"
                      placeholderTextColor="#94A3B8"
                      value={ean}
                      onChangeText={(v) => {
                        setEan(v);
                        setProductNotFound(false);
                      }}
                      keyboardType="numeric"
                      maxLength={14}
                      returnKeyType="next"
                      autoFocus
                    />
                  </View>
                )}
              </>
            )}

            {/* Message produit inconnu */}
            {productNotFound && (
              <View style={s.notFoundBanner}>
                <MaterialIcons name="help-outline" size={14} color="#6B7280" />
                <Text style={s.notFoundTxt}>
                  Produit inconnu — saisissez le nom manuellement pour l'enregistrer
                </Text>
              </View>
            )}

            <Text style={s.hint}>Optionnel — facilite la recherche croisée</Text>

            {/* ── Nom du produit ───────────────────────────────────────── */}
            <View style={s.labelRow}>
              <Text style={s.label}>Nom du produit *</Text>
              {productAutoFilled && productName.length > 0 && (
                <Animated.View style={[s.autoCheck, { transform: [{ scale: checkScale }] }]}>
                  <MaterialIcons name="check-circle" size={16} color="#10B981" />
                  <Text style={s.autoCheckTxt}>Auto-rempli</Text>
                </Animated.View>
              )}
            </View>

            {/* Vignette produit (apparaît si OFF a retourné une image) */}
            {productImage && !productLoading && (
              <View style={s.productPreview}>
                <Image
                  source={{ uri: productImage }}
                  style={s.productThumb}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={150}
                  onError={() => setProductImage(null)}
                />
                {productBrand.length > 0 && (
                  <View style={s.productPreviewInfo}>
                    <Text style={s.productBrandLbl}>Marque</Text>
                    <Text style={s.productBrandVal} numberOfLines={1}>{productBrand}</Text>
                  </View>
                )}
              </View>
            )}

            {productLoading ? (
              /* État de chargement : spinner pendant la résolution OFF */
              <View style={s.loadingField}>
                <ActivityIndicator size="small" color="#FF6B00" />
                <Text style={s.loadingFieldTxt}>Identification du produit…</Text>
              </View>
            ) : (
              <TextInput
                style={s.input}
                placeholder="Ex: Nutella 750g"
                placeholderTextColor="#94A3B8"
                value={productName}
                onChangeText={setProductName}
                returnKeyType="next"
                maxLength={80}
              />
            )}

            {/* ── Catégorie ────────────────────────────────────────────── */}
            <View style={s.labelRow}>
              <Text style={s.label}>Rayon / Categorie *</Text>
              {productAutoFilled && selectedCategory.length > 0 && (
                <Animated.View style={[s.autoCheck, { transform: [{ scale: checkScale }] }]}>
                  <MaterialIcons name="check-circle" size={16} color="#10B981" />
                  <Text style={s.autoCheckTxt}>Detecte</Text>
                </Animated.View>
              )}
            </View>
            <TouchableOpacity
              style={[s.picker, !selectedCategory && s.pickerEmpty]}
              onPress={() => !productLoading && setCatPickerOpen(true)}
              activeOpacity={productLoading ? 1 : 0.8}
              disabled={productLoading}
            >
              {productLoading ? (
                <ActivityIndicator size="small" color="#FF6B00" />
              ) : (
                <MaterialIcons name="category" size={18} color={selectedCategory ? '#0F172A' : '#94A3B8'} />
              )}
              <Text style={[s.pickerTxt, !selectedCategory && s.pickerPlaceholder]}>
                {productLoading
                  ? "Détection automatique…"
                  : (selectedCategory || "Sélectionner un rayon")
                }
              </Text>
              {!productLoading && (
                <MaterialIcons name="keyboard-arrow-down" size={20} color="#94A3B8" />
              )}
            </TouchableOpacity>

            {/* ── Prix ─────────────────────────────────────────────────── */}
            <View style={s.priceRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Prix d'origine *</Text>
                <View style={s.priceInputWrap}>
                  <TextInput
                    style={s.priceInput}
                    placeholder="0,00"
                    placeholderTextColor="#94A3B8"
                    value={originalPrice}
                    onChangeText={setOriginalPrice}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                  <Text style={s.currency}>€</Text>
                </View>
              </View>
              <View style={s.arrowWrap}>
                <MaterialIcons name="arrow-forward" size={20} color="#94A3B8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Prix promo *</Text>
                <View style={s.priceInputWrap}>
                  <TextInput
                    style={s.priceInput}
                    placeholder="0,00"
                    placeholderTextColor="#94A3B8"
                    value={promoPrice}
                    onChangeText={setPromoPrice}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                  <Text style={s.currency}>€</Text>
                </View>
              </View>
            </View>

            {/* ── Calcul dynamique ─────────────────────────────────────── */}
            {savingsValid && (
              <View style={[s.discountBadge, discountTooHigh || priceSuspect ? s.discountWarn : s.discountOk]}>
                <MaterialIcons
                  name={discountTooHigh || priceSuspect ? "warning" : "local-offer"}
                  size={16}
                  color={discountTooHigh || priceSuspect ? "#B45309" : "#059669"}
                />
                <Text style={[s.discountTxt, discountTooHigh || priceSuspect ? s.discountTxtWarn : s.discountTxtOk]}>
                  {`-${discountPct}%  ·  Économie de ${savingsAmt.toFixed(2).replace('.', ',')} €`}
                </Text>
              </View>
            )}

            {/* ── Bouton de soumission ─────────────────────────────────── */}
            <TouchableOpacity
              style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
              onPress={() => void handlePublish()}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialIcons name="campaign" size={20} color="#FFFFFF" />
                  <Text style={s.submitTxt}>Publier la promo</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* ── Modal sélecteur d'enseigne ───────────────────────────── */}
          <Modal
            visible={storePickerOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setStorePickerOpen(false)}
          >
            <View style={s.modalOverlay}>
              <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Choisir un magasin</Text>
                  <TouchableOpacity onPress={() => setStorePickerOpen(false)}>
                    <MaterialIcons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {stores.map((store) => (
                    <TouchableOpacity
                      key={store.id}
                      style={[s.modalItem, selectedStore?.id === store.id && s.modalItemSelected]}
                      onPress={() => { setSelectedStore(store); setStorePickerOpen(false); }}
                    >
                      <Text style={[s.modalItemTxt, selectedStore?.id === store.id && s.modalItemTxtSelected]}>
                        {store.name}
                      </Text>
                      {selectedStore?.id === store.id && (
                        <MaterialIcons name="check" size={18} color="#FF6B00" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* ── Modal sélecteur de catégorie ─────────────────────────── */}
          <Modal
            visible={catPickerOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setCatPickerOpen(false)}
          >
            <View style={s.modalOverlay}>
              <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Choisir un rayon</Text>
                  <TouchableOpacity onPress={() => setCatPickerOpen(false)}>
                    <MaterialIcons name="close" size={22} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[s.modalItem, selectedCategory === cat && s.modalItemSelected]}
                      onPress={() => { setSelectedCategory(cat); setCatPickerOpen(false); }}
                    >
                      <Text style={[s.modalItemTxt, selectedCategory === cat && s.modalItemTxtSelected]}>
                        {cat}
                      </Text>
                      {selectedCategory === cat && (
                        <MaterialIcons name="check" size={18} color="#FF6B00" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn:     { padding: 2 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },

  scroll: { padding: 20, gap: 4 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderRadius: radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  badgeTxt: { fontSize: 13, fontWeight: '600', color: '#C2410C', flex: 1 },

  label: {
    fontSize: 13, fontWeight: '700', color: '#374151',
    marginBottom: 6, marginTop: 14,
  },
  labelRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6, marginTop: 14,
  },
  autoCheck: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  autoCheckTxt: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  hint:  { fontSize: 11, color: '#94A3B8', marginTop: 4 },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#0F172A',
  },

  // ── Scanner ──────────────────────────────────────────────────────────────
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    borderRadius: radii.md,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  scanBtnTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 10,
    paddingBottom: 2,
  },
  manualLinkTxt: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  manualInputWrap: { marginTop: 8 },

  // ── EAN chip (après scan) ─────────────────────────────────────────────────
  eanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  eanChipTxt: {
    flex: 1,
    fontSize: 15, fontWeight: '700', color: '#C2410C',
    fontVariant: ['tabular-nums'],
  },

  // ── Produit inconnu ───────────────────────────────────────────────────────
  notFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
  },
  notFoundTxt: { fontSize: 12, color: '#6B7280', flex: 1, lineHeight: 17 },

  // ── Vignette produit OFF ──────────────────────────────────────────────────
  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 6,
  },
  productThumb: {
    width: 52, height: 52,
    borderRadius: radii.sm,
    backgroundColor: '#F8FAFC',
  },
  productPreviewInfo: { flex: 1, gap: 2 },
  productBrandLbl:    { fontSize: 10, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  productBrandVal:    { fontSize: 14, color: '#0F172A', fontWeight: '700' },

  // ── Champ en cours de chargement ──────────────────────────────────────────
  loadingField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  loadingFieldTxt: { fontSize: 14, color: '#94A3B8', fontStyle: 'italic' },

  // ── Picker ────────────────────────────────────────────────────────────────
  picker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  pickerEmpty: { borderColor: '#E2E8F0' },
  pickerTxt:   { flex: 1, fontSize: 15, color: '#0F172A', fontWeight: '500' },
  pickerPlaceholder: { color: '#94A3B8', fontWeight: '400' },

  // ── Prix ──────────────────────────────────────────────────────────────────
  priceRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4,
  },
  arrowWrap:     { paddingBottom: 12 },
  priceInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: radii.md,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  priceInput: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0F172A', padding: 0 },
  currency:   { fontSize: 15, fontWeight: '600', color: '#64748B', marginLeft: 4 },

  // ── Calcul dynamique ──────────────────────────────────────────────────────
  discountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: radii.lg,
    paddingVertical: 10, paddingHorizontal: 14,
    marginTop: 12, marginBottom: 4,
  },
  discountOk:      { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  discountWarn:    { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  discountTxt:     { fontSize: 14, fontWeight: '700' },
  discountTxtOk:   { color: '#065F46' },
  discountTxtWarn: { color: '#92400E' },

  // ── Soumission ────────────────────────────────────────────────────────────
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FF6B00',
    borderRadius: radii.xl,
    paddingVertical: 16, marginTop: 24,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  submitTxt: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  // ── Modaux ────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%', padding: 20,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  modalItemSelected:    { backgroundColor: '#FFF7ED' },
  modalItemTxt:         { fontSize: 15, color: '#374151', fontWeight: '500' },
  modalItemTxtSelected: { color: '#FF6B00', fontWeight: '700' },
});
