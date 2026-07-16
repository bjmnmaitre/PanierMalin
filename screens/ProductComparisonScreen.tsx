import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography } from '@/design';
import { Avatar, Badge } from '@/components/primitives';
import BottomNav, { TabKey } from '@/components/BottomNav';
import FreshnessBadge from '@/components/FreshnessBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getProductByEan, getProductPrices, reportDifferentPrice } from '@/services/api';
import type { Product, ProductPrice } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return `${price.toFixed(2).replace('.', ',')} €`;
}

function StoreInitial({ name }: { name: string }) {
  const letter = (name ?? '?')[0].toUpperCase();
  return (
    <View style={styles.logoBox}>
      <Text style={styles.logoInitial}>{letter}</Text>
    </View>
  );
}

// ─── types ──────────────────────────────────────────────────────────────────

interface Props {
  ean: string;
  onNavigate: (tab: TabKey) => void;
  onBack: () => void;
  onAddToList: () => void;
}

// ─── composant principal ────────────────────────────────────────────────────

export default function ProductComparisonScreen({
  ean,
  onNavigate,
  onBack,
  onAddToList,
}: Props) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportPriceText, setReportPriceText] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  const bestPrice = prices[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getProductByEan(ean);
      if (!p) {
        setError('Produit introuvable.');
        return;
      }
      setProduct(p);
      const raw = await getProductPrices(p.id);
      setPrices([...raw].sort((a, b) => a.price - b.price));
    } catch (err) {
      console.error('[ProductComparisonScreen]', err);
      setError('Impossible de charger ce produit.');
    } finally {
      setLoading(false);
    }
  }, [ean]);

  useEffect(() => { load(); }, [load]);

  // ── rapport de prix ──────────────────────────────────────────────────────

  const openReportModal = () => {
    setReportPriceText('');
    setReportError(null);
    setReportModalVisible(true);
  };

  const closeReportModal = () => {
    if (!submittingReport) setReportModalVisible(false);
  };

  const submitReport = async () => {
    if (!bestPrice) return;
    const parsed = Number(reportPriceText.replace(',', '.'));
    if (!reportPriceText.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setReportError('Indique un prix valide.');
      return;
    }
    if (!product) return;
    try {
      setSubmittingReport(true);
      setReportError(null);
      await reportDifferentPrice(product.id, bestPrice.storeId, parsed);
      setReportModalVisible(false);
    } catch (err) {
      console.error('[ProductComparisonScreen] reportDifferentPrice failed', err);
      setReportError("Impossible d'envoyer ce signalement.");
    } finally {
      setSubmittingReport(false);
    }
  };

  // ── états de chargement / erreur ─────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="error-outline" size={40} color={colors.error} />
        <Text style={styles.errorText}>{error ?? 'Produit introuvable.'}</Text>
        <TouchableOpacity onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── rendu principal ───────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.backButton}>
          <MaterialIcons name="arrow-back-ios" size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <Avatar
          size="xs"
          name={profile?.displayName}
          source={profile?.avatarUrl ? { uri: profile.avatarUrl } : undefined}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Fiche produit */}
        <View style={styles.productCard}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <MaterialIcons name="shopping-basket" size={32} color={colors.text.tertiary} />
            </View>
          )}
          <View style={styles.productInfo}>
            {product.brand && (
              <Text style={styles.productBrand}>{product.brand}</Text>
            )}
            <Text style={styles.productName}>{product.name}</Text>
            {product.nutriscore && (
              <View style={styles.nutriscoreBadge}>
                <Text style={styles.nutriscoreText}>
                  Nutri-Score {product.nutriscore}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Meilleur prix */}
        {bestPrice && (
          <View style={styles.bestPriceCard}>
            <View style={styles.bestPriceRow}>
              <View>
                <Text style={styles.bestPriceLabel}>Meilleur prix</Text>
                <View style={styles.bestPriceValueRow}>
                  <Text style={styles.bestPriceValue}>{formatPrice(bestPrice.price)}</Text>
                  <Text style={styles.bestPriceStore}>
                    chez {(bestPrice.storeName ?? 'Magasin').split(' ')[0]}
                  </Text>
                </View>
              </View>
              <View style={styles.bestPriceMeta}>
                {bestPrice.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <MaterialIcons name="verified" size={13} color={colors.white} />
                    <Text style={styles.verifiedText}>Vérifié</Text>
                  </View>
                )}
                <FreshnessBadge
                  verifiedAt={bestPrice.verifiedAt ?? new Date().toISOString()}
                />
              </View>
            </View>
          </View>
        )}

        {/* Comparatif enseignes */}
        <Text style={styles.sectionTitle}>Comparer les enseignes</Text>

        {prices.length === 0 ? (
          <View style={styles.emptyPrices}>
            <Text style={styles.emptyPricesText}>
              Aucun prix disponible pour ce produit.
            </Text>
          </View>
        ) : (
          <View style={styles.offersCard}>
            {prices.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.offerRow,
                  index < prices.length - 1 && styles.offerRowBorder,
                ]}
              >
                <StoreInitial name={item.storeName ?? '?'} />

                <View style={styles.offerMiddle}>
                  <Text style={styles.offerStoreName}>
                    {item.storeName ?? 'Magasin inconnu'}
                  </Text>
                  <View style={styles.offerMeta}>
                    <FreshnessBadge
                      verifiedAt={item.verifiedAt ?? new Date().toISOString()}
                    />
                    {item.isVerified && (
                      <Badge label="Vérifié" variant="success" size="sm" icon="verified" />
                    )}
                  </View>
                </View>

                <View style={styles.offerRight}>
                  <Text
                    style={[
                      styles.offerPrice,
                      index === 0 && styles.offerPriceBest,
                    ]}
                  >
                    {formatPrice(item.price)}
                  </Text>
                  {item.proofImageUrl && (
                    <Image
                      source={{ uri: item.proofImageUrl }}
                      style={styles.proofThumb}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <View style={[styles.actionButton, styles.actionButtonDisabled]}>
            <MaterialIcons name="photo-camera" size={16} color={colors.text.secondary} />
            <Text style={styles.actionButtonDisabledText} numberOfLines={1}>
              Confirmer photo
            </Text>
            <Badge label="Bientôt" variant="secondary" size="sm" />
          </View>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonOutline]}
            onPress={openReportModal}
            activeOpacity={0.85}
            disabled={!bestPrice}
          >
            <Text style={styles.actionButtonOutlineText} numberOfLines={1}>
              Signaler un écart
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.addToListButton}
          onPress={onAddToList}
          activeOpacity={0.9}
        >
          <MaterialIcons name="add-circle" size={20} color={colors.white} />
          <Text style={styles.addToListText}>Ajouter à ma liste</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav active="search" onNavigate={onNavigate} />

      {/* Modal signalement */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeReportModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeReportModal} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Signaler un écart de prix</Text>
            {bestPrice?.storeName && (
              <Text style={styles.modalSubtitle}>Chez {bestPrice.storeName}</Text>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Prix observé en magasin (ex: 1,89)"
              placeholderTextColor={colors.text.secondary}
              keyboardType="decimal-pad"
              value={reportPriceText}
              onChangeText={setReportPriceText}
              editable={!submittingReport}
            />
            {reportError && (
              <Text style={styles.modalError}>{reportError}</Text>
            )}
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonOutline]}
                onPress={closeReportModal}
                disabled={submittingReport}
              >
                <Text style={styles.modalButtonOutlineLabel}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={submitReport}
                disabled={submittingReport}
              >
                {submittingReport ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.modalButtonPrimaryLabel}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[6],
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    backgroundColor: colors.primary_light,
    borderRadius: radii.md,
  },
  retryText: {
    ...typography.labelMedium,
    color: colors.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    height: 56,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing[3],
  },
  backButton: {
    padding: spacing[1],
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text.primary,
    flex: 1,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: 140,
  },

  // Fiche produit
  productCard: {
    flexDirection: 'row',
    gap: spacing[3],
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
  },
  productImage: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    backgroundColor: colors.border.light,
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing[1],
  },
  productBrand: {
    ...typography.labelSmall,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  productName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  nutriscoreBadge: {
    backgroundColor: colors.primary_light,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    marginTop: spacing[1],
  },
  nutriscoreText: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: '700',
  },

  // Meilleur prix
  bestPriceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  bestPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bestPriceLabel: {
    ...typography.captionSmall,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bestPriceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  bestPriceValue: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.white,
  },
  bestPriceStore: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  bestPriceMeta: {
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  verifiedText: {
    ...typography.captionSmall,
    color: colors.white,
    fontWeight: '600',
  },

  // Liste enseignes
  sectionTitle: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    marginBottom: spacing[2],
    paddingLeft: spacing[1],
  },
  emptyPrices: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing[5],
    alignItems: 'center',
  },
  emptyPricesText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  offersCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    marginBottom: spacing[4],
    overflow: 'hidden',
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  offerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primary_light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitial: {
    ...typography.h4,
    color: colors.primary,
    fontWeight: '700',
  },
  offerMiddle: {
    flex: 1,
    gap: spacing[1],
  },
  offerStoreName: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '500',
  },
  offerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  offerRight: {
    alignItems: 'flex-end',
    gap: spacing[1],
  },
  offerPrice: {
    ...typography.h3,
    color: colors.text.primary,
  },
  offerPriceBest: {
    color: colors.primary,
  },
  proofThumb: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.border.light,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    height: 48,
    paddingHorizontal: spacing[2],
    borderRadius: radii.lg,
  },
  actionButtonDisabled: {
    backgroundColor: colors.border.light,
  },
  actionButtonDisabledText: {
    ...typography.captionLarge,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  actionButtonOutline: {
    borderWidth: 1,
    borderColor: colors.tertiary,
  },
  actionButtonOutlineText: {
    ...typography.captionLarge,
    color: colors.tertiary,
    fontWeight: '700',
  },
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radii.lg,
  },
  addToListText: {
    ...typography.bodyLarge,
    color: colors.white,
    fontWeight: '600',
  },

  // Modal
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    paddingHorizontal: spacing[6],
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing[5],
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing[1],
  },
  modalSubtitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginBottom: spacing[4],
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...typography.bodyLarge,
    color: colors.text.primary,
  },
  modalError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing[2],
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[5],
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonOutline: {
    borderWidth: 1,
    borderColor: colors.tertiary,
  },
  modalButtonOutlineLabel: {
    ...typography.bodyLarge,
    color: colors.tertiary,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonPrimaryLabel: {
    ...typography.bodyLarge,
    color: colors.white,
    fontWeight: '600',
  },
});
