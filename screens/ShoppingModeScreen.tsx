import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, ScrollView, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, radii, typography, shadows } from '@/design';
import { Card, Button, Input, Badge } from '@/components/primitives';
import { Header } from '@/components/features';
import { getListItems, toggleItemChecked, updateCrowdsourcedPrice, getClosestStores } from '@/services/api';
import type { ListItem, Store } from '@/types';
import { formatPrice } from '@/utils/formatters';

export interface ShoppingModeScreenProps {
  listId: string;
  onBack: () => void;
}

const FALLBACK_REGION = {
  latitude: 46.1601,
  longitude: -1.1511,
};

export default function ShoppingModeScreen({ listId, onBack }: ShoppingModeScreenProps) {
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<ListItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const [reportingItem, setReportingItem] = useState<ListItem | null>(null);
  const [priceText, setPriceText] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
  const [submittingPrice, setSubmittingPrice] = useState(false);

  const fetchItems = () => {
    setLoadingItems(true);
    getListItems(listId)
      .then((data) => setItems(data))
      .catch((err) => console.error('[ShoppingModeScreen] Erreur chargement articles', err))
      .finally(() => setLoadingItems(false));
  };

  useEffect(() => {
    fetchItems();
  }, [listId]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setUserCoords(FALLBACK_REGION);
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      } catch (error) {
        console.warn('[ShoppingModeScreen] Géolocalisation indisponible, repli sur la position par défaut', error);
        setUserCoords(FALLBACK_REGION);
      } finally {
        setIsLocating(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userCoords) return;

    setLoadingStores(true);
    getClosestStores(userCoords.latitude, userCoords.longitude)
      .then((data) => setStores(data))
      .catch((err) => console.error('[ShoppingModeScreen] Erreur chargement magasins', err))
      .finally(() => setLoadingStores(false));
  }, [userCoords]);

  const toggleItemCheck = async (item: ListItem) => {
    const originalChecked = item.checked;

    try {
      setItems((prevItems) =>
        prevItems.map((i) => (i.id === item.id ? { ...i, checked: !originalChecked } : i))
      );
      await toggleItemChecked(item.id, Boolean(originalChecked));
    } catch (err) {
      console.error('[ShoppingModeScreen] Erreur modification statut article', err);
      setItems((prevItems) =>
        prevItems.map((i) => (i.id === item.id ? { ...i, checked: originalChecked } : i))
      );
    }
  };

  const openPriceModal = (item: ListItem) => {
    setReportingItem(item);
    setPriceText('');
    setPriceError(null);
  };

  const closePriceModal = () => {
    if (submittingPrice) return;
    setReportingItem(null);
    setPriceText('');
    setPriceError(null);
  };

  const submitPrice = async () => {
    if (!reportingItem?.productId || !selectedStoreId) return;

    const parsedPrice = Number(priceText.replace(',', '.'));
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setPriceError('Entre un prix valide.');
      return;
    }

    setSubmittingPrice(true);
    setPriceError(null);

    try {
      await updateCrowdsourcedPrice(reportingItem.productId, selectedStoreId, parsedPrice);
      Alert.alert('Merci !', 'Ton prix a été signalé à la communauté.');
      setReportingItem(null);
      setPriceText('');
    } catch (err) {
      console.error('[ShoppingModeScreen] Erreur signalement prix', err);
      setPriceError("Impossible d'envoyer ce prix pour le moment.");
    } finally {
      setSubmittingPrice(false);
    }
  };

  const checkedCount = items.filter((item) => item.checked).length;
  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? null;

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <Header
          title="Mode Course"
          subtitle={items.length > 0 ? `${checkedCount}/${items.length} articles cochés` : undefined}
          onBackPress={onBack}
        />
      </View>

      <View style={styles.storeSection}>
        <Text style={styles.storeSectionLabel}>Tu fais tes courses chez :</Text>

        {(isLocating || loadingStores) && (
          <View style={styles.storeLoadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.storeLoadingText}>Recherche des magasins autour de toi…</Text>
          </View>
        )}

        {!isLocating && !loadingStores && stores.length === 0 && (
          <Text style={styles.storeEmptyText}>
            Aucun magasin trouvé à proximité. Le signalement de prix sera indisponible.
          </Text>
        )}

        {!isLocating && !loadingStores && stores.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeChipsRow}>
            {stores.map((store) => (
              <Pressable key={store.id} onPress={() => setSelectedStoreId(store.id)}>
                <Badge
                  label={store.name}
                  variant={selectedStoreId === store.id ? 'primary' : 'info'}
                  icon="storefront"
                />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {loadingItems ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement de la liste…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="shopping-basket" size={48} color={colors.border.default} />
              <Text style={styles.emptyText}>Cette liste est vide.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card padding="sm" shadow="sm" style={styles.itemCard}>
              <View style={styles.itemRow}>
                <Pressable
                  onPress={() => toggleItemCheck(item)}
                  hitSlop={8}
                  style={styles.checkboxContainer}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked }}
                >
                  <MaterialIcons
                    name={item.checked ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={item.checked ? colors.primary : colors.text.secondary}
                  />
                </Pressable>

                <View style={styles.itemContent}>
                  <View style={styles.itemMainInfo}>
                    <View style={styles.itemTextBlock}>
                      <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                        {item.customName}
                      </Text>
                      {item.brand && <Text style={styles.itemBrand}>{item.brand}</Text>}
                    </View>
                    {item.price !== undefined && (
                      <Text style={styles.itemPrice}>{formatPrice(item.price * (item.qty || 1))}</Text>
                    )}
                  </View>

                  {item.productId && (
                    <Button
                      label="Signaler un prix"
                      icon="price-check"
                      variant="outline"
                      size="sm"
                      disabled={!selectedStoreId}
                      onPress={() => openPriceModal(item)}
                      style={styles.reportButton}
                    />
                  )}
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Modal
        visible={!!reportingItem}
        transparent
        animationType="fade"
        onRequestClose={closePriceModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePriceModal}>
          <Pressable style={styles.modalCardWrapper} onPress={(e) => e.stopPropagation()}>
            <Card padding="lg" shadow="lg" style={styles.modalCard}>
              <Text style={styles.modalTitle}>Signaler un prix</Text>
              <Text style={styles.modalSubtitle}>
                {reportingItem?.customName}
                {selectedStore ? ` · ${selectedStore.name}` : ''}
              </Text>

              <Input
                placeholder="Nouveau prix (€)"
                value={priceText}
                onChangeText={setPriceText}
                type="number"
                leftIcon="euro-symbol"
                disabled={submittingPrice}
                error={priceError ?? undefined}
              />

              <View style={styles.modalActionsRow}>
                <View style={styles.modalActionFlex}>
                  <Button label="Annuler" variant="outline" onPress={closePriceModal} disabled={submittingPrice} fullWidth />
                </View>
                <View style={styles.modalActionFlex}>
                  <Button
                    label="Envoyer"
                    icon="send"
                    variant="primary"
                    onPress={submitPrice}
                    loading={submittingPrice}
                    fullWidth
                  />
                </View>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  storeSection: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  storeSectionLabel: {
    ...typography.labelMedium,
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  storeLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  storeLoadingText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  storeEmptyText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  storeChipsRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginTop: spacing[3],
  },
  listContent: {
    padding: spacing[4],
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: spacing[10],
    gap: spacing[2],
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  itemCard: {
    marginBottom: spacing[3],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: spacing[3],
    marginTop: 1,
  },
  itemContent: {
    flex: 1,
  },
  itemMainInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemTextBlock: {
    flex: 1,
    paddingRight: spacing[2],
  },
  itemText: {
    ...typography.labelLarge,
    color: colors.text.primary,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: colors.text.secondary,
    opacity: 0.6,
  },
  itemBrand: {
    ...typography.captionLarge,
    color: colors.text.secondary,
    marginTop: 2,
  },
  itemPrice: {
    ...typography.labelLarge,
    color: colors.text.primary,
    marginLeft: spacing[2],
  },
  reportButton: {
    marginTop: spacing[3],
    alignSelf: 'flex-start',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.bg.overlay_medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  modalCardWrapper: {
    width: '100%',
  },
  modalCard: {
    gap: spacing[3],
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  modalSubtitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginTop: -spacing[2],
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  modalActionFlex: {
    flex: 1,
  },
});
