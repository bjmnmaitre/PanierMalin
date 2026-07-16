import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radii, typography } from '@/design';
import { Card, Button, Input, Badge, Avatar } from '@/components/primitives';
import { SearchBar, GamificationBanner } from '@/components/features';
import ModernBottomNav, { type TabKey } from '@/components/features/ModernBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useCart } from '@/contexts/CartContext';
import { getMyLists, getArchivedLists, createShoppingList, deleteShoppingList } from '@/services/api';
import type { ShoppingList } from '@/types';
import { formatPrice, formatDate } from '@/utils/formatters';
import {
  type HabitList,
  type HabitOptimResult,
  loadHabitLists,
  createHabitList,
  deleteHabitList,
  touchLastUsed,
  cartItemsToHabitItems,
  estimateHabitListOptim,
} from '@/services/habitListService';

export interface MyListsScreenProps {
  /** Navigation vers un autre onglet (barre de navigation) */
  onNavigate: (tab: TabKey) => void;
  /** Ouvre le détail d'une liste (screens/ListDetailScreen.tsx) */
  onSelectList: (id: string, name: string) => void;
}

export default function MyListsScreen({ onNavigate, onSelectList }: MyListsScreenProps) {
  const insets = useSafeAreaInsets();
  const { session, profile, isLoading: isProfileLoading } = useAuth();
  const cart = useCart();

  const [searchQuery, setSearchQuery] = useState('');
  const [newListModalVisible, setNewListModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Listes d'Habitudes ──────────────────────────────────────────────────────
  const [habitLists, setHabitLists]         = useState<HabitList[]>([]);
  const [habitOptims, setHabitOptims]       = useState<Record<string, HabitOptimResult>>({});
  const [habitLoading, setHabitLoading]     = useState(true);
  const [loadingCartId, setLoadingCartId]   = useState<string | null>(null);
  const [habitModal, setHabitModal]         = useState(false);
  const [habitTitle, setHabitTitle]         = useState('');
  const [habitEmoji, setHabitEmoji]         = useState('🛒');
  const [habitFromCart, setHabitFromCart]   = useState(false);
  const [habitSubmitting, setHabitSubmitting] = useState(false);

  const EMOJIS = ['🛒', '☕', '🥂', '🍕', '🌿', '🎉', '🥗', '🏠'] as const;

  const {
    data: activeLists,
    isLoading: isActiveLoading,
    execute: refetchActiveLists,
  } = useAsync<ShoppingList[]>(getMyLists, false);

  const {
    data: archivedLists,
    isLoading: isArchivedLoading,
    execute: refetchArchivedLists,
  } = useAsync<ShoppingList[]>(getArchivedLists, false);

  useEffect(() => {
    if (session) {
      refetchActiveLists();
      refetchArchivedLists();
    }
  }, [session]);

  useEffect(() => {
    loadHabitLists()
      .then((lists) => {
        setHabitLists(lists);
        const optims: Record<string, HabitOptimResult> = {};
        for (const list of lists) {
          if (list.items.length > 0) optims[list.id] = estimateHabitListOptim(list);
        }
        setHabitOptims(optims);
      })
      .finally(() => setHabitLoading(false));
  }, []);

  const filteredActiveLists = useMemo(() => {
    const lists = activeLists ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return lists;
    return lists.filter((list) => list.name.toLowerCase().includes(query));
  }, [activeLists, searchQuery]);

  const handleCreateList = async () => {
    if (!newListName.trim() || submitting) return;
    try {
      setSubmitting(true);
      await createShoppingList(newListName.trim());
      setNewListName('');
      setNewListModalVisible(false);
      refetchActiveLists();
    } catch (error) {
      console.error('[MyListsScreen] createShoppingList a échoué', error);
      Alert.alert('Erreur', 'Impossible de créer la liste pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteList = (list: ShoppingList) => {
    Alert.alert(
      'Supprimer la liste ?',
      `"${list.name}" sera définitivement supprimée.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(list.id);
              await deleteShoppingList(list.id);
              refetchActiveLists();
            } catch (err) {
              console.error('[MyListsScreen] deleteShoppingList a échoué', err);
              Alert.alert('Erreur', 'Impossible de supprimer cette liste.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCloseModal = () => {
    if (!submitting) {
      setNewListModalVisible(false);
    }
  };

  // ── Handlers Listes d'Habitudes ─────────────────────────────────────────────

  const handleLoadToCart = useCallback(async (list: HabitList) => {
    if (loadingCartId) return;
    setLoadingCartId(list.id);
    try {
      for (const item of list.items) {
        for (let i = 0; i < item.quantity; i++) {
          cart.addItem(item.name);
        }
      }
      await touchLastUsed(list.id);
      setHabitLists((prev) => prev.map((l) => l.id === list.id ? { ...l, lastUsed: new Date().toISOString() } : l));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Chargé !', `${list.items.length} article${list.items.length > 1 ? 's' : ''} ajouté${list.items.length > 1 ? 's' : ''} au panier.`);
    } finally {
      setLoadingCartId(null);
    }
  }, [cart, loadingCartId]);

  const handleDeleteHabit = useCallback((list: HabitList) => {
    Alert.alert(
      'Supprimer la liste d\'habitude ?',
      `"${list.title}" sera supprimée.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            await deleteHabitList(list.id);
            setHabitLists((prev) => prev.filter((l) => l.id !== list.id));
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ],
    );
  }, []);

  const handleCreateHabit = useCallback(async () => {
    if (!habitTitle.trim() || habitSubmitting) return;
    setHabitSubmitting(true);
    try {
      const items = habitFromCart && cart.items.length > 0
        ? cartItemsToHabitItems(cart.items)
        : [];
      const newList = await createHabitList({ title: habitTitle.trim(), emoji: habitEmoji, items });
      setHabitLists((prev) => [...prev, newList]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHabitModal(false);
      setHabitTitle(''); setHabitEmoji('🛒'); setHabitFromCart(false);
    } finally {
      setHabitSubmitting(false);
    }
  }, [habitTitle, habitEmoji, habitFromCart, habitSubmitting, cart.items]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + spacing[4] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Avatar
            size="md"
            name={profile?.displayName}
            source={profile?.avatarUrl ? { uri: profile.avatarUrl } : undefined}
          />
          <Text style={styles.headerTitle}>Mes listes</Text>
        </View>

        <GamificationBanner
          sentinelLevel={profile?.sentinelLevel}
          totalPoints={profile?.totalPoints}
          loading={isProfileLoading}
        />

        {/* ── Listes d'Habitudes ─────────────────────────────── */}
        <View style={styles.habitSection}>
          <View style={styles.habitHeaderRow}>
            <Text style={styles.habitSectionTitle}>🔁 Mes Habitudes</Text>
            <TouchableOpacity
              style={styles.habitAddBtn}
              onPress={() => setHabitModal(true)}
              hitSlop={8}
            >
              <MaterialIcons name="add" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {habitLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing[3] }} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.habitScroll}
            >
              {habitLists.map((list) => {
                const isLoading = loadingCartId === list.id;
                return (
                  <Pressable
                    key={list.id}
                    style={styles.habitCard}
                    onLongPress={() => handleDeleteHabit(list)}
                  >
                    <Text style={styles.habitEmoji}>{list.emoji}</Text>
                    <Text style={styles.habitTitle} numberOfLines={1}>{list.title}</Text>
                    <Text style={styles.habitMeta}>
                      {list.items.length} article{list.items.length > 1 ? 's' : ''}
                    </Text>
                    {habitOptims[list.id] && (
                      <View style={styles.optimBadge}>
                        <MaterialIcons name="local-offer" size={9} color="#1D9E75" />
                        <Text style={styles.optimBadgeTxt}>
                          {habitOptims[list.id].bestStore} · {habitOptims[list.id].totalCost.toFixed(2)} €
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.habitLoadBtn, isLoading && styles.habitLoadBtnLoading]}
                      onPress={() => { void handleLoadToCart(list); }}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <MaterialIcons name="shopping-cart" size={14} color="#FFFFFF" />
                          <Text style={styles.habitLoadTxt}>Charger</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </Pressable>
                );
              })}

              {/* Carte "Créer" */}
              <TouchableOpacity style={styles.habitCardAdd} onPress={() => setHabitModal(true)}>
                <MaterialIcons name="add-circle-outline" size={28} color="#CBD5E1" />
                <Text style={styles.habitCardAddTxt}>Nouvelle{'\n'}liste</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBarFlex}>
            <SearchBar placeholder="Rechercher une liste…" value={searchQuery} onChangeText={setSearchQuery} />
          </View>
          <Button label="Créer" icon="add" size="md" onPress={() => setNewListModalVisible(true)} />
        </View>

        <View style={styles.aiTeaserCard}>
          <View style={styles.aiTeaserIconContainer}>
            <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
          </View>
          <View style={styles.aiTeaserTextBlock}>
            <Text style={styles.aiTeaserTitle}>Importer une liste par IA</Text>
            <Text style={styles.aiTeaserSubtitle}>Ticket de caisse, recette ou simple description — bientôt disponible.</Text>
          </View>
          <Badge label="Bientôt" variant="secondary" size="sm" />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Listes en cours</Text>
          <Badge
            label={`${filteredActiveLists.length} active${filteredActiveLists.length > 1 ? 's' : ''}`}
            variant="info"
            size="sm"
          />
        </View>

        {isActiveLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
        ) : filteredActiveLists.length === 0 ? (
          <Text style={styles.emptyText}>
            {searchQuery ? 'Aucune liste ne correspond à ta recherche.' : "Aucune liste active pour l'instant — crée la première !"}
          </Text>
        ) : (
          <View style={styles.listsContainer}>
            {filteredActiveLists.map((list) => {
              const progress = list.itemCount > 0 ? list.doneCount / list.itemCount : 0;
              const extraCollaborators = (list.collaboratorAvatars?.length ?? 0) - 2;

              const isDeleting = deletingId === list.id;
              return (
                <Pressable
                  key={list.id}
                  onPress={() => !isDeleting && onSelectList(list.id, list.name)}
                  onLongPress={() => !isDeleting && handleDeleteList(list)}
                >
                  <Card
                    padding="md"
                    shadow="sm"
                    style={isDeleting ? { ...styles.listCard, ...styles.listCardDeleting } : styles.listCard}
                  >
                    {isDeleting && (
                      <ActivityIndicator
                        color={colors.error}
                        size="small"
                        style={styles.deletingIndicator}
                      />
                    )}
                    <View style={styles.listCardTopRow}>
                      <View style={styles.listCardInfo}>
                        <Text style={isDeleting ? [styles.listName, styles.listNameDeleting] : styles.listName} numberOfLines={1}>
                          {list.name}
                        </Text>
                        <View style={styles.listMetaRow}>
                          <Text style={styles.listMetaText}>
                            {list.itemCount} article{list.itemCount > 1 ? 's' : ''}
                          </Text>
                          <View style={styles.dotSeparator} />
                          <Text style={styles.listMetaTotal}>Est. {formatPrice(list.estimatedTotal)}</Text>
                        </View>
                      </View>

                      {list.isShared && list.collaboratorAvatars && list.collaboratorAvatars.length > 0 ? (
                        <View style={styles.avatarStack}>
                          {list.collaboratorAvatars.slice(0, 2).map((uri, index) => (
                            <View key={uri + index} style={[styles.avatarStackItem, index > 0 && styles.avatarStackItemOverlap]}>
                              <Avatar size="xs" source={{ uri }} />
                            </View>
                          ))}
                          {extraCollaborators > 0 && (
                            <View style={[styles.avatarStackItem, styles.avatarStackItemOverlap]}>
                              <Badge label={`+${extraCollaborators}`} variant="secondary" size="sm" />
                            </View>
                          )}
                        </View>
                      ) : (
                        <MaterialIcons name="lock-outline" size={18} color={colors.text.tertiary} />
                      )}
                    </View>

                    <View style={styles.progressRow}>
                      <Text style={styles.progressLabel}>Progression</Text>
                      <Text style={styles.progressCount}>
                        {list.doneCount}/{list.itemCount}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={[styles.sectionHeaderRow, styles.sectionHeaderRowSpaced]}>
          <Text style={styles.sectionTitle}>Historique de listes</Text>
        </View>

        {isArchivedLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
        ) : !archivedLists || archivedLists.length === 0 ? (
          <Text style={styles.emptyText}>Aucune liste clôturée pour l'instant.</Text>
        ) : (
          <View style={styles.listsContainer}>
            {archivedLists.map((list) => (
              <Card key={list.id} padding="md" shadow="none" style={styles.archivedCard}>
                <View style={styles.archivedCardInfo}>
                  <Text style={styles.archivedName} numberOfLines={1}>
                    {list.name}
                  </Text>
                  <Text style={styles.archivedMeta}>
                    {list.itemCount} article{list.itemCount > 1 ? 's' : ''}
                    {list.createdAt ? ` · Créée le ${formatDate(list.createdAt)}` : ''}
                  </Text>
                </View>
                <MaterialIcons name="history" size={20} color={colors.text.tertiary} />
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <ModernBottomNav active="lists" onNavigate={onNavigate} />

      {/* ── Modal Création d'Habitude ──────────────────────────── */}
      <Modal visible={habitModal} transparent animationType="slide" onRequestClose={() => setHabitModal(false)}>
        <View style={styles.habitModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !habitSubmitting && setHabitModal(false)} />
          <View style={styles.habitModalContent}>
            <View style={styles.habitModalHandle} />
            <Text style={styles.modalTitle}>Nouvelle liste d'habitude</Text>

            {/* Sélecteur emoji */}
            <View style={styles.emojiRow}>
              {EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, habitEmoji === e && styles.emojiBtnActive]}
                  onPress={() => { setHabitEmoji(e); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={styles.emojiTxt}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              placeholder="Nom de la liste *"
              value={habitTitle}
              onChangeText={setHabitTitle}
              disabled={habitSubmitting}
            />

            {cart.items.length > 0 && (
              <TouchableOpacity
                style={styles.fromCartRow}
                onPress={() => { setHabitFromCart(!habitFromCart); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                activeOpacity={0.85}
              >
                <View style={[styles.fromCartCheck, habitFromCart && styles.fromCartCheckActive]}>
                  {habitFromCart && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.fromCartTxt}>
                  Importer mon panier actuel ({cart.items.length} article{cart.items.length > 1 ? 's' : ''})
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalButtonRow}>
              <View style={styles.modalButtonFlex}>
                <Button label="Annuler" variant="outline" onPress={() => setHabitModal(false)} disabled={habitSubmitting} fullWidth />
              </View>
              <View style={styles.modalButtonFlex}>
                <Button label="Créer" variant="primary" onPress={handleCreateHabit} loading={habitSubmitting} fullWidth />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={newListModalVisible} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseModal} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvelle liste</Text>
            <Input
              placeholder="Ex : Courses de la semaine"
              value={newListName}
              onChangeText={setNewListName}
              disabled={submitting}
            />
            <View style={styles.modalButtonRow}>
              <View style={styles.modalButtonFlex}>
                <Button label="Annuler" variant="outline" onPress={handleCloseModal} disabled={submitting} fullWidth />
              </View>
              <View style={styles.modalButtonFlex}>
                <Button label="Créer" variant="primary" onPress={handleCreateList} loading={submitting} fullWidth />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  headerTitle: {
    ...typography.h1,
    color: colors.text.primary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  searchBarFlex: {
    flex: 1,
  },
  aiTeaserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.primary_light,
    borderRadius: radii.xl,
    padding: spacing[3],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  aiTeaserIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiTeaserTextBlock: {
    flex: 1,
  },
  aiTeaserTitle: {
    ...typography.labelLarge,
    color: colors.text.primary,
  },
  aiTeaserSubtitle: {
    ...typography.captionLarge,
    color: colors.text.secondary,
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  sectionHeaderRowSpaced: {
    marginTop: spacing[2],
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  loadingIndicator: {
    marginVertical: spacing[6],
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing[5],
  },
  listsContainer: {
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  listCard: {
    width: '100%',
  },
  listCardDeleting: {
    opacity: 0.5,
  },
  deletingIndicator: {
    alignSelf: 'flex-end',
    marginBottom: spacing[1],
  },
  listNameDeleting: {
    color: colors.text.tertiary,
  },
  listCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  listCardInfo: {
    flex: 1,
    paddingRight: spacing[2],
  },
  listName: {
    ...typography.labelLarge,
    color: colors.text.primary,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: 3,
  },
  listMetaText: {
    ...typography.captionLarge,
    color: colors.text.secondary,
  },
  listMetaTotal: {
    ...typography.captionLarge,
    color: colors.primary,
    fontWeight: '700',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.tertiary,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStackItem: {
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: radii.full,
  },
  avatarStackItemOverlap: {
    marginLeft: -8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  progressLabel: {
    ...typography.captionLarge,
    color: colors.text.secondary,
  },
  progressCount: {
    ...typography.captionLarge,
    color: colors.text.primary,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  archivedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  archivedCardInfo: {
    flex: 1,
    paddingRight: spacing[2],
  },
  archivedName: {
    ...typography.labelMedium,
    color: colors.text.secondary,
  },
  archivedMeta: {
    ...typography.captionLarge,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  // ── Listes d'Habitudes ────────────────────────────────────────────────────
  habitSection: { marginBottom: spacing[4] },
  habitHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing[3],
  },
  habitSectionTitle: { ...typography.h3, color: colors.text.primary },
  habitAddBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary_light,
    alignItems: 'center', justifyContent: 'center',
  },
  habitScroll: { gap: spacing[3], paddingRight: spacing[4] },
  habitCard: {
    width: 150, borderRadius: radii.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: colors.border.light,
    padding: spacing[4], gap: spacing[2],
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  habitEmoji: { fontSize: 28 },
  habitTitle: { ...typography.labelLarge, color: colors.text.primary },
  habitMeta:  { ...typography.captionLarge, color: colors.text.secondary },
  habitLoadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], backgroundColor: colors.primary,
    borderRadius: radii.md, height: 34, marginTop: spacing[1],
  },
  habitLoadBtnLoading: { opacity: 0.7 },
  habitLoadTxt: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  habitCardAdd: {
    width: 100, borderRadius: radii.xl,
    borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    gap: spacing[1], padding: spacing[4],
  },
  habitCardAddTxt: {
    ...typography.captionLarge, color: '#94A3B8', textAlign: 'center',
  },

  // ── Modal Habitude ─────────────────────────────────────────────────────────
  habitModalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'],
    padding: spacing[5], gap: spacing[4],
  },
  habitModalHandle: {
    width: 36, height: 4, backgroundColor: '#CBD5E1',
    borderRadius: 2, alignSelf: 'center', marginBottom: spacing[2],
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  emojiBtn: {
    width: 42, height: 42, borderRadius: radii.lg,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },
  emojiBtnActive: { backgroundColor: colors.primary_light, borderWidth: 2, borderColor: colors.primary },
  emojiTxt: { fontSize: 20 },
  fromCartRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: '#F8FAFC', borderRadius: radii.lg,
    padding: spacing[3],
  },
  fromCartCheck: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  fromCartCheckActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  fromCartTxt: { ...typography.bodyMedium, color: colors.text.primary, flex: 1 },

  habitModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
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
    borderRadius: radii['2xl'],
    padding: spacing[5],
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  modalButtonFlex: {
    flex: 1,
  },

  optimBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ECFDF5', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start',
  },
  optimBadgeTxt: { fontSize: 8, fontWeight: '700', color: '#059669' },
});
