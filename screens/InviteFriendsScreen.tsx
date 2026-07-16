import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import { ensureReferralCode } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  onBack: () => void;
}

const APP_STORE_URL = 'https://paniermalin.app'; // URL de l'appli (à adapter)

export default function InviteFriendsScreen({ onBack }: Props) {
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [referralCode, setReferralCode] = useState<string>(profile?.referralCode ?? '');
  const [loading, setLoading] = useState(!profile?.referralCode || profile.referralCode === 'TEMP');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    ensureReferralCode()
      .then((code) => setReferralCode(code))
      .catch((err) => console.error('[InviteFriendsScreen] ensureReferralCode failed', err))
      .finally(() => setLoading(false));
  }, [session]);

  const shareMessage = `🛒 Rejoins-moi sur PanierMalin et économise jusqu'à 30% sur tes courses ! Utilise mon code **${referralCode}** à l'inscription pour un mois Premium offert.\n${APP_STORE_URL}`;

  const copyCode = useCallback(async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [referralCode]);

  const shareWhatsApp = useCallback(async () => {
    if (!referralCode) return;
    const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp non disponible', 'WhatsApp n\'est pas installé sur cet appareil.');
    }
  }, [referralCode, shareMessage]);

  const shareNative = useCallback(async () => {
    if (!referralCode) return;
    await Share.share({ message: shareMessage, title: 'PanierMalin — Invitation' });
  }, [referralCode, shareMessage]);

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const invitedCount = profile?.invitedCount ?? 0;
  const ambassadorGoal = profile?.ambassadorGoal ?? 5;
  const progressPct = Math.min((invitedCount / ambassadorGoal) * 100, 100);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={Typography.h2}>Parrainage</Text>
        <TouchableOpacity style={styles.notifButton} onPress={shareNative} hitSlop={8}>
          <MaterialIcons name="share" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.h1, { marginBottom: 8, color: Colors.textPrimary, letterSpacing: -0.5 }]}>
          Invite tes amis, gagnez ensemble
        </Text>
        <Text style={[Typography.bodyMd, { color: Colors.textSecondary, marginBottom: 20 }]}>
          Partage l'expérience de consommation intelligente autour de toi.
        </Text>

        <Image
          source={{
            uri: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80',
          }}
          style={styles.heroImage}
        />

        <View style={[styles.explainCard, Shadows.soft]}>
          <View style={styles.giftIconCircle}>
            <MaterialIcons name="card-giftcard" size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.bodyLg, { color: Colors.textPrimary, fontWeight: '600' }]}>
              1 mois Premium gratuit pour ton ami
            </Text>
            <Text style={[Typography.bodyMd, { marginTop: 4, color: Colors.textSecondary }]}>
              Et tu remportes +100 points fidélité dès son inscription.
            </Text>
          </View>
        </View>

        <View style={[styles.codeCard, Shadows.soft]}>
          <Text style={[Typography.labelSm, { color: Colors.textSecondary, textTransform: 'uppercase' }]}>
            Ton code de parrainage
          </Text>
          <View style={styles.dashedBox}>
            <Text style={[Typography.h1, { color: Colors.primary, fontSize: 28, letterSpacing: 2, fontWeight: '800' }]}>
              {referralCode || '…'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.copyButton, copied && styles.copyButtonSuccess]}
            onPress={copyCode}
            activeOpacity={0.9}
          >
            <MaterialIcons name={copied ? 'check' : 'content-copy'} size={18} color={Colors.white} />
            <Text style={[Typography.bodyLg, { color: Colors.white, fontWeight: '600' }]}>
              {copied ? 'Code copié !' : 'Copier le code'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[Typography.h2, { marginBottom: 12, color: Colors.textPrimary }]}>Partager via</Text>
        <View style={{ gap: 10, marginBottom: 24 }}>
          <TouchableOpacity style={[styles.shareButton, { backgroundColor: '#25D366' }]} onPress={shareWhatsApp} activeOpacity={0.9}>
            <View style={styles.shareButtonLeft}>
              <MaterialIcons name="chat" size={20} color={Colors.white} />
              <Text style={[Typography.bodyLg, { color: Colors.white, fontWeight: '600' }]}>WhatsApp</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.shareButton, { backgroundColor: Colors.primaryLight }]} onPress={shareNative} activeOpacity={0.9}>
            <View style={styles.shareButtonLeft}>
              <MaterialIcons name="ios-share" size={20} color={Colors.primary} />
              <Text style={[Typography.bodyLg, { color: Colors.primary, fontWeight: '600' }]}>Partager via…</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.ambassadorCard, Shadows.soft]}>
          <View style={styles.ambassadorHeaderRow}>
            <Text style={[Typography.bodyLg, { fontWeight: '600', color: Colors.textPrimary }]}>Objectif Ambassadeur</Text>
            <Text style={[Typography.bodyLg, { color: Colors.primary, fontWeight: '700' }]}>
              {invitedCount}/{ambassadorGoal}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.ambassadorFooterRow}>
            <MaterialIcons name="stars" size={18} color={Colors.warning} style={{ marginTop: 2 }} />
            <Text style={[Typography.caption, { flex: 1, color: Colors.textSecondary, lineHeight: 16 }]}>
              Tu as invité {invitedCount} amis. Plus que {Math.max(ambassadorGoal - invitedCount, 0)} parrainages pour débloquer ton statut certifié !
            </Text>
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
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
  backButton: { padding: 4 },
  notifButton: { padding: 4 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  heroImage: { width: '100%', height: 160, borderRadius: Radii.card, marginBottom: 20, resizeMode: 'cover' },
  explainCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    marginBottom: 20,
  },
  giftIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  dashedBox: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: Radii.button,
    width: '100%',
    ...Shadows.active,
  },
  copyButtonSuccess: {
    backgroundColor: Colors.success,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderRadius: Radii.button,
    paddingHorizontal: 16,
  },
  shareButtonLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ambassadorCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 18,
  },
  ambassadorHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  progressTrack: { height: 8, backgroundColor: Colors.background, borderRadius: 999, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 999 },
  ambassadorFooterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});