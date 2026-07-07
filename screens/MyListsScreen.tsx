// screens/MyListsScreen.tsx
// 
// RÈGLE DE TRAITEMENT : Fichier intégral et autonome.
// Écran "Mes Listes" de PanierMalin v2.0.
// Gère les listes d'achat actives, archivées et l'importation intelligente par IA.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import { getMyLists, createShoppingList } from '../services/api';
import { ShoppingList } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ActiveList {
  id: string;
  name: string;
  itemCount: number;
  estimatedTotal: string;
  progress: number;
  collaboratorAvatars?: string[];
  extraCollaborators?: number;
  isPrivate?: boolean;
  doneCount: number;
}

function mapShoppingListToActiveList(list: ShoppingList): ActiveList {
  const realAvatars = list.collaboratorAvatars ?? [];
  const displayedAvatars = realAvatars.slice(0, 2);
  const extraCount = realAvatars.length > 2 ? realAvatars.length - 2 : undefined;

  return {
    id: list.id,
    name: list.name,
    itemCount: list.itemCount,
    doneCount: list.doneCount,
    estimatedTotal: `${list.estimatedTotal.toFixed(2).replace('.', ',')} €`,
    progress: list.itemCount > 0 ? list.doneCount / list.itemCount : 0,
    isPrivate: !list.isShared,
    collaboratorAvatars: list.isShared ? displayedAvatars : undefined,
    extraCollaborators: list.isShared ? extraCount : undefined,
  };
}

interface ArchivedList {
  id: string;
  name: string;
  itemCount: number;
  finishedDate: string;
}

const ARCHIVED_LISTS: ArchivedList[] = [
  { id: 'a1', name: 'BBQ Été 2025', itemCount: 24, finishedDate: '12/08' },
  { id: 'a2', name: 'Recettes Noël', itemCount: 15, finishedDate: '24/12' },
];

interface Props {
  onNavigate: (tab: TabKey) => void;
  onSelectList: (id: string, name: string) => void;
}

