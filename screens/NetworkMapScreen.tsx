// screens/NetworkMapScreen.tsx
// 
// RÈGLE DE TRAITEMENT : Fichier intégral et autonome.
// Écran "Le Réseau" de PanierMalin v2.0.
// Affiche la carte des enseignes partenaires synchronisées en direct.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  onNavigate: (tab: TabKey) => void;
  onSelectStore?: (storeId: string) => void;
}

interface PartnerStore {
  id: string;
  name: string;
  type: string;
  city: string;
  status: 'live' | 'syncing';
  activePromos: number;
  distance: string;
}

export default function NetworkMapScreen({ onNavigate, onSelectStore }: Props) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState<string>('');

  const partners: PartnerStore[] = [
    { id: '1', name: 'Lidl', type: 'Supermarché', city: 'Puilboreau', status: 'live', activePromos: 42, distance: '1.2 km' },
    { id: '2', name: 'E.Leclerc', type: 'Hypermarché', city: 'Lagord', status: 'live', activePromos: 118, distance: '3.4 km' },
    { id: '3', name: 'Carrefour Market', type: 'Supermarché', city: 'La Rochelle', status: 'live', activePromos: 65, distance: '2.1 km' },
    { id: '4', name: 'Auchan Supermarché', type: 'Supermarché', city: 'Perigny', status: 'syncing', activePromos: 14, distance: '4.8 km' },
  ];

  const filteredPartners = partners.filter(store => 
    store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.root}>
      {/* En-tête principal */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="map" size={24} color={Colors.primary} />
          <Text style={[Typography.h1, { color: Colors.textPrimary }]}>Le Réseau</Text>
        </View>
        <View style={styles.liveCounterBadge}>
          <Text style={styles.liveCounterText}>3/4 LIVE</Text>
        </View>
      </View>

      {/* Barre de recherche locale des magasins */}
      <View style={styles.searchWrapper}>
        <View style={[styles.searchBarContainer, Shadows.soft]}>
          <MaterialIcons name="search" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchTextInput}
            placeholder="Rechercher une enseigne ou une ville..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Simulation Visuelle de la Carte Interactive */}
      <View style={styles.mapVisualContainer}>
        <View style={styles.mapPlaceholder}>
          <MaterialIcons name="explore" size={40} color={Colors.primary} style={styles.mapCenterIcon} />
          <Text style={styles.mapPlaceholderText}>Carte de France Interactive</Text>
          <Text style={styles.mapSubPlaceholderText}>Consultation des prix IA en direct</Text>
          
          {/* Épingles fictives sur la carte */}
          <View style={[styles.mapPin, { top: '35%', left: '45%' }]}>
            <MaterialIcons name="place" size={24} color={Colors.primary} />
          </View>
          <View style={[styles.mapPin, { top: '55%', left: '38%' }]}>
            <MaterialIcons name="place" size={24} color={Colors.secondary} />
          </View>
          <View style={[styles.mapPin, { top: '42%', left: '60%' }]}>
            <MaterialIcons name="place" size={24} color={Colors.tertiary} />
          </View>
        </View>
      </View>

      {/* Liste des enseignes connectées */}
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.bodyLg, { fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 }]}>
          Enseignes à proximité
        </Text>

        <View style={styles.storesContainer}>
          {filteredPartners.map((store) => (
            <TouchableOpacity 
              key={store.id} 
              style={styles.storeCard}
              activeOpacity={0.7}
              onPress={() => onSelectStore && onSelectStore(store.id)}
            >
              <View style={styles.storeHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storeNameText}>{store.name}</Text>
                  <Text style={styles.storeMetaText}>{store.type} · {store.city} ({store.distance})</Text>
                </View>
                
                {store.status === 'live' ? (
                  <View style={styles.statusLiveBadge}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.statusLiveText}>DIRECT AI</Text>
                  </View>
                ) : (
                  <View style={styles.statusSyncBadge}>
                    <Text style={styles.statusSyncText}>SYNCHRO</Text>
                  </View>
                )}
              </View>

              <View style={styles.storeFooterRow}>
                <MaterialIcons name="local-fire-department" size={16} color="#FF4D4D" />
                <Text style={styles.promoCountText}>{store.activePromos} promotions détectées</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* On utilise "scanner" ou un onglet dédié de ton BottomNav selon tes liaisons */}
      <BottomNav active="search" onNavigate={onNavigate} />
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
    minHeight: 56,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveCounterBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  liveCounterText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  searchWrapper: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, backgroundColor: Colors.surface },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.button,
    height: 46,
    paddingHorizontal: 12,
  },
  searchTextInput: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '500' },
  mapVisualContainer: { height: 200, backgroundColor: '#E2E8F0', position: 'relative' },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  mapCenterIcon: { opacity: 0.15, marginBottom: 4 },
  mapPlaceholderText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  mapSubPlaceholderText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
  mapPin: { position: 'absolute' },
  scrollBody: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 },
  storesContainer: { gap: 10 },
  storeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storeNameText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  storeMetaText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
  statusLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E6F9ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  statusLiveText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  statusSyncBadge: { backgroundColor: '#FFF7E6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusSyncText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  storeFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 12 },
  promoCountText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
});