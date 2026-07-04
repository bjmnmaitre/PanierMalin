// screens/CommunityFeedScreen.tsx
// 
// RÈGLE DE TRAITEMENT : Fichier intégral et autonome.
// Écran "La Commu" de PanierMalin v2.0.
// Gère le flux d'activité, les preuves photos pour les bons, et le parrainage.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import BottomNav, { TabKey } from '../components/BottomNav';
import FreshnessBadge from '../components/FreshnessBadge';
import { getCommunityFeed } from '../services/api';
import { CommunityActivityItem } from '../services/types';

interface Props {
  onNavigate: (tab: TabKey) => void;
  onOpenLeaderboard: () => void;
  onInviteFriends: () => void;
}

export default function CommunityFeedScreen({ 
  onNavigate, 
  onOpenLeaderboard, 
  onInviteFriends 
}: Props) {
  const [feed, setFeed] = useState<CommunityActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    getCommunityFeed()
      .then((items) => {
        if (isMounted) setFeed(items);
      })
      .catch((err) => console.error('[CommunityFeedScreen] getCommunityFeed failed', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <View style={styles.root}>
      {/* En-tête de l'écran Premium */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="groups" size={24} color={Colors.primary} />
          <Text style={[Typography.h1, { color: Colors.textPrimary }]}>La Commu</Text>
        </View>
        <TouchableOpacity style={styles.notifButton} onPress={onOpenLeaderboard} activeOpacity={0.7}>
          <MaterialIcons name="emoji-events" size={22} color={Colors.warning} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.bodyMd, { color: Colors.textSecondary, marginBottom: 16 }]}>
          Partagez vos bons plans, validez les prix et gagnez des récompenses !
        </Text>

        {/* Bannière de Parrainage Flash Épurée */}
        <TouchableOpacity style={[styles.referralCard, Shadows.soft]} onPress={onInviteFriends} activeOpacity={0.85}>
          <View style={styles.referralIconBox}>
            <MaterialIcons name="card-giftcard" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.labelSm, { color: Colors.primary, textTransform: 'uppercase' }]}>Parrainage actif</Text>
            <Text style={[Typography.bodyMd, { fontWeight: '700', color: Colors.textPrimary, marginTop: 1 }]}>
              Offrez 5€, gagnez 5€ en bons d'achat
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {/* Carte de classement hebdomadaire Bento */}
        <TouchableOpacity style={[styles.rankingCard, Shadows.soft]} onPress={onOpenLeaderboard} activeOpacity={0.85}>
          <View style={styles.rankingLeft}>
            <View style={styles.trophyCircle}>
              <MaterialIcons name="military-tech" size={24} color={Colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.labelSm, { color: Colors.textSecondary }]}>TON CLASSEMENT SENTINELLE</Text>
              <Text style={[Typography.bodyLg, { fontWeight: '700', color: Colors.textPrimary, marginTop: 1 }]}>
                🏆 #3 parmi vos amis
              </Text>
            </View>
          </View>
          <View style={styles.rankingLink}>
            <MaterialIcons name="analytics" size={18} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        <Text style={[Typography.h2, { color: Colors.textPrimary, marginBottom: 12 }]}>
          Activité en temps réel
        </Text>

        {/* Liste du flux communautaire */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
        ) : (
          <View style={styles.feedContainer}>
            {feed.map((item) => (
              <View key={item.id} style={[styles.feedCard, Shadows.soft]}>
                <View style={styles.feedRow}>
                  <Image source={{ uri: item.avatarUri }} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.feedHeaderRow}>
                      <Text style={[Typography.bodyMd, { fontWeight: '700', color: Colors.textPrimary }]}>
                        {item.userName}
                      </Text>
                      <Text style={[Typography.caption, { color: Colors.textMuted }]}>
                        {item.timeAgo}
                      </Text>
                    </View>
                    
                    <Text style={[Typography.bodyMd, { color: Colors.textPrimary, marginTop: 4, lineHeight: 20 }]}>
                      {item.message}
                    </Text>

                    {/* Preuve photo - Déclencheur des bons promotionnels */}
                    {item.proof && (
                      <View style={styles.proofRow}>
                        <Image source={{ uri: item.proof.imageUri }} style={styles.proofImage} />
                        <View style={{ flex: 1 }}>
                          <Text style={[Typography.caption, { color: Colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                            {item.proof.productName}
                          </Text>
                          <View style={{ marginTop: 2 }}>
                            <FreshnessBadge verifiedAt={item.proof.verifiedAt} />
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Indicateur de baisse de prix majeure */}
                    {item.priceDropBadge && (
                      <View style={styles.dropBadge}>
                        <MaterialIcons name="trending-down" size={14} color={Colors.success} />
                        <Text style={styles.dropBadgeText}>
                          {item.priceDropBadge}
                        </Text>
                      </View>
                    )}

                    {/* Bouton d'utilité collective */}
                    <TouchableOpacity style={styles.usefulButton} activeOpacity={0.7}>
                      <MaterialIcons name="thumb-up" size={14} color={Colors.primary} />
                      <Text style={styles.usefulButtonText}>
                        C'est vrai • {item.usefulCount}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bouton flottant (FAB) d'invitation directe Premium */}
      <TouchableOpacity style={[styles.fab, Shadows.active]} onPress={onInviteFriends} activeOpacity={0.85}>
        <MaterialIcons name="person-add" size={18} color={Colors.white} />
        <Text style={styles.fabText}>Parrainer</Text>
      </TouchableOpacity>

      <BottomNav active="community" onNavigate={onNavigate} />
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
    height: 64,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  scrollContent: { paddingHorizontal: 16, paddingBottom: 140, paddingTop: 16 },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    padding: 14,
    borderRadius: Radii.card,
    marginBottom: 12,
  },
  referralIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rankingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  trophyCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingLink: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedContainer: { gap: 12 },
  feedCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
  },
  feedRow: { flexDirection: 'row', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.border },
  feedHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 10,
  },
  proofImage: { width: 38, height: 38, borderRadius: 6, backgroundColor: Colors.border },
  dropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  dropBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  usefulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  usefulButtonText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  fab: {
    position: 'absolute',
    bottom: 84,
    right: 16,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 24,
  },
  fabText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});