export default function MyListsScreen({ onNavigate, onSelectList }: Props) {
  const { session } = useAuth();
  const [importModalVisible, setImportModalVisible] = useState<boolean>(false);
  const [newListModalVisible, setNewListModalVisible] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeLists, setActiveLists] = useState<ActiveList[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchLists = () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getMyLists()
      .then((lists) => setActiveLists(lists.map(mapShoppingListToActiveList)))
      .catch((err) => console.error('[MyListsScreen] getMyLists failed', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLists();
  }, [session]);

  const handleCreateList = async () => {
    if (!newListName.trim() || submitting) return;
    
    try {
      setSubmitting(true);
      await createShoppingList(newListName.trim());
      setNewListName('');
      setNewListModalVisible(false);
      fetchLists();
    } catch (err) {
      console.error('[MyListsScreen] createShoppingList failed', err);
      Alert.alert('Erreur', 'Impossible de créer la liste pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportAction = (type: 'camera' | 'link' | 'chat') => {
    setImportModalVisible(false);
    switch (type) {
      case 'camera':
        console.log('Action déclenchée : Import Caméra / Photo');
        break;
      case 'link':
        console.log('Action déclenchée : Import via Lien URL');
        break;
      case 'chat':
        console.log('Action déclenchée : Import par Description textuelle');
        break;
    }
  };

  const filteredLists = activeLists.filter(list => 
    list.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.root}>
      {/* En-tête principal */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }}
            style={styles.profileAvatar}
          />
          <Text style={[Typography.h1, { color: Colors.primary }]}>Mes Listes</Text>
        </View>
        <TouchableOpacity style={styles.notifButton} activeOpacity={0.7}>
          <MaterialIcons name="notifications" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Barre de recherche locale et bouton de création */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={Colors.textSecondary} />
            <TextInput 
              placeholder="Rechercher une liste..." 
              style={styles.searchInput} 
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity style={styles.newButton} onPress={() => setNewListModalVisible(true)} activeOpacity={0.85}>
            <MaterialIcons name="add" size={18} color={Colors.white} />
            <Text style={styles.newButtonText}>Créer</Text>
          </TouchableOpacity>
        </View>

        {/* Module d'importation magique par IA */}
        <TouchableOpacity style={[styles.importButton, Shadows.soft]} onPress={() => setImportModalVisible(true)} activeOpacity={0.8}>
          <MaterialIcons name="auto-awesome" size={20} color={Colors.primary} />
          <Text style={styles.importButtonText}>Scanner un ticket ou une recette IA</Text>
        </TouchableOpacity>

        {/* Section Listes Actives */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[Typography.bodyLg, { fontWeight: '700', color: Colors.textPrimary }]}>Listes en cours</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {filteredLists.length} active{filteredLists.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.listsGridContainer}>
            {filteredLists.map((list) => (
              <TouchableOpacity 
                key={list.id} 
                style={styles.listCard} 
                activeOpacity={0.85}
                onPress={() => onSelectList(list.id, list.name)}
              >
                <View style={styles.listCardTopRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.listNameText} numberOfLines={1}>{list.name}</Text>
                    <View style={styles.listMetaRow}>
                      <Text style={Typography.caption}>{list.itemCount} articles</Text>
                      <View style={styles.dotSeparator} />
                      <Text style={styles.estimatedTotalText}>
                        Est. {list.estimatedTotal}
                      </Text>
                    </View>
                  </View>
                  
                  {list.isPrivate ? (
                    <MaterialIcons name="lock" size={18} color={Colors.textSecondary} style={{ marginTop: 2 }} />
                  ) : (
                    <View style={styles.avatarStack}>
                      {list.collaboratorAvatars?.map((uri, i) => (
                        <Image key={i} source={{ uri }} style={[styles.collabAvatar, { marginLeft: i > 0 ? -8 : 0 }]} />
                      ))}
                      {list.extraCollaborators && (
                        <View style={[styles.extraAvatarBadge, { marginLeft: -8 }]}>
                          <Text style={styles.extraCollaboratorsText}>
                            +{list.extraCollaborators}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.listProgressRow}>
                  <Text style={styles.progressLabel}>Progression</Text>
                  <Text style={styles.progressCount}>
                    {list.doneCount}/{list.itemCount}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${list.progress * 100}%` }]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Section Listes Archivées */}
        <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
          <Text style={[Typography.bodyLg, { fontWeight: '700', color: Colors.textPrimary }]}>Historique de paniers</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.seeAllText}>Tout voir</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.listsGridContainer}>
          {ARCHIVED_LISTS.map((list) => (
            <View key={list.id} style={styles.archivedCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.archivedNameText} numberOfLines={1}>{list.name}</Text>
                <Text style={Typography.caption}>{list.itemCount} articles · Clôturée le {list.finishedDate}</Text>
              </View>
              <TouchableOpacity style={styles.replayButton} activeOpacity={0.7}>
                <MaterialIcons name="replay" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomNav active="lists" onNavigate={onNavigate} />

      {/* Pop-up : Création d'une nouvelle liste */}
      <Modal visible={newListModalVisible} transparent animationType="fade" onRequestClose={() => !submitting && setNewListModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => !submitting && setNewListModalVisible(false)} />
        <View style={styles.centeredModalContent}>
          <Text style={[styles.modalTitle, { marginBottom: 16 }]}>Nouvelle liste</Text>
          <TextInput
            placeholder="Nom de la liste (ex: Courses de la semaine)"
            style={styles.modalInput}
            placeholderTextColor={Colors.textSecondary}
            value={newListName}
            onChangeText={setNewListName}
            editable={!submitting}
            autoFocus
          />
          <View style={styles.modalButtonRow}>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#F1F5F9' }]} onPress={() => setNewListModalVisible(false)} disabled={submitting}>
              <Text style={[Typography.bodyMd, { color: Colors.textPrimary, fontWeight: '600' }]}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: Colors.primary }]} onPress={handleCreateList} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={[Typography.bodyMd, { color: Colors.white, fontWeight: '600' }]}>Créer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Tiroir d'Import Intelligent (Bottom Sheet) */}
      <Modal visible={importModalVisible} transparent animationType="slide" onRequestClose={() => setImportModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setImportModalVisible(false)} />
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Assistant d'importation IA</Text>
            <Text style={styles.sheetSubtitle}>
              Notre IA extrait instantanément vos ingrédients et trouve les magasins les moins chers aux alentours.
            </Text>
          </View>

          {[
            { icon: 'photo-camera' as const, title: 'Prendre un ticket ou une liste en photo', subtitle: 'Analyse et numérisation instantanée', type: 'camera' as const },
            { icon: 'link' as const, title: 'Importer depuis un lien de recette', subtitle: 'Coller une URL Marmiton, 750g, Chefclub...', type: 'link' as const },
            { icon: 'chat-bubble' as const, title: 'Saisir ou dicter un repas complet', subtitle: 'Ex : "Ingrédients pour des lasagnes de boeuf pour 6"', type: 'chat' as const },
          ].map((option) => (
            <TouchableOpacity key={option.title} style={styles.importOption} activeOpacity={0.75} onPress={() => handleImportAction(option.type)}>
              <View style={styles.importOptionIcon}>
                <MaterialIcons name={option.icon} size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.cancelButton} onPress={() => setImportModalVisible(false)} activeOpacity={0.7}>
            <Text style={[Typography.bodyMd, { color: Colors.textSecondary, fontWeight: '600' }]}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
    height: 60,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.border },
  notifButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120 },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: Radii.card,
  },
  newButtonText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radii.card,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.15)',
  },
  importButtonText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAllText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  countBadge: { backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  listsGridContainer: { gap: 10 },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  listNameText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  listMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  dotSeparator: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textSecondary, opacity: 0.4 },
  estimatedTotalText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  collabAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: Colors.surface, backgroundColor: Colors.border },
  extraAvatarBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  extraCollaboratorsText: { fontSize: 10, fontWeight: '700', color: Colors.secondary },
  listProgressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  progressCount: { fontSize: 12, color: Colors.textPrimary, fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  archivedCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  archivedNameText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  replayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  centeredModalContent: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 24,
    marginTop: '45%',
    ...Shadows.soft,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  modalInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.card,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  modalButtonRow: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, height: 44, borderRadius: Radii.card, alignItems: 'center', justifyContent: 'center' },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    ...Shadows.active,
  },
  sheetHandle: { width: 40, height: 5, borderRadius: 2.5, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  sheetSubtitle: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18, fontWeight: '500' },
  importOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  importOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  optionSubtitle: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500', marginTop: 1 },
  cancelButton: { alignItems: 'center', paddingTop: 14, marginTop: 4 },
});