import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Animated,
  FlatList,
  SafeAreaView,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { updateCrowdsourcedPrice } from '../services/api'; // Branchement API Supabase

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  targetPrice: number;
  currentPrice: number | null;
  isCompleted: boolean;
  crowdsourcedPrice?: number;
}

interface ShoppingSession {
  storeName: string;
  storeId: string;
  items: ShoppingItem[];
}

// ============================================================================
// COLORS & THEME
// ============================================================================

const COLORS = {
  primary: '#1D9E75', // Vert
  secondary: '#F59E0B', // Ambre
  tertiary: '#2563EB', // Bleu
  background: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#F97316',
  error: '#EF4444',
  disabled: '#D1D5DB',
};

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_SESSION: ShoppingSession = {
  storeName: 'Lidl',
  storeId: 'lidl_001',
  items: [
    {
      id: '1',
      name: 'Lait demi-écrémé 1L',
      category: 'Laiterie',
      targetPrice: 0.89,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '2',
      name: 'Pain complet 500g',
      category: 'Boulangerie',
      targetPrice: 1.29,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '3',
      name: 'Tomates 1kg',
      category: 'Fruits & Légumes',
      targetPrice: 2.49,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '4',
      name: 'Fromage blanc 500g',
      category: 'Laiterie',
      targetPrice: 1.19,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '5',
      name: 'Oeufs bio x6',
      category: 'Laiterie',
      targetPrice: 2.15,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '6',
      name: 'Huile olive 500ml',
      category: 'Épicerie',
      targetPrice: 5.99,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '7',
      name: 'Pâtes complètes 500g',
      category: 'Épicerie',
      targetPrice: 0.99,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '8',
      name: 'Yaourt nature x4',
      category: 'Laiterie',
      targetPrice: 1.49,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '9',
      name: 'Bananes 1kg',
      category: 'Fruits & Légumes',
      targetPrice: 1.79,
      currentPrice: null,
      isCompleted: false,
    },
    {
      id: '10',
      name: 'Poisson blanc 400g',
      category: 'Surgelés',
      targetPrice: 3.49,
      currentPrice: null,
      isCompleted: false,
    },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ShoppingModeScreen() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<ShoppingSession>(MOCK_SESSION);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [xpAnimations, setXpAnimations] = useState<{ [key: string]: Animated.Value }>({});

  const completedCount = session.items.filter((item) => item.isCompleted).length;
  const totalCount = session.items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // =========================================================================
  // XP ANIMATION
  // =========================================================================

  const triggerXPAnimation = (itemId: string) => {
    const anim = new Animated.Value(0);
    setXpAnimations((prev) => ({ ...prev, [itemId]: anim }));

    Animated.sequence([
      Animated.timing(anim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.delay(300),
      Animated.timing(anim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleToggleItem = (itemId: string) => {
    setSession((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
      ),
    }));

    // Trigger XP animation on check
    const item = session.items.find((i) => i.id === itemId);
    if (item && !item.isCompleted) {
      triggerXPAnimation(itemId);
    }
  };

  const handleOpenPriceModal = (itemId: string) => {
    setSelectedItemId(itemId);
    setPriceInput('');
    setPriceModalVisible(true);
  };

  const handleSubmitPrice = async () => {
    if (!selectedItemId || !priceInput.trim()) return;

    const price = parseFloat(priceInput);
    if (isNaN(price) || price < 0) return;

    // ⚡ ENVOI AU BACKEND SUPABASE (Waze-like)
    try {
      await updateCrowdsourcedPrice(selectedItemId, session.storeId, price);
      console.log('[UI] Prix envoyé avec succès à Supabase');
    } catch (err) {
      console.error('[UI] Échec de l\'envoi du prix :', err);
    }

    // Mise à jour de l'état UI local
    setSession((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === selectedItemId ? { ...item, crowdsourcedPrice: price } : item
      ),
    }));

    setPriceModalVisible(false);
    setPriceInput('');
    setSelectedItemId(null);
  };

  const handleNextStore = () => {
    console.log('Next store');
  };

  const handleAbandon = () => {
    console.log('Abandon session');
  };

  // =========================================================================
  // RENDER ITEM
  // =========================================================================

  const renderItem = ({ item }: { item: ShoppingItem }) => {
    const isCompleted = item.isCompleted;
    const xpAnim = xpAnimations[item.id];

    return (
      <View
        key={item.id}
        style={[
          styles.itemContainer,
          isCompleted && styles.itemContainerCompleted,
        ]}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.category}, cible ${item.targetPrice}€`}
        accessibilityHint={isCompleted ? 'Coché' : 'Non coché'}
        accessibilityState={{ checked: isCompleted }}
      >
        {/* Checkbox + Double Codage */}
        <TouchableOpacity
          style={[
            styles.checkboxContainer,
            isCompleted && styles.checkboxCompleted,
          ]}
          onPress={() => handleToggleItem(item.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted }}
          accessible={true}
        >
          {isCompleted ? (
            <Feather name="check" size={20} color={COLORS.background} />
          ) : (
            <View style={styles.checkboxEmpty} />
          )}
        </TouchableOpacity>

        {/* Item Text */}
        <View style={styles.itemTextContainer}>
          <Text
            style={[
              styles.itemName,
              isCompleted && styles.itemNameStrikethrough,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[
              styles.itemCategory,
              isCompleted && styles.itemCategoryGrayed,
            ]}
          >
            {item.category}
          </Text>
          {item.crowdsourcedPrice && (
            <Text style={styles.crowdsourcedLabel}>
              Prix rayon: {item.crowdsourcedPrice.toFixed(2)}€
            </Text>
          )}
        </View>

        {/* Price + Button */}
        <View style={styles.itemRightContainer}>
          <Text style={[styles.itemPrice, isCompleted && styles.itemPriceGrayed]}>
            {item.targetPrice.toFixed(2)}€
          </Text>
          <TouchableOpacity
            style={styles.priceErrorButton}
            onPress={() => handleOpenPriceModal(item.id)}
            accessible={true}
            accessibilityLabel="Prix erroné"
            accessibilityHint="Signaler un prix différent"
          >
            <Feather name="alert-circle" size={18} color={COLORS.warning} />
          </TouchableOpacity>
        </View>

        {/* XP Animation */}
        {xpAnim && (
          <Animated.View
            style={[
              styles.xpBadge,
              {
                opacity: xpAnim,
                transform: [
                  {
                    translateY: xpAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -40],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.xpText}>+10 XP</Text>
          </Animated.View>
        )}
      </View>
    );
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.storeName}>{session.storeName}</Text>
          <Text style={styles.progressText}>
            {completedCount}/{totalCount} articles
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%` },
            ]}
          />
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={session.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        scrollEnabled={true}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        accessible={false}
      />

      {/* FOOTER */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.abandonButton}
          onPress={handleAbandon}
          accessible={true}
          accessibilityLabel="Abandonner la course"
          accessibilityRole="button"
        >
          <Feather name="x" size={20} color={COLORS.text} />
          <Text style={styles.abandonButtonText}>Abandonner</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextStoreButton}
          onPress={handleNextStore}
          accessible={true}
          accessibilityLabel="Magasin suivant"
          accessibilityRole="button"
          accessibilityState={{ disabled: completedCount < totalCount }}
        >
          <Feather name="check-circle" size={20} color={COLORS.background} />
          <Text style={styles.nextStoreButtonText}>Magasin suivant</Text>
        </TouchableOpacity>
      </View>

      {/* PRICE ERROR MODAL */}
      <Modal
        visible={priceModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPriceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Prix en rayon</Text>
              <TouchableOpacity
                onPress={() => setPriceModalVisible(false)}
                accessible={true}
                accessibilityLabel="Fermer"
              >
                <Feather name="x" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedItemId && (
              <View style={styles.modalItemName}>
                <Text style={styles.modalItemLabel}>
                  {session.items.find((i) => i.id === selectedItemId)?.name}
                </Text>
              </View>
            )}

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalInputLabel}>Entrez le vrai prix (€)</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="ex: 0.99"
                  keyboardType="decimal-pad"
                  value={priceInput}
                  onChangeText={setPriceInput}
                  accessibilityLabel="Champ de saisie du prix"
                  accessible={true}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setPriceModalVisible(false)}
                accessible={true}
                accessibilityLabel="Annuler"
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonSubmit}
                onPress={handleSubmitPrice}
                accessible={true}
                accessibilityLabel="Confirmer le prix"
                accessibilityRole="button"
              >
                <Feather name="check" size={18} color={COLORS.background} />
                <Text style={styles.modalButtonSubmitText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  storeName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 12,
  },
  progressBar: {
    height: 24,
    backgroundColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  progressPercent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.border,
  },
  itemContainerCompleted: {
    backgroundColor: COLORS.border,
    borderLeftColor: COLORS.primary,
  },
  checkboxContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: COLORS.background,
  },
  checkboxCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxEmpty: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  itemTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  itemNameStrikethrough: {
    textDecorationLine: 'line-through',
    color: COLORS.textLight,
  },
  itemCategory: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  itemCategoryGrayed: {
    color: COLORS.disabled,
  },
  crowdsourcedLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    fontWeight: '500',
    marginTop: 2,
  },
  itemRightContainer: {
    alignItems: 'center',
    gap: 6,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  itemPriceGrayed: {
    color: COLORS.disabled,
  },
  priceErrorButton: {
    padding: 6,
  },
  xpBadge: {
    position: 'absolute',
    right: 16,
    top: 12,
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  xpText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  abandonButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  abandonButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  nextStoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    gap: 8,
  },
  nextStoreButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.background,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalItemName: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalInputContainer: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: COLORS.tertiary,
    borderRadius: 10,
    overflow: 'hidden',
  },
  priceInput: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalButtonSubmit: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  modalButtonSubmitText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.background,
  },
});