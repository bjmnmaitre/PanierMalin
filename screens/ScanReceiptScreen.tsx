// screens/ScanReceiptScreen.tsx
// Scan de ticket de caisse avec animation OCR + récompense MalinCoins

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { simulateReceiptOCR, normalizeReceiptLines, OcrReceiptResult, NormalizationResult } from '../services/ocr';
import { awardMalinCoins } from '../services/api';
import { apiClient } from '../services/api/client';
import { Colors } from '../theme/colors';
import { Radii, Shadows } from '../theme/typography';

const OCR_REWARD_COINS = 50;

interface Props {
  onBack: () => void;
}

// Résout l'ID Supabase d'un magasin à partir du nom et de la ville OCR
async function resolveStoreByOcr(storeName: string, storeCity: string): Promise<string | null> {
  try {
    const supabase = apiClient.getSupabase();
    const { data } = await supabase
      .from('stores')
      .select('id')
      .ilike('name', `%${storeName.slice(0, 6)}%`)
      .ilike('city', `%${storeCity.slice(0, 5)}%`)
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

export default function ScanReceiptScreen({ onBack }: Props) {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const [imageUri, setImageUri]             = useState<string | null>(null);
  const [scanning, setScanning]             = useState(false);
  const [normalizing, setNormalizing]       = useState(false);
  const [result, setResult]                 = useState<OcrReceiptResult | null>(null);
  const [normResult, setNormResult]         = useState<NormalizationResult | null>(null);
  const [rewarded, setRewarded]             = useState(false);
  const [resolvedStoreId, setResolvedStoreId] = useState<string | null>(null);
  const scanLineY = useRef(new Animated.Value(0)).current;
  const scanOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.5)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // ─── Animation de scan ───────────────────────────────────────────────────────

  const startScanAnimation = useCallback((imageHeight: number) => {
    scanLineY.setValue(0);
    Animated.timing(scanOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, {
          toValue: imageHeight,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineY, {
          toValue: 0,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scanLineY, scanOpacity]);

  const stopScanAnimation = useCallback(() => {
    scanLineY.stopAnimation();
    Animated.timing(scanOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, [scanLineY, scanOpacity]);

  // ─── Afficher l'animation de succès ──────────────────────────────────────────

  const showSuccess = useCallback(() => {
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [successScale, successOpacity]);

  // ─── Sélection d'image ────────────────────────────────────────────────────────

  const pickImage = async (fromCamera: boolean) => {
    const fn = fromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (perm.status !== 'granted') {
      Alert.alert('Permission refusée', 'Autorisez l\'accès pour scanner un ticket.');
      return;
    }

    const res = await fn({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (res.canceled) return;
    const uri = res.assets[0].uri;
    setImageUri(uri);
    setResult(null);
    setRewarded(false);
    setNormResult(null);
    setResolvedStoreId(null);
    successScale.setValue(0.5);
    successOpacity.setValue(0);
    processImage(uri);
  };

  const processImage = async (uri: string) => {
    setScanning(true);
    startScanAnimation(240);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const ocr = await simulateReceiptOCR(uri);
      stopScanAnimation();
      setResult(ocr);
      setScanning(false);

      // Résolution du magasin en parallèle avec la normalisation
      const [storeId] = await Promise.all([
        resolveStoreByOcr(ocr.storeName, ocr.storeCity),
        (async () => {
          // Normalisation NLP via Supabase
          setNormalizing(true);
          const rawLines = ocr.rawText.split('\n').filter((l) => l.trim().length > 0);
          try {
            const norm = await normalizeReceiptLines('00000000-0000-0000-0000-000000000000', rawLines);
            setNormResult(norm);
          } catch {
            // best-effort
          } finally {
            setNormalizing(false);
          }
        })(),
      ]);

      if (storeId) setResolvedStoreId(storeId);

      // Récompense MalinCoins — CoinRain déclenché automatiquement via CoinsWatcher → Realtime
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await awardMalinCoins(OCR_REWARD_COINS);
      setRewarded(true);
      showSuccess();
    } catch (err) {
      stopScanAnimation();
      setScanning(false);
      Alert.alert('Erreur OCR', 'Impossible d\'analyser ce ticket. Réessaie avec une meilleure photo.');
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Scanner un ticket</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Zone image */}
        <View style={s.imageZone}>
          {imageUri ? (
            <View style={s.imageWrapper}>
              <Image source={{ uri: imageUri }} style={s.receiptImage} contentFit="cover" cachePolicy="memory" />
              {/* Ligne de scan animée */}
              <Animated.View
                pointerEvents="none"
                style={[s.scanLine, { opacity: scanOpacity, transform: [{ translateY: scanLineY }] }]}
              >
                <View style={s.scanGlow} />
              </Animated.View>
              {/* Overlay scanning */}
              {scanning && (
                <View style={s.scanOverlay} pointerEvents="none">
                  <View style={s.scanCorner} />
                </View>
              )}
            </View>
          ) : (
            <View style={s.imagePlaceholder}>
              <MaterialIcons name="receipt-long" size={64} color="#CBD5E1" />
              <Text style={s.placeholderText}>Prenez une photo de votre ticket de caisse</Text>
            </View>
          )}
        </View>

        {/* Status OCR */}
        {scanning && (
          <View style={s.statusRow}>
            <ActivityIndicator color="#FF6B00" size="small" />
            <Text style={s.statusText}>Analyse du ticket en cours…</Text>
          </View>
        )}

        {/* Récompense */}
        {rewarded && (
          <Animated.View style={[s.rewardBanner, { opacity: successOpacity, transform: [{ scale: successScale }] }]}>
            <Text style={s.rewardEmoji}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.rewardTitle}>+{OCR_REWARD_COINS} MalinCoins gagnés !</Text>
              <Text style={s.rewardSub}>Bravo Sentinelle, continuez comme ça !</Text>
            </View>
            {resolvedStoreId && (
              <TouchableOpacity
                style={s.storeBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/store/${resolvedStoreId}` as any);
                }}
                activeOpacity={0.85}
              >
                <MaterialIcons name="store" size={14} color="#0F172A" />
                <Text style={s.storeBtnTxt}>Voir</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Résultat OCR */}
        {result && (
          <View style={s.resultCard}>
            <Text style={s.resultTitle}>Ticket analysé</Text>

            <View style={s.resultRow}>
              <MaterialIcons name="store" size={16} color="#64748B" />
              <Text style={s.resultLabel}>Magasin :</Text>
              <Text style={s.resultValue}>{result.storeName} {result.storeCity}</Text>
            </View>
            <View style={s.resultRow}>
              <MaterialIcons name="calendar-today" size={16} color="#64748B" />
              <Text style={s.resultLabel}>Date :</Text>
              <Text style={s.resultValue}>{result.date}</Text>
            </View>
            <View style={s.resultRow}>
              <MaterialIcons name="euro" size={16} color="#64748B" />
              <Text style={s.resultLabel}>Total :</Text>
              <Text style={[s.resultValue, { color: '#10B981', fontWeight: '800' }]}>
                {result.totalAmount.toFixed(2)} €
              </Text>
            </View>

            <View style={s.itemsDivider} />
            <Text style={s.itemsTitle}>Articles détectés</Text>
            {result.items.map((item, i) => (
              <View key={i} style={s.itemRow}>
                <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.itemPrice}>{item.price.toFixed(2)} €</Text>
              </View>
            ))}
          </View>
        )}

        {/* Normalisation NLP — spinner puis résultat */}
        {normalizing && (
          <View style={s.statusRow}>
            <ActivityIndicator color="#1D9E75" size="small" />
            <Text style={s.statusText}>Recherche des produits en base…</Text>
          </View>
        )}

        {normResult && normResult.matchCount > 0 && (
          <View style={s.normCard}>
            <View style={s.normHeader}>
              <MaterialIcons name="check-circle" size={18} color="#10B981" />
              <Text style={s.normTitle}>
                {normResult.matchCount} produit{normResult.matchCount > 1 ? 's' : ''} identifié{normResult.matchCount > 1 ? 's' : ''} · inventaire mis à jour
              </Text>
            </View>
            {normResult.matched.slice(0, 5).map((m, i) => (
              <View key={i} style={s.normRow}>
                <Text style={s.normProduct} numberOfLines={1}>{m.productName}</Text>
                <Text style={s.normPrice}>{m.price.toFixed(2)} €</Text>
              </View>
            ))}
            {normResult.unmatched.length > 0 && (
              <Text style={s.normUnmatched}>
                {normResult.unmatched.length} ligne{normResult.unmatched.length > 1 ? 's' : ''} non reconnue{normResult.unmatched.length > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        )}

        {/* Boutons d'action */}
        <View style={s.actionsRow}>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]} onPress={() => pickImage(true)} activeOpacity={0.85}>
            <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
            <Text style={s.actionBtnText}>Prendre une photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnSecondary]} onPress={() => pickImage(false)} activeOpacity={0.85}>
            <MaterialIcons name="photo-library" size={20} color="#FF6B00" />
            <Text style={[s.actionBtnText, { color: '#FF6B00' }]}>Galerie</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={s.infoBox}>
          <MaterialIcons name="info-outline" size={16} color="#64748B" />
          <Text style={s.infoText}>
            Chaque ticket validé vous rapporte {OCR_REWARD_COINS} MalinCoins.
            Assurez-vous que le ticket est lisible et bien éclairé.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  scroll: { padding: 16, paddingBottom: 48, gap: 16 },

  imageZone: { borderRadius: Radii.card, overflow: 'hidden', ...Shadows.soft },
  imageWrapper: { position: 'relative' },
  receiptImage: { width: '100%', height: 240, backgroundColor: '#F1F5F9' },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 3,
  },
  scanGlow: {
    height: 3, backgroundColor: '#FF6B00',
    shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 8,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2, borderColor: '#FF6B00', borderRadius: Radii.card,
  },
  scanCorner: { position: 'absolute', top: 8, left: 8, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#FF6B00' },

  imagePlaceholder: {
    height: 200, backgroundColor: '#F8FAFC',
    borderRadius: Radii.card, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20,
  },
  placeholderText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
  statusText: { fontSize: 14, color: '#64748B', fontWeight: '500' },

  rewardBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0F172A', borderRadius: Radii.card, padding: 16, ...Shadows.active,
  },
  rewardEmoji: { fontSize: 32 },
  rewardTitle: { fontSize: 16, fontWeight: '800', color: '#FFD700' },
  rewardSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  storeBtn: {
    backgroundColor: '#FFD700', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  storeBtnTxt: { fontSize: 12, fontWeight: '800', color: '#0F172A' },

  resultCard: {
    backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 16, ...Shadows.soft, gap: 8,
  },
  resultTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultLabel: { fontSize: 13, color: '#64748B', width: 70 },
  resultValue: { fontSize: 13, color: '#0F172A', fontWeight: '600', flex: 1 },
  itemsDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  itemsTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 3 },
  itemName: { flex: 1, fontSize: 13, color: '#475569' },
  itemPrice: { fontSize: 13, fontWeight: '600', color: '#0F172A' },

  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, height: 50, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  actionBtnPrimary: { backgroundColor: '#FF6B00' },
  actionBtnSecondary: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: '#FF6B00' },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 18 },

  // ── Carte de résultats NLP ──────────────────────────────────────────────────
  normCard: {
    backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12,
  },
  normHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  normTitle: { fontSize: 13, fontWeight: '700', color: '#15803D', flex: 1 },
  normRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 3,
  },
  normProduct: { fontSize: 12, color: '#166534', flex: 1, marginRight: 8 },
  normPrice:   { fontSize: 12, fontWeight: '700', color: '#15803D' },
  normUnmatched: {
    fontSize: 11, color: '#94A3B8', marginTop: 6,
    fontStyle: 'italic',
  },
});
