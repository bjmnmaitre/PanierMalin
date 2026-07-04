// screens/ProfilePlaceholderScreen.tsx
// 
// RÈGLE DE TRAITEMENT : Fichier intégral et autonome.
// Écran "Mon QG" (Espace Utilisateur v2.0) de PanierMalin.
// Connecté au profil réel, gère la progression Sentinelle et les récompenses.

import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import { getMyProfile } from '../services/api';
import { UserProfile } from '../services/types';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  onNavigate: (tab: TabKey) => void;
  onViewBaskets: () => void;
  onInviteFriends: () => void;
}

export default function ProfilePlaceholderScreen({ 
  onNavigate, 
  onViewBaskets, 
  onInviteFriends 
}: Props) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
      .catch((err) => console.error('[ProfileScreen] getMyProfile failed', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [session]);

  if (loading) {
    return (
      <View style={[styles.root, styles.centerContainer]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  // Calcul fictif mais propre d'une barre de progression vers le prochain niveau
  const currentPoints = profile?.totalPoints ?? 0;
  const nextLevelPoints = 500; 
  const progressPercent = Math.min((currentPoints / nextLevelPoints) * 100, 100);

  return (
    <View style={styles.root}>
      {/* En-tête principal de la page "Mon QG" */}
      <View style={styles.mainHeader}>
        <Text style={[Typography.h1, { color: Colors.textPrimary }]}>Mon QG</Text>
        <TouchableOpacity style={styles.topSettingsButton} activeOpacity={0.7}>
          <MaterialIcons name="settings" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Section Carte d'Identité Utilisateur */}
        <View style={styles.profileIdentityRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {profile?.displayName?.[0] ?? '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.bodyLg, { fontWeight: '700', color: Colors.textPrimary }]}>
              {profile?.displayName ?? 'Chasseur de Primes'}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.planBadge, { backgroundColor: profile?.plan === 'premium' ? '#FFF9E6' : '#F0F0F0' }]}>
                <Text style={[styles.planText, { color: profile?.plan === 'premium' ? Colors.secondary : Colors.textSecondary }]}>
                  {profile?.plan === 'premium' ? '⭐ Premium' : 'Membre Malin'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section des Compteurs de Gains et Niveaux */}
        <View style={styles.statsGridRow}>
          <View style={[styles.statBox, Shadows.soft]}>
            <Text style={styles.statNumber}>{profile?.totalSavings ?? 0}€</Text>
            <Text style={styles.statLabel}>Économisés</Text>
          </View>
          <View style={[styles.statBox, Shadows.soft]}>
            <Text style={[styles.statNumber, { color: Colors.secondary }]}>{currentPoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={[styles.statBox, Shadows.soft]}>
            <Text style={[styles.statNumber, { color: Colors.tertiary }]}>Niv. {profile?.sentinelLevel ?? 1}</Text>
            <Text style={styles.statLabel}>Sentinelle</Text>
          </View>
        </View>

        {/* Jauge d'évolution du Statut Sentinelle de l'utilisateur */}
        <View style={[styles.evolutionCard, Shadows.soft]}>
          <View style={styles.evolutionHeader}>
            <Text style={styles.evolutionTitle}>Objectif Sentinelle Élite</Text>
            <Text style={styles.evolutionCount}>{currentPoints}/{nextLevelPoints} pts</Text>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.evolutionCaption}>
            Prends des photos des promos en rayon pour grimper au niveau supérieur !
          </Text>
        </View>

        {/* Espace Bons d'Achat et Récompenses Crowdsourcing */}
        <Text style={styles.blockTitle}>Mes récompenses débloquées</Text>
        <View style={[styles.vouchersCard, Shadows.soft]}>
          <View style={styles.voucherItemRow}>
            <View style={styles.voucherIconBox}>
              <MaterialIcons name="confirmation-number" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.voucherName}>Bon d'achat de 5,00 € Leclerc</Text>
              <Text style={styles.voucherStatus}>Prêt à l'emploi (Code : PM-LECL-84)</Text>
            </View>
          </View>
        </View>

        {/* Options de navigation de l'Espace Personnalisé */}
        <Text style={styles.blockTitle}>Gestion & Outils</Text>
        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItemRow} onPress={onViewBaskets} activeOpacity={0.7}>
            <MaterialIcons name="shopping-basket" size={20} color={Colors.primary} />
            <Text style={styles.menuItemLabel}>Mes paniers favoris</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItemRow} onPress={onInviteFriends} activeOpacity={0.7}>
            <MaterialIcons name="card-giftcard" size={20} color={Colors.secondary} />
            <Text style={styles.menuItemLabel}>Parrainer mes proches</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="profile" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centerContainer: { justifyContent: 'center', alignItems: 'center' },
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topSettingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 },
  profileIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: Colors.white },
  badgeRow: { flexDirection: 'row', marginTop: 4 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  planText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statsGridRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: { fontSize: 22, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
  evolutionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  evolutionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  evolutionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  evolutionCount: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  progressBarBackground: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressBarFill: { height: '100%', backgroundColor: Colors.tertiary, borderRadius: 4 },
  evolutionCaption: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16, fontWeight: '500' },
  blockTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  vouchersCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  voucherItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voucherIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  voucherStatus: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 1 },
  menuContainer: { backgroundColor: Colors.surface, borderRadius: Radii.card, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuItemLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginLeft: 12 },
});