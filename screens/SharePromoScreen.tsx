import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radii, typography } from '@/design';
import { Button } from '@/components/primitives';
import { Header } from '@/components/features';
import { createPromotion, getStoresByDepartment, uploadPromoImage } from '@/services/api';
import type { Store } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SharePromoScreenProps {
  onBack: () => void;
  onPublished?: () => void;
}

// ─── Fallback stores (si Supabase vide ou réseau absent) ─────────────────────

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

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SharePromoScreen({ onBack, onPublished }: SharePromoScreenProps) {
  const insets = useSafeAreaInsets();

  // ── stores
  const [stores, setStores] = useState<Pick<Store, 'id' | 'name'>[]>(FALLBACK_STORES);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storePickerOpen, setStorePickerOpen] = useState(false);

  // ── formulaire
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [ean, setEan] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [promoPrice, setPromoPrice] = useState('');
  const [selectedStore, setSelectedStore] = useState<Pick<Store, 'id' | 'name'> | null>(null);

  // ── soumission
  const [submitting, setSubmitting] = useState(false);

  // ── chargement des magasins depuis Supabase (dépt. 17 – Charente-Maritime)
  useEffect(() => {
    let alive = true;
    getStoresByDepartment('17')
      .then((data) => {
        if (!alive) return;
        if (data.length > 0) setStores(data);
      })
      .catch(() => { /* utilise le fallback */ })
      .finally(() => { if (alive) setStoresLoading(false); });
    return () => { alive = false; };
  }, []);

  // ── calculs dynamiques
  const origNum  = parseFloat(originalPrice.replace(',', '.'));
  const promoNum = parseFloat(promoPrice.replace(',', '.'));
  const savingsValid =
    !Number.isNaN(origNum) && !Number.isNaN(promoNum) &&
    promoNum < origNum && origNum > 0;
  const percent  = savingsValid ? Math.round(((origNum - promoNum) / origNum) * 100) : 0;
  const canSubmit =
    productName.trim().length > 0 && savingsValid && selectedStore !== null && !submitting;

  // ── prise de photo (caméra)
  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorise PanierMalin à accéder à ta caméra dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.75,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // ── sélection depuis la galerie
  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorise PanierMalin à accéder à ta galerie dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.75,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // ── choix source photo
  const handlePhotoSource = () => {
    Alert.alert('Ajouter une photo', 'Comment veux-tu ajouter la photo ?', [
      { text: 'Prendre une photo', onPress: handleCamera },
      { text: 'Depuis la galerie', onPress: handleGallery },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  // ── Anti-abus : détection de prix suspects
  const discountTooHigh = savingsValid && percent > 85;
  const priceSuspect    = savingsValid && promoNum < 0.15;

  // ── Noyau de soumission (appelé après confirmation si nécessaire)
  const doPublish = async () => {
    if (!canSubmit || !selectedStore) return;
    try {
      setSubmitting(true);

      let publicImageUrl: string | undefined;
      if (photoUri) {
        try { publicImageUrl = await uploadPromoImage(photoUri); }
        catch (uploadErr) { console.warn('[SharePromo] upload image failed', uploadErr); }
      }

      await createPromotion({
        productName: productName.trim(),
        ean: ean.trim() || undefined,
        storeName: selectedStore.name,
        storeId: selectedStore.id.startsWith('fallback-') ? undefined : selectedStore.id,
        originalPrice: origNum,
        promoPrice: promoNum,
        proofImageUri: publicImageUrl,
      });
      Alert.alert(
        'Promo publiée !',
        'Merci pour ta contribution — la communauté te remercie.',
        [{ text: 'Super !', onPress: onPublished ?? onBack }]
      );
    } catch (err) {
      console.error('[SharePromo] createPromotion failed', err);
      Alert.alert('Erreur', "Impossible de publier. Vérifie ta connexion et réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── soumission (avec garde anti-abus)
  const handlePublish = async () => {
    if (!canSubmit || !selectedStore) return;

    if (discountTooHigh || priceSuspect) {
      Alert.alert(
        '⚠️ Attention Sentinelle !',
        priceSuspect
          ? `Ce prix de ${promoNum.toFixed(2).replace('.', ',')} € semble exceptionnellement bas. S'agit-il d'une erreur de saisie ou d'un vrai prix en rayon ?`
          : `Une réduction de ${percent}% semble très élevée. S'agit-il d'une erreur de saisie ou d'une vraie promo exceptionnelle ?`,
        [
          { text: '✏️ Corriger mon prix', style: 'cancel' },
          { text: '✅ C\'est bien le vrai prix', onPress: () => void doPublish() },
        ]
      );
      return;
    }

    await doPublish();
  };

  // ── rendu ──────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.root}>
        <Header title="Partager une promo" onBackPress={onBack} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Zone photo ── */}
          <Text style={styles.sectionLabel}>Photo de l'étiquette</Text>

          <TouchableOpacity
            style={styles.photoArea}
            onPress={handlePhotoSource}
            activeOpacity={0.8}
          >
            {photoUri ? (
              <>
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.photoRetakeOverlay}>
                  <MaterialIcons name="photo-camera" size={22} color={colors.white} />
                  <Text style={styles.photoRetakeText}>Modifier</Text>
                </View>
              </>
            ) : (
              <View style={styles.photoEmptyContent}>
                <View style={styles.photoIconRow}>
                  <View style={styles.photoIconBtn}>
                    <MaterialIcons name="photo-camera" size={26} color={colors.primary} />
                    <Text style={styles.photoIconLabel}>Caméra</Text>
                  </View>
                  <View style={styles.photoSeparator} />
                  <View style={styles.photoIconBtn}>
                    <MaterialIcons name="photo-library" size={26} color={colors.primary} />
                    <Text style={styles.photoIconLabel}>Galerie</Text>
                  </View>
                </View>
                <Text style={styles.photoHint}>Optionnel — recommandé pour la validation</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Produit ── */}
          <Text style={styles.sectionLabel}>Produit</Text>

          <View style={styles.inputBox}>
            <MaterialIcons name="local-grocery-store" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Nom du produit (ex: Nutella 400g)"
              placeholderTextColor={colors.text.tertiary}
              value={productName}
              onChangeText={setProductName}
            />
          </View>

          <View style={styles.inputBox}>
            <MaterialIcons name="qr-code" size={18} color={colors.text.tertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Code EAN (optionnel)"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="number-pad"
              value={ean}
              onChangeText={setEan}
            />
          </View>

          {/* ── Prix ── */}
          <Text style={styles.sectionLabel}>Prix</Text>

          <View style={styles.priceRow}>
            <View style={[styles.inputBox, styles.priceBox]}>
              <Text style={styles.pricePrefixLabel}>Prix normal</Text>
              <View style={styles.priceInputRow}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="2,49"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="decimal-pad"
                  value={originalPrice}
                  onChangeText={setOriginalPrice}
                />
                <Text style={styles.priceCurrency}>€</Text>
              </View>
            </View>

            <View style={styles.priceArrowWrap}>
              <MaterialIcons name="trending-down" size={24} color={colors.success} />
            </View>

            <View style={[styles.inputBox, styles.priceBox, styles.promoPriceBox]}>
              <Text style={[styles.pricePrefixLabel, { color: colors.success }]}>Prix promo</Text>
              <View style={styles.priceInputRow}>
                <TextInput
                  style={[styles.priceInput, { color: colors.success }]}
                  placeholder="1,29"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="decimal-pad"
                  value={promoPrice}
                  onChangeText={setPromoPrice}
                />
                <Text style={[styles.priceCurrency, { color: colors.success }]}>€</Text>
              </View>
            </View>
          </View>

          {savingsValid && (
            <View style={styles.savingsRow}>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>-{percent}%</Text>
              </View>
              <Text style={styles.savingsCaption}>
                Économie de {(origNum - promoNum).toFixed(2).replace('.', ',')} €
              </Text>
            </View>
          )}

          {/* ── Magasin ── */}
          <Text style={styles.sectionLabel}>Magasin</Text>

          <TouchableOpacity
            style={[styles.inputBox, styles.storeSelector]}
            onPress={() => setStorePickerOpen(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="store"
              size={18}
              color={selectedStore ? colors.primary : colors.text.tertiary}
              style={styles.inputIcon}
            />
            <Text style={[styles.storeSelectorText, !selectedStore && styles.placeholder]}>
              {selectedStore?.name ?? 'Choisir un magasin…'}
            </Text>
            <MaterialIcons name="expand-more" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* ── Aperçu promo ── */}
          {canSubmit && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.previewHeaderText}>Aperçu de ta contribution</Text>
              </View>
              <Text style={styles.previewMessage}>
                {productName} à {promoNum.toFixed(2).replace('.', ',')} € chez {selectedStore?.name}
              </Text>
              <Text style={styles.previewSaving}>
                Au lieu de {origNum.toFixed(2).replace('.', ',')} € · -{percent}% d'économie
              </Text>
            </View>
          )}

          {/* ── Bouton publier ── */}
          <Button
            label="Publier la promo"
            variant="primary"
            icon="send"
            onPress={handlePublish}
            disabled={!canSubmit}
            loading={submitting}
            fullWidth
            style={styles.publishBtn}
          />

          <Text style={styles.disclaimer}>
            En publiant, tu partages cette info avec la communauté PanierMalin.
            Les promos sont soumises à validation avant apparition publique.
          </Text>
        </ScrollView>

        {/* ── Picker magasin (bottom sheet) ── */}
        <Modal
          visible={storePickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setStorePickerOpen(false)}
        >
          <View style={styles.pickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setStorePickerOpen(false)} />
            <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + spacing[4] }]}>
              <View style={styles.pickerHandle} />
              <Text style={styles.pickerTitle}>Choisir un magasin</Text>

              {storesLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing[5] }} />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
                  {stores.map((store) => {
                    const isSelected = selectedStore?.id === store.id;
                    return (
                      <TouchableOpacity
                        key={store.id}
                        style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                        onPress={() => {
                          setSelectedStore(store);
                          setStorePickerOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                          {store.name}
                        </Text>
                        {isSelected && (
                          <MaterialIcons name="check" size={18} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[12],
  },

  // Section labels
  sectionLabel: {
    ...typography.labelMedium,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing[2],
    marginTop: spacing[5],
  },

  // Photo
  photoArea: {
    height: 180,
    backgroundColor: colors.primary_light,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyContent: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  photoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
  },
  photoIconBtn: {
    alignItems: 'center',
    gap: spacing[1],
  },
  photoIconLabel: {
    ...typography.captionLarge,
    color: colors.primary,
    fontWeight: '600',
  },
  photoSeparator: {
    width: 1,
    height: 36,
    backgroundColor: colors.primary,
    opacity: 0.3,
  },
  photoHint: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  photoRetakeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  photoRetakeText: {
    ...typography.labelMedium,
    color: colors.white,
  },

  // Inputs
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing[4],
    minHeight: 52,
    marginBottom: spacing[3],
  },
  inputIcon: {
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    ...typography.bodyLarge,
    color: colors.text.primary,
    paddingVertical: spacing[3],
  },

  // Prix
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  priceBox: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: 0,
  },
  promoPriceBox: {
    borderColor: colors.success,
  },
  pricePrefixLabel: {
    ...typography.captionSmall,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[1],
  },
  priceInput: {
    ...typography.h3,
    color: colors.text.primary,
    minWidth: 52,
    padding: 0,
  },
  priceCurrency: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  priceArrowWrap: {
    paddingTop: spacing[4],
  },

  // Badge économies
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[1],
  },
  savingsBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.full,
  },
  savingsBadgeText: {
    ...typography.labelLarge,
    color: colors.white,
    fontWeight: '800',
  },
  savingsCaption: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },

  // Store
  storeSelector: {
    marginBottom: spacing[3],
  },
  storeSelectorText: {
    flex: 1,
    ...typography.bodyLarge,
    color: colors.text.primary,
  },
  placeholder: {
    color: colors.text.tertiary,
  },

  // Aperçu
  previewCard: {
    backgroundColor: colors.success_light,
    borderRadius: radii.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.success,
    gap: spacing[1],
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  previewHeaderText: {
    ...typography.labelMedium,
    color: colors.success,
  },
  previewMessage: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
  previewSaving: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },

  // Publish
  publishBtn: {
    marginBottom: spacing[3],
  },
  disclaimer: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Store picker
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  pickerSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingTop: spacing[3],
    paddingHorizontal: spacing[5],
    maxHeight: '70%',
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  pickerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[3],
  },
  pickerScroll: {
    flexGrow: 0,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary_light,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    marginHorizontal: -spacing[3],
    borderBottomWidth: 0,
    marginBottom: 1,
  },
  pickerItemText: {
    ...typography.bodyLarge,
    color: colors.text.primary,
  },
  pickerItemTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
