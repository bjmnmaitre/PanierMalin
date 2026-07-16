import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import { incrementUserSavings } from '../services/api';
import {
  saveCart,
  loadCart,
  clearCart,
  addPendingSavings,
  peekPendingSavings,
  consumePendingSavings,
  type CachedCartItem,
} from '../services/offlineStorage';

// ─── Types ────────────────────────────────────────────────────────────────────

type CartItem = CachedCartItem;

export interface MyCartScreenProps {
  onBack: () => void;
  onSavingsValidated?: (amount: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Composant ligne article ──────────────────────────────────────────────────

function CartRow({
  item,
  onChangeQty,
  onDelete,
}: {
  item: CartItem;
  onChangeQty: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
}) {
  const saving = (item.normalPrice - item.paidPrice) * item.quantity;
  const hasSaving = saving > 0;

  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.nameBlock}>
        <Text style={rowStyles.name} numberOfLines={2}>{item.name}</Text>
        <View style={rowStyles.priceRow}>
          <Text style={rowStyles.normalPrice}>{fmt(item.normalPrice)}</Text>
          {hasSaving && (
            <>
              <MaterialIcons name="arrow-forward" size={12} color={Colors.textMuted} />
              <Text style={rowStyles.paidPrice}>{fmt(item.paidPrice)}</Text>
            </>
          )}
          {hasSaving && (
            <View style={rowStyles.savingBadge}>
              <Text style={rowStyles.savingBadgeText}>-{fmt(saving)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={rowStyles.qtyBlock}>
        <TouchableOpacity
          style={rowStyles.qtyBtn}
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChangeQty(item.id, -1); }}
          hitSlop={8}
        >
          <MaterialIcons name="remove" size={16} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={rowStyles.qty}>{item.quantity}</Text>
        <TouchableOpacity
          style={rowStyles.qtyBtn}
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChangeQty(item.id, 1); }}
          hitSlop={8}
        >
          <MaterialIcons name="add" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        hitSlop={8}
        style={rowStyles.deleteBtn}
      >
        <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
      </TouchableOpacity>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  nameBlock: { flex: 1 },
  name: { ...Typography.bodyMd, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  normalPrice: { fontSize: 12, color: Colors.textSecondary, textDecorationLine: 'line-through' },
  paidPrice: { fontSize: 12, color: Colors.success, fontWeight: '700' },
  savingBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  savingBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  qtyBlock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  qty: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary, minWidth: 22, textAlign: 'center' },
  deleteBtn: { padding: 4 },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function MyCartScreen({ onBack, onSavingsValidated }: MyCartScreenProps) {
  const insets = useSafeAreaInsets();
  const [items, setItems]           = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated]   = useState(false);
  const [pendingSync, setPendingSync] = useState(false);

  // Formulaire d'ajout
  const [newName, setNewName]     = useState('');
  const [newNormal, setNewNormal] = useState('');
  const [newPaid, setNewPaid]     = useState('');
  const nameRef = useRef<TextInput>(null);

  // Debounce timer pour la sauvegarde
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Chargement du panier depuis AsyncStorage au démarrage
  useEffect(() => {
    (async () => {
      const [cached, pending] = await Promise.all([
        loadCart(),
        peekPendingSavings(),
      ]);
      if (cached.length > 0) setItems(cached);
      if (pending > 0) setPendingSync(true);
      setCartLoaded(true);
    })();
  }, []);

