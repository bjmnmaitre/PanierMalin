// screens/ListDetailScreen.tsx
// 
// RÈGLE DE TRAITEMENT : Fichier intégral et autonome.
// Écran "Détail de la Liste" de PanierMalin v2.0.
// Gère le pointage en rayon, les badges de détection des prix par l'IA et la communauté.

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import { ListItem } from '../services/types';
import { getListItems, addListItem, toggleItemChecked, deleteListItem } from '../services/api';

interface ListDetailScreenProps {
  listId: string;
  listName: string;
  onBack: () => void;
}

export default function ListDetailScreen({ listId, listName, onBack }: ListDetailScreenProps) {
  const router = useRouter();
  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemName, setNewItemName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Récupération des articles via l'API
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

  // Ajout rapide d'un article
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

  // Bascule du statut check/uncheck (mise à jour optimiste)
  const toggleItemCheck = async (item: ListItem) => {
    const originalChecked = item.checked;
    
    try {
      setItems((prevItems) =>
        prevItems.map((i) => (i.id === item.id ? { ...i, checked: !originalChecked } : i))
      );
      await toggleItemChecked(item.id, originalChecked);
    } catch (err) {
      console.error('[ListDetailScreen] Erreur modification statut article', err);
      setItems((prevItems) =>
        prevItems.map((i) => (i.id === item.id ? { ...i, checked: originalChecked } : i))
      );
    }
  };

  // Suppression d'un article (mise à jour optimiste)
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

  // Pont vers l'optimisateur anti-inflation
  const handleOptimize = () => {
    console.log('[ListDetailScreen] Routage vers l\'optimisateur pour :', listId);
    router.push({
      pathname: '/optimize',
      params: { listId, listName }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Barre d'outils supérieure */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {listName}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Formulaire d'insertion de produits */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ajouter un article rapide..."
          placeholderTextColor={Colors.textSecondary}
          value={newItemName}
          onChangeText={setNewItemName}
          onSubmitEditing={handleAddItem}
          editable={!submitting}
        />
        <TouchableOpacity 
          style={[styles.addButton, !newItemName.trim() && styles.addButtonDisabled]} 
          onPress={handleAddItem}
          disabled={submitting || !newItemName.trim()}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <MaterialIcons name="add" size={22} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* Liste principale */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Synchronisation des rayons...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="shopping-basket" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>Votre panier d'achat est vide.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.itemRow, Shadows.soft]}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => toggleItemCheck(item)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={item.checked ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={item.checked ? Colors.primary : Colors.textSecondary}
                />
              </TouchableOpacity>
              
              <View style={styles.itemContent}>
                <View style={styles.itemMainInfo}>
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                      {item.customName}
                    </Text>
                    {item.brand && <Text style={styles.itemBrand}>{item.brand}</Text>}
                  </View>
                  {item.price && (
                    <Text style={styles.itemPrice}>
                      {((item.price) * (item.qty || 1)).toFixed(2).replace('.', ',')} €
                    </Text>
                  )}
                </View>

                {/* Badges intelligents IA et Communauté */}
                {!item.checked && (item.aiBestPrice || item.communityPromo) && (
                  <View style={styles.badgeContainer}>
                    {item.aiBestPrice && (
                      <View style={styles.aiBadge}>
                        <MaterialIcons name="psychology" size={13} color="#673AB7" style={{ marginRight: 3 }} />
                        <Text style={styles.aiBadgeText} numberOfLines={1}>
                          IA : {item.aiBestPrice.price.toFixed(2).replace('.', ',')}€ chez {item.aiBestPrice.storeName}
                        </Text>
                      </View>
                    )}

                    {item.communityPromo && (
                      <TouchableOpacity 
                        style={styles.communityBadge}
                        activeOpacity={0.7}
                        onPress={() => console.log('Visualisation de la preuve :', item.communityPromo?.photoUri)}
                      >
                        <MaterialIcons name="photo-camera" size={13} color="#E65100" style={{ marginRight: 3 }} />
                        <Text style={styles.communityBadgeText} numberOfLines={1}>
                          Promo {item.communityPromo.discountLabel} ({item.communityPromo.userName})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteButton} activeOpacity={0.7}>
                <MaterialIcons name="close" size={18} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Zone d'action pour l'optimisation */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.optimizeButton, Shadows.soft]} onPress={handleOptimize} activeOpacity={0.85}>
          <MaterialIcons name="flash-on" size={18} color={Colors.white} style={{ marginRight: 6 }} />
          <Text style={styles.optimizeButtonText}>Optimiser mon panier</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', padding: 14, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 12, borderRadius: Radii.button, fontSize: 14, marginRight: 10, color: Colors.textPrimary, fontWeight: '500', borderWidth: 1, borderColor: Colors.border },
  addButton: { backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', width: 42, height: 42, borderRadius: Radii.button },
  addButtonDisabled: { backgroundColor: '#E2E8F0' },
  listContent: { padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.surface, padding: 12, borderRadius: Radii.card, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  checkboxContainer: { marginRight: 10, marginTop: 1 },
  itemContent: { flex: 1 },
  itemMainInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  itemTextChecked: { textDecorationLine: 'line-through', color: Colors.textSecondary, opacity: 0.6 },
  itemBrand: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontWeight: '500' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginLeft: 6 },
  badgeContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3E5F5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 0.5, borderColor: '#D1C4E9' },
  aiBadgeText: { fontSize: 10, color: '#673AB7', fontWeight: '700' },
  communityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFE0B2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 0.5, borderColor: '#FFCC80' },
  communityBadgeText: { fontSize: 10, color: '#E65100', fontWeight: '700' },
  deleteButton: { padding: 4, marginLeft: 6, alignSelf: 'center' },
  footer: { padding: 16, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  optimizeButton: { backgroundColor: Colors.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: Radii.button },
  optimizeButtonText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
});