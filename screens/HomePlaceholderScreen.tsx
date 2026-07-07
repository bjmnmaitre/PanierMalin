// screens/HomePlaceholderScreen.tsx
// 
// RÈGLE DE TRAITEMENT : Fichier intégral et autonome.
// Écran principal "Search-First" de PanierMalin v2.0.
// Connecté au profil Supabase et gérant la recherche par IA.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import { getMyProfile } from '../services/api';
import { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onNavigate: (tab: TabKey) => void;
  onScan: () => void;
  onViewBaskets: () => void;
  onSearchSubmit?: (naturalQuery: string) => void;
}

export default function HomePlaceholderScreen({ 
  onNavigate, 
  onScan, 
  onViewBaskets,
  onSearchSubmit 
}: Props) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    getMyProfile()
      .then((data) => {
        if (isMounted) setProfile(data);
      })
      .catch((err) => console.error('[HomePlaceholderScreen] Fetch profile failed', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [session]);

  const handleSearchAction = () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setIsAiProcessing(true);

    // Simulation de l'interprétation sémantique de l'IA en temps réel
    setTimeout(() => {
      setIsAiProcessing(false);
      if (onSearchSubmit) {
        onSearchSubmit(query);
      } else {
        console.log('[IA Search Query Input]:', query);
      }
    }, 1200);
  };

  const handleVoicePress = () => {
    setQuery("Je cherche du filet de poulet en promo et de la salade");
  };

  return (
    <View style={styles.root}>
      {/* Zone Supérieure : Look épuré "Card-in-Surface" */}
      <View style={styles.heroSection}>
        <View style={styles.headerRow}>
          <Text style={styles.brandTitle}>PanierMalin</Text>
          <TouchableOpacity style={styles.notifButton} activeOpacity={0.7}>
            <MaterialIcons name="bolt" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ height: 24, justifyContent: 'center', marginBottom: 12 }}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <Text style={[Typography.bodyMd, { color: Colors.textSecondary, marginBottom: 8, fontWeight: '500' }]}>
            Bonjour {profile?.displayName ?? 'Chercheur'} 👋 · <Text style={{ color: Colors.primary, fontWeight: '600' }}>Niv. {profile?.sentinelLevel ?? 1}</Text>
          </Text>
        )}

        <Text style={styles.mainPrompt}>Aujourd'hui,</Text>
        <Text style={styles.subPrompt}>Je cherche...</Text>

        {/* Barre de recherche Omni-Search Premium style Neumorph/Soft */}
        <View style={[styles.searchContainer, Shadows.soft]}>
          <MaterialIcons name="search" size={22} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Dis-moi ou écris ce que tu cherches..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearchAction}
            returnKeyType="search"
            editable={!isAiProcessing}
          />
          
          {query.length > 0 ? (
            <TouchableOpacity 
              onPress={handleSearchAction} 
              style={styles.actionSearchButton}
              disabled={isAiProcessing}
            >
              {isAiProcessing ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <MaterialIcons name="arrow-forward" size={18} color={Colors.white} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleVoicePress} style={styles.voiceButton}>
              <MaterialIcons name="mic" size={22} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Zone Défilante */}
      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        
        {/* Actions rapides sans bordures épaisses style Bento */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={[styles.quickAction, Shadows.soft]} onPress={onScan} activeOpacity={0.8}>
            <View style={[styles.actionIconCircle, { backgroundColor: Colors.primaryLight }]}>
              <MaterialIcons name="qr-code-scanner" size={22} color={Colors.primary} />
            </View>
            <Text style={[Typography.bodyMd, { fontWeight: '600', color: Colors.textPrimary }]}>Scanner</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickAction, Shadows.soft]} onPress={onViewBaskets} activeOpacity={0.8}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#F0FDF4' }]}>
              <MaterialIcons name="shopping-basket" size={22} color={Colors.success} />
            </View>
            <Text style={[Typography.bodyMd, { fontWeight: '600', color: Colors.textPrimary }]}>Mes paniers</Text>
          </TouchableOpacity>
        </View>

        {/* Tableau de bord Économies Modernisé */}
        <View style={[styles.savingsCard, Shadows.soft]}>
          <View>
            <Text style={[Typography.labelSm, { color: Colors.primary, textTransform: 'uppercase' }]}>
              Économies totales
            </Text>
            <Text style={[Typography.h1, { color: Colors.textPrimary, fontSize: 34, marginTop: 4, fontWeight: '800' }]}>
              {profile?.totalSavings ?? 0}€
            </Text>
          </View>
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>{profile?.totalPoints ?? 0} pts</Text>
          </View>
        </View>

        {/* Section Live / Crowdsourcing Photo */}
        <View style={styles.liveSectionHeader}>
          <Text style={[Typography.h2, { color: Colors.textPrimary }]}>
            Promos en direct des magasins
          </Text>
          <View style={styles.liveIndicator}>
            <View style={styles.livePulse} />
            <Text style={styles.liveText}>LIVE AI</Text>
          </View>
        </View>

        {/* Carte promotionnelle d'exemple épurée */}
        <View style={[styles.promoCard, Shadows.soft]}>
          <View style={styles.promoHeader}>
            <View style={styles.storeTag}>
              <Text style={styles.storeTagName}>Lidl Puilboreau</Text>
            </View>
            <Text style={styles.timeTag}>En direct</Text>
          </View>
          <Text style={styles.promoProduct}>Pack de 6 briques de Lait Demi-Écrémé</Text>
          <View style={styles.priceRow}>
            <Text style={styles.oldPrice}>6.40€</Text>
            <Text style={styles.newPrice}>4.20€ <Text style={styles.savingsPercent}>(-34%)</Text></Text>
          </View>
          <View style={styles.userProofRow}>
            <MaterialIcons name="verified" size={14} color={Colors.success} />
            <Text style={styles.userProofText}>Photo IA vérifiée · Gagne des récompenses</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="home" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  heroSection: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: Radii.card,
    borderBottomRightRadius: Radii.card,
    ...Shadows.soft,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  brandTitle: { ...Typography.h1, color: Colors.primary, fontWeight: '800', letterSpacing: -0.5 },
  notifButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mainPrompt: { fontSize: 28, fontWeight: '300', color: Colors.textSecondary },
  subPrompt: { fontSize: 34, fontWeight: '700', color: Colors.textPrimary, marginTop: -4, marginBottom: 16, letterSpacing: -0.5 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radii.button,
    height: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  voiceButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  actionSearchButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: { paddingHorizontal: 16, paddingTop: 20 },
  quickActionsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  savingsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pointsBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.badge },
  pointsText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  liveSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFEEFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  liveText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  promoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
  },
  promoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  storeTag: { backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  storeTagName: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  timeTag: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  promoProduct: { ...Typography.bodyLg, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 12 },
  oldPrice: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'line-through' },
  newPrice: { fontSize: 18, fontWeight: '700', color: Colors.error },
  savingsPercent: { fontSize: 13, fontWeight: '600', color: Colors.error },
  userProofRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: Colors.background, paddingTop: 12 },
  userProofText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
});