import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@/design';
import { Card, Button, Input, Badge } from '@/components/primitives';
import { Header } from '@/components/features';
import { getListItems, addListItem, toggleItemChecked, deleteListItem } from '@/services/api';
import type { ListItem } from '@/types';
import { formatPrice } from '@/utils/formatters';

export interface ListDetailScreenProps {
  listId: string;
  listName: string;
  onBack: () => void;
}

export default function ListDetailScreen({ listId, listName, onBack }: ListDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    getListItems(listId)
      .then((data) => setItems(data))
      .catch((err) => console.error('[ListDetailScreen] Erreur chargement articles', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, [listId]);

  const handleAddItem = async () => {
    if (!newItemName.trim() || submitting) return;

    try {
      setSubmitting(true);
      const createdItem = await addListItem(listId, newItemName.trim());
      setItems((prevItems) => [...prevItems, createdItem]);
      setNewItemName('');
    } catch (err) {
      console.error('[ListDetailScreen] Erreur lors de l\'ajout de l\'article', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleItemCheck = async (item: ListItem) => {
    const originalChecked = item.checked;

    try {
      setItems((prevItems) =>
        prevItems.map((i) => (i.id === item.id ? { ...i, checked: !originalChecked } : i))
      );
      await toggleItemChecked(item.id, Boolean(originalChecked));
    } catch (err) {
      console.error('[ListDetailScreen] Erreur modification statut article', err);
      setItems((prevItems) =>
        prevItems.map((i) => (i.id === item.id ? { ...i, checked: originalChecked } : i))
      );
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const originalItems = [...items];

    try {
      setItems((prevItems) => prevItems.filter((i) => i.id !== itemId));
      await deleteListItem(itemId);
    } catch (err) {
      console.error('[ListDetailScreen] Erreur suppression article', err);
      setItems(originalItems);
    }
  };

  const handleOptimize = () => {
    router.push({
      pathname: '/optimize',
      params: { listId, listName },
    });
  };

  const handleStartShopping = () => {
    router.push({
      pathname: '/shopping-mode',
      params: { listId },
    });
  };

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top }}>
        <Header title={listName} onBackPress={onBack} />
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputFlex}>
          <Input
            placeholder="Ajouter un article rapide…"
            value={newItemName}
            onChangeText={setNewItemName}
            disabled={submitting}
          />
        </View>
        <Button
          label=""
          icon="add"
          variant="primary"
          onPress={handleAddItem}
          disabled={submitting || !newItemName.trim()}
          loading={submitting}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Synchronisation des rayons…</Text>
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
              <Text style={styles.emptyText}>Ton panier d'achat est vide.</Text>
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

                  {!item.checked && (item.aiBestPrice || item.communityPromo) && (
                    <View style={styles.badgeContainer}>
                      {item.aiBestPrice && (
                        <Badge
                          label={`IA : ${formatPrice(item.aiBestPrice.price)} chez ${item.aiBestPrice.storeName}`}
                          icon="psychology"
                          variant="info"
                          size="sm"
                        />
                      )}
                      {item.communityPromo && (
                        <Badge
                          label={`Promo ${item.communityPromo.discountLabel} (${item.communityPromo.userName})`}
                          icon="photo-camera"
                          variant="warning"
                          size="sm"
                        />
                      )}
                    </View>
                  )}
                </View>

                <Pressable onPress={() => handleDeleteItem(item.id)} hitSlop={8} style={styles.deleteButton}>
                  <MaterialIcons name="close" size={18} color={colors.error} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
        <Button
          label="Démarrer la course"
          icon="directions-run"
          variant="primary"
          fullWidth
          onPress={handleStartShopping}
          style={styles.startShoppingButton}
        />
        <Button label="Optimiser mon panier" icon="flash-on" variant="outline" fullWidth onPress={handleOptimize} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  inputFlex: {
    flex: 1,
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
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  deleteButton: {
    padding: spacing[1],
    marginLeft: spacing[2],
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[2],
  },
  startShoppingButton: {
    marginBottom: 0,
  },
});