  // ── Sauvegarde automatique du panier à chaque modification (debounce 300ms)
  useEffect(() => {
    if (!cartLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveCart(items);
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [items, cartLoaded]);

  // ── Tentative de sync des économies en attente
  const trySyncPending = useCallback(async () => {
    const amount = await consumePendingSavings();
    if (amount <= 0) { setPendingSync(false); return; }
    try {
      await incrementUserSavings(amount);
      setPendingSync(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Synchronisé !', `${fmt(amount)} d'économies synchronisées avec ton compte.`);
    } catch {
      await addPendingSavings(amount); // remettre en attente
      Alert.alert('Toujours hors ligne', 'Les économies seront synchronisées à la prochaine connexion.');
    }
  }, []);

  // ── Totaux
  const totals = useMemo(() => {
    const totalNormal = items.reduce((s, i) => s + i.normalPrice * i.quantity, 0);
    const totalPaid   = items.reduce((s, i) => s + i.paidPrice   * i.quantity, 0);
    const savings     = totalNormal - totalPaid;
    return { totalNormal, totalPaid, savings };
  }, [items]);

  // ── Ajouter article
  const handleAdd = useCallback(() => {
    const name   = newName.trim();
    const normal = parseFloat(newNormal.replace(',', '.'));
    const paid   = parseFloat(newPaid.replace(',', '.'));

    if (!name) { Alert.alert('Nom manquant', "Saisis le nom de l'article."); return; }
    if (Number.isNaN(normal) || normal <= 0) { Alert.alert('Prix invalide', 'Le prix normal doit être un nombre positif.'); return; }
    const paidFinal = Number.isNaN(paid) || paid < 0 ? normal : paid;
    if (paidFinal > normal) { Alert.alert('Prix incohérent', 'Le prix payé ne peut pas dépasser le prix normal.'); return; }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setItems((prev) => [...prev, { id: genId(), name, quantity: 1, normalPrice: normal, paidPrice: paidFinal }]);
    setNewName(''); setNewNormal(''); setNewPaid('');
    nameRef.current?.focus();
  }, [newName, newNormal, newPaid]);

  // ── Modifier quantité
  const handleChangeQty = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item)
        .filter((item) => item.quantity > 0)
    );
  }, []);

  // ── Supprimer article
  const handleDelete = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // ── Valider les achats
  const handleValidate = useCallback(async () => {
    if (items.length === 0) { Alert.alert('Panier vide', 'Ajoute des articles avant de valider.'); return; }
    if (totals.savings <= 0) {
      Alert.alert('Aucune économie', 'Aucun article ne présente de réduction. Valides-tu quand même ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Valider', onPress: () => void doValidate() },
      ]);
      return;
    }
    await doValidate();
  }, [items, totals]);

  const doValidate = useCallback(async () => {
    setValidating(true);
    try {
      if (totals.savings > 0) {
        await incrementUserSavings(totals.savings);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await clearCart();
      setValidated(true);
      onSavingsValidated?.(totals.savings);
      Alert.alert(
        '🎉 Achats validés !',
        totals.savings > 0
          ? `Tu as économisé ${fmt(totals.savings)} sur ce panier. Bravo, Sentinelle !`
          : 'Tes achats ont bien été enregistrés.',
        [{ text: 'Super !', onPress: onBack }]
      );
    } catch (err) {
      // Mode hors-ligne : on stocke les économies localement
      if (totals.savings > 0) {
        await addPendingSavings(totals.savings);
        setPendingSync(true);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await clearCart();
      setValidated(true);
      onSavingsValidated?.(totals.savings);
      Alert.alert(
        'Hors ligne — Achats sauvegardés',
        `Tes économies (${fmt(totals.savings)}) ont été enregistrées localement et seront synchronisées dès que tu seras en ligne.`,
        [{ text: 'OK', onPress: onBack }]
      );
    } finally {
      setValidating(false);
    }
  }, [totals, onBack, onSavingsValidated]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.root}>

        {/* En-tête */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={Typography.h2}>Mon panier</Text>
          <Text style={[Typography.bodyMd, { color: Colors.textSecondary, fontWeight: '700' }]}>
            {items.length} article{items.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Bandeau synchronisation en attente */}
        {pendingSync && (
          <TouchableOpacity
            style={styles.syncBanner}
            onPress={() => void trySyncPending()}
            activeOpacity={0.8}
          >
            <MaterialIcons name="cloud-off" size={16} color="#92400E" />
            <Text style={styles.syncBannerText}>
              Économies en attente de synchro — Appuie pour réessayer
            </Text>
            <MaterialIcons name="refresh" size={16} color="#92400E" />
          </TouchableOpacity>
        )}

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Formulaire ajout */}
          <View style={[styles.addCard, Shadows.soft]}>
            <Text style={styles.addTitle}>Ajouter un article</Text>

            <TextInput
              ref={nameRef}
              style={styles.inputFull}
              placeholder="Nom du produit (ex: Yaourts Danone x8)"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              returnKeyType="next"
            />

            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Text style={styles.priceLabel}>Prix normal (€)</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="3,49"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  value={newNormal}
                  onChangeText={setNewNormal}
                />
              </View>
              <MaterialIcons name="arrow-forward" size={20} color={Colors.textMuted} style={styles.priceArrow} />
              <View style={[styles.priceField]}>
                <Text style={[styles.priceLabel, { color: Colors.success }]}>Prix payé (€)</Text>
                <TextInput
                  style={[styles.priceInput, { color: Colors.success }]}
                  placeholder="1,99"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  value={newPaid}
                  onChangeText={setNewPaid}
                  returnKeyType="done"
                  onSubmitEditing={handleAdd}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85}>
              <MaterialIcons name="add-shopping-cart" size={18} color={Colors.white} />
              <Text style={styles.addBtnText}>Ajouter au panier</Text>
            </TouchableOpacity>
          </View>

          {/* Liste articles */}
          {!cartLoaded ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
          ) : items.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="shopping-cart" size={48} color={Colors.border} />
              <Text style={styles.emptyText}>Ton panier est vide.{'\n'}Ajoute des articles ci-dessus.</Text>
            </View>
          ) : (
            <View style={[styles.listCard, Shadows.soft]}>
              {items.map((item) => (
                <CartRow key={item.id} item={item} onChangeQty={handleChangeQty} onDelete={handleDelete} />
              ))}
            </View>
          )}

          {/* Récapitulatif & validation */}
          {items.length > 0 && (
            <View style={[styles.summaryCard, Shadows.soft]}>
              <Text style={styles.summaryTitle}>Récapitulatif</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total au prix fort</Text>
                <Text style={styles.summaryValue}>{fmt(totals.totalNormal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total après remises</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>{fmt(totals.totalPaid)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={[styles.summaryRow, styles.savingsHighlight]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MaterialIcons name="savings" size={20} color={Colors.success} />
                  <Text style={styles.savingsLabel}>Économies réalisées</Text>
                </View>
                <Text style={styles.savingsAmount}>{fmt(totals.savings)}</Text>
              </View>

              <TouchableOpacity
                style={[styles.validateBtn, (validating || validated) && styles.validateBtnDisabled]}
                onPress={() => void handleValidate()}
                disabled={validating || validated}
                activeOpacity={0.85}
              >
                {validating ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <>
                    <MaterialIcons name={validated ? 'check-circle' : 'done-all'} size={20} color={Colors.white} />
                    <Text style={styles.validateBtnText}>
                      {validated ? 'Achats validés !' : 'Valider mes achats'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 56,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },

  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  syncBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E' },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  addCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 16,
  },
  addTitle: { ...Typography.labelSm, color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 },
  inputFull: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
    marginBottom: 10, backgroundColor: Colors.background,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  priceField: { flex: 1 },
  priceLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  priceInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 15, fontWeight: '700', color: Colors.textPrimary,
    backgroundColor: Colors.background, textAlign: 'right',
  },
  priceArrow: { marginTop: 14 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, height: 48, borderRadius: Radii.button,
  },
  addBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card, paddingHorizontal: 16, marginBottom: 16,
  },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 22 },

  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: Radii.card, padding: 20, marginBottom: 16,
  },
  summaryTitle: { ...Typography.labelSm, color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { ...Typography.bodyMd, color: Colors.textSecondary },
  summaryValue: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  savingsHighlight: {
    backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, marginBottom: 18, marginHorizontal: -4,
  },
  savingsLabel: { ...Typography.bodyLg, fontWeight: '700', color: Colors.success },
  savingsAmount: { fontSize: 24, fontWeight: '900', color: Colors.success },
  validateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary, height: 52, borderRadius: Radii.button,
  },
  validateBtnDisabled: { opacity: 0.6 },
  validateBtnText: { fontSize: 16, fontWeight: '800', color: Colors.white },
});
