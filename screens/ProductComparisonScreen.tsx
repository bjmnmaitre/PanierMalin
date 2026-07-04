// screens/ProductComparisonScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import FreshnessBadge from '../components/FreshnessBadge';
import { getProductByEan } from '../services/api';
import { ProductWithOffers, StoreOffer } from '../services/types';

function formatPrice(price: number): string {
  return `${price.toFixed(2).replace('.', ',')}€`;
}

interface Props {
  ean: string;
  onNavigate: (tab: TabKey) => void;
  onBack: () => void;
  onAddToList: () => void;
  onConfirmWithPhoto: () => void;
  onReportDifferentPrice: () => void;
}

export default function ProductComparisonScreen({
  ean,
  onNavigate,
  onBack,
  onAddToList,
  onConfirmWithPhoto,
  onReportDifferentPrice,
}: Props) {
  const [product, setProduct] = useState<ProductWithOffers | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProductByEan(ean)
      .then((p) => setProduct(p))
      .catch((err) => console.error('[ProductComparisonScreen] getProductByEan failed', err))
      .finally(() => setLoading(false));
  }, [ean]);

  if (loading || !product) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  const offers: StoreOffer[] = product.offers;
  const bestOffer = offers[0];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
            <MaterialIcons name="arrow-back-ios" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[Typography.h1, { color: Colors.primary }]}>Panier Malin</Text>
        </View>
        <View style={styles.headerRight}>
          <MaterialIcons name="search" size={22} color={Colors.primary} />
          <Image
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXYDBCziJlFgkSlWKm8ihizfJcsCKGCJtSYD-tUynjUDjnMFOTGkM9ZMdJ1HOjsPIH4i8G0Cfb_QuOXWq6WUJsbhJK2sZsGqnzUXaST0z0cggRCdznE3lF31V4Sr0gcbszqLKd8qRkOAdh6MDYm1zvvzPp47jyjV2DRcY0_Lf-mwJF24derlUS_Qxn4yNwOtMiNPwiszT_oUfHUtONETxSK-dCfJtO7djCBEwIe-4FnCYAVEaOJZH7iKwwNtGW8zicCe3V5fr7QMY' }}
            style={styles.profileAvatar}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Fiche produit */}
        <View style={styles.productCard}>
          <Image
            source={{ uri: product.imageUrl ?? undefined }}
            style={styles.productImage}
          />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text style={[Typography.labelSm, { color: Colors.secondary, textTransform: 'uppercase' }]}>
              {product.brand}
            </Text>
            <Text style={[Typography.h2, { marginTop: 4, marginBottom: 6 }]}>
              {product.name}
            </Text>
            {product.nutriscore && (
              <View style={styles.nutriScoreBadge}>
                <Text style={[Typography.labelSm, { color: Colors.primary, textTransform: 'none' }]}>
                  NUTRI-SCORE {product.nutriscore}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Meilleur prix trouvé */}
        {bestOffer && (
          <View style={styles.bestPriceCard}>
            <View style={styles.bestPriceRow}>
              <View>
                <Text style={[Typography.labelSm, { color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }]}>
                  Meilleur prix trouvé
                </Text>
                <View style={styles.bestPriceValueRow}>
                  <Text style={styles.bestPriceValue}>{formatPrice(bestOffer.price)}</Text>
                  <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.8)' }]}>
                    chez {bestOffer.storeName.split(' ')[0]}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={styles.pulseDotRow}>
                  <View style={styles.pulseDot} />
                  <FreshnessBadge verifiedAt={bestOffer.verifiedAt} />
                </View>
                <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.8)' }]}>
                  à {bestOffer.distanceKm} km de vous
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Comparatif enseignes */}
        <Text style={[Typography.bodyLg, { marginBottom: 8, marginLeft: 4 }]}>Comparer les enseignes</Text>
        <View style={styles.offersCard}>
          {offers.map((offer, index) => (
            <View
              key={offer.id}
              style={[styles.offerRow, index < offers.length - 1 && styles.offerRowBorder]}
            >
              <View style={styles.offerLeft}>
                <View style={styles.logoBox}>
                  <Image source={{ uri: offer.logoUri }} style={styles.logoImage} />
                </View>
                <View>
                  <Text style={Typography.bodyLg}>{offer.storeName}</Text>
                  <View style={styles.offerMetaRow}>
                    <Text style={Typography.caption}>{offer.distanceKm} km</Text>
                    <Text style={[Typography.caption, { color: Colors.border }]}>•</Text>
                    <FreshnessBadge verifiedAt={offer.verifiedAt} />
                  </View>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[Typography.h2, { color: index === 0 ? Colors.primary : Colors.textPrimary }]}>
                  {formatPrice(offer.price)}
                </Text>
                {offer.proofImageUri && (
                  <Image source={{ uri: offer.proofImageUri }} style={styles.proofThumb} />
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Actions communautaires — mécanisme différenciant */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.confirmPhotoButton} onPress={onConfirmWithPhoto} activeOpacity={0.85}>
            <MaterialIcons name="photo-camera" size={16} color={Colors.white} />
            <Text style={[Typography.caption, { color: Colors.white, fontWeight: '700', fontSize: 13 }]} numberOfLines={1}>
              Confirmer photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportButton} onPress={onReportDifferentPrice} activeOpacity={0.85}>
            <Text style={[Typography.caption, { color: Colors.tertiary, fontWeight: '700', fontSize: 13 }]} numberOfLines={1}>
              Signaler un écart
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[Typography.caption, { color: Colors.secondary, textAlign: 'center', marginBottom: 16 }]}>
          +20 points si tu es le premier aujourd'hui
        </Text>

        {/* Ajouter à la liste */}
        <TouchableOpacity style={styles.addButton} onPress={onAddToList} activeOpacity={0.9}>
          <MaterialIcons name="add-circle" size={20} color={Colors.white} />
          <Text style={[Typography.bodyLg, { color: Colors.white }]}>Ajouter à ma liste</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav active="scanner" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: Colors.background,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 },
  productCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 12,
    ...Shadows.soft,
  },
  productImage: { width: 96, height: 96, borderRadius: 12, backgroundColor: Colors.border },
  nutriScoreBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  bestPriceCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 16,
    ...Shadows.active,
  },
  bestPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bestPriceValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  bestPriceValue: { fontSize: 30, fontWeight: '700', color: Colors.white },
  pulseDotRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#86F8C9' },
  offersCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    marginBottom: 16,
    ...Shadows.soft,
  },
  offerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  offerRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  offerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  logoImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  offerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  proofThumb: { width: 32, height: 32, borderRadius: 6, marginTop: 6, backgroundColor: Colors.border },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  confirmPhotoButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.tertiary,
    height: 48,
    paddingHorizontal: 4,
    borderRadius: Radii.button,
  },
  reportButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    height: 48,
    borderRadius: Radii.button,
    borderWidth: 1,
    borderColor: Colors.tertiary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: Radii.button,
    ...Shadows.soft,
  },
});
