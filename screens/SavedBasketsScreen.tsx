// screens/SavedBasketsScreen.tsx
// 
// RÈGLE DE TRAITEMENT : Fichier intégral et autonome.
// Ce composant se connecte proprement au service d'API Supabase
// tout en assurant la fluidité visuelle de l'analyse intelligente.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import { getSavedBaskets } from '../services/api';
import { SavedBasketData } from '../types';

type OptimizeStatus = 'idle' | 'loading' | 'done';

const ICON_STYLE: Record<string, { bg: string; color: string }> = {
  'shopping-basket': { bg: Colors.primaryLight, color: Colors.primary },
  celebration: { bg: Colors.secondaryLight, color: Colors.secondary },
  'bakery-dining': { bg: Colors.tertiaryLight, color: Colors.tertiary },
};
const DEFAULT_ICON_STYLE = { bg: Colors.primaryLight, color: Colors.primary };

interface Props {
  onNavigate: (tab: TabKey) => void;
  onEditBasket: (basketId: string) => void;
  onOptimize: (basketId: string) => void;
  onCreateBasket: () => void;
}

export default function SavedBasketsScreen({ 
  onNavigate, 
  onEditBasket, 
  onOptimize, 
  onCreateBasket 
}: Props) {
  const [baskets, setBaskets] = useState<SavedBasketData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statuses, setStatuses] = useState<Record<string, OptimizeStatus>>({});

  useEffect(() => {
    let isMounted = true;
    getSavedBaskets()
      .then((data) => {
        if (isMounted) setBaskets(data);
      })
      .catch((err) => console.error('[SavedBasketsScreen] getSavedBaskets failed', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const handleOptimizePress = (basketId: string) => {
    setStatuses((prev) => ({ ...prev, [basketId]: 'loading' }));

    // Simulation de l'appel d'optimisation
    setTimeout(() => {
      setStatuses((prev) => ({ ...prev, [basketId]: 'done' }));
      onOptimize(basketId);
      
      setTimeout(() => {
        setStatuses((prev) => ({ ...prev, [basketId]: 'idle' }));
      }, 2000);
    }, 1200);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={[Typography.h1, { color: Colors.textPrimary }]}>Mes paniers habituels</Text>
          <TouchableOpacity style={styles.notifButton} activeOpacity={0.7}>
            <MaterialIcons name="notifications-none" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={[Typography.bodyMd, { color: Colors.textSecondary, marginTop: 4 }]}>
          Sélectionne et lance l'optimisation en un tap
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 40 }} />
        ) : (
          baskets.map((basket: SavedBasketData) => {
            const status = statuses[basket.id] ?? 'idle';
            const iconStyle = ICON_STYLE[basket.icon] ?? DEFAULT_ICON_STYLE;
            
            // Sécurisation stricte du nom de l'icône pour l'affichage
            const iconName = (basket.icon && basket.icon in MaterialIcons.glyphMap
              ? basket.icon
              : 'shopping-basket') as keyof typeof MaterialIcons.glyphMap;

            return (
              <View key={basket.id} style={styles.basketCard}>
                <View style={styles.basketTopRow}>
                  <View style={styles.basketInfoRow}>
                    <View style={[styles.iconBox, { backgroundColor: iconStyle.bg }]}>
                      <MaterialIcons 
                        name={iconName} 
                        size={24} 
                        color={iconStyle.color} 
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.bodyLg, { fontWeight: '600', color: Colors.textPrimary }]}>
                        {basket.name}
                      </Text>
                      <View style={styles.itemCountRow}>
                        <MaterialIcons name="format-list-bulleted" size={14} color={Colors.textSecondary} />
                        <Text style={[Typography.caption, { color: Colors.textSecondary }]}>
                          {basket.itemCount} articles
                        </Text>
                        {basket.isShared && (
                          <>
                            <Text style={{ color: Colors.border, marginHorizontal: 2 }}>•</Text>
                            <MaterialIcons name="group" size={14} color={Colors.tertiary} />
                            <Text style={[Typography.caption, { color: Colors.tertiary, fontWeight: '500' }]}>
                              {basket.collaboratorCount} membres
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  <TouchableOpacity onPress={() => onEditBasket(basket.id)} activeOpacity={0.7}>
                    <Text style={[Typography.bodyMd, { color: Colors.primary, fontWeight: '500' }]}>
                      Modifier
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Bouton Action d'Optimisation */}
                <TouchableOpacity
                  style={[
                    styles.optimizeButton,
                    status === 'loading' && { backgroundColor: Colors.primary + 'B3' }, // Opacité 70%
                    status === 'done' && { backgroundColor: Colors.tertiary },
                  ]}
                  onPress={() => handleOptimizePress(basket.id)}
                  disabled={status !== 'idle'}
                  activeOpacity={0.85}
                >
                  {status === 'idle' && (
                    <>
                      <MaterialIcons name="bolt" size={20} color={Colors.white} />
                      <Text style={[Typography.bodyLg, { color: Colors.white, fontWeight: '600' }]}>
                        Lancer l'optimisation
                      </Text>
                    </>
                  )}
                  {status === 'loading' && (
                    <>
                      <ActivityIndicator size="small" color={Colors.white} />
                      <Text style={[Typography.bodyLg, { color: Colors.white, fontWeight: '600' }]}>
                        Analyse intelligente...
                      </Text>
                    </>
                  )}
                  {status === 'done' && (
                    <>
                      <MaterialIcons name="check-circle" size={20} color={Colors.white} />
                      <Text style={[Typography.bodyLg, { color: Colors.white, fontWeight: '600' }]}>
                        Calcul terminé !
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Text style={styles.hintText}>
          Tes paniers habituels te permettent de comparer les prix de tes indispensables dans tous les magasins alentours en un clic.
        </Text>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Bouton global de création */}
      <TouchableOpacity style={styles.createButton} onPress={onCreateBasket} activeOpacity={0.9}>
        <MaterialIcons name="add" size={22} color={Colors.white} />
        <Text style={[Typography.bodyLg, { color: Colors.white, fontWeight: '600' }]}>
          Créer un panier habituel
        </Text>
      </TouchableOpacity>

      <BottomNav active="lists" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    paddingBottom: 12, 
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  basketCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.soft,
  },
  basketTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  basketInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: Radii.button,
    ...Shadows.soft,
  },
  hintText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    lineHeight: 16,
  },
  createButton: {
    position: 'absolute',
    bottom: 92,
    left: 16,
    right: 16,
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Shadows.active,
    zIndex: 10,
  },
});