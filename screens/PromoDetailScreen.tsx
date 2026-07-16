import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { Typography, Radii, Shadows } from '../theme/typography';
import {
  getPromoById,
  getComments,
  addComment,
  toggleVotePromotion,
  reportPromotion,
  REPORT_REASONS,
  type PromotionFeedItem,
  type PromoComment,
} from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs} h`;
  return `Il y a ${Math.floor(hrs / 24)} j`;
}

// ─── Composant commentaire ────────────────────────────────────────────────────

function CommentRow({ comment }: { comment: PromoComment }) {
  return (
    <View style={cmtStyles.row}>
      <View style={cmtStyles.avatar}>
        <Text style={cmtStyles.avatarLetter}>{comment.authorName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={cmtStyles.bubble}>
        <View style={cmtStyles.meta}>
          <Text style={cmtStyles.author}>{comment.authorName}</Text>
          <Text style={cmtStyles.time}>{formatTimeAgo(comment.createdAt)}</Text>
        </View>
        <Text style={cmtStyles.content}>{comment.content}</Text>
      </View>
    </View>
  );
}

const cmtStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLetter: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  bubble: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  author: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  time: { fontSize: 11, color: Colors.textMuted },
  content: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PromoDetailScreenProps {
  promoId: string;
  onBack: () => void;
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function PromoDetailScreen({ promoId, onBack }: PromoDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [promo, setPromo]           = useState<PromotionFeedItem | null>(null);
  const [comments, setComments]     = useState<PromoComment[]>([]);
  const [loadingPromo, setLoadingPromo] = useState(true);
  const [loadingCmts, setLoadingCmts]  = useState(true);
  const [draftComment, setDraftComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Vote local
  const [votes, setVotes]       = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting]     = useState(false);
  const [reported, setReported] = useState(false);

  // ── Chargement
  useEffect(() => {
    getPromoById(promoId)
      .then((p) => {
        setPromo(p);
        if (p) { setVotes(p.votesCount); setHasVoted(p.hasUserVoted); }
      })
      .catch(() => setPromo(null))
      .finally(() => setLoadingPromo(false));

    getComments(promoId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoadingCmts(false));
  }, [promoId]);

  // ── Vote
  const handleVote = useCallback(async () => {
    if (voting) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const optimisticVoted = !hasVoted;
    setHasVoted(optimisticVoted);
    setVotes((n) => optimisticVoted ? n + 1 : n - 1);
    setVoting(true);
    try {
      const result = await toggleVotePromotion(promoId);
      setHasVoted(result.voted);
      setVotes(result.count);
    } catch {
      setHasVoted(!optimisticVoted);
      setVotes((n) => optimisticVoted ? n - 1 : n + 1);
    } finally {
      setVoting(false);
    }
  }, [voting, hasVoted, promoId]);

  // ── Signalement
  const handleReport = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Signaler cette promo',
      'Pourquoi signales-tu cette promotion ?',
      [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () => {
            reportPromotion(promoId, reason)
              .then(() => {
                setReported(true);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Merci !', 'Ta contribution aide à garder le fil propre.');
              })
              .catch(() => Alert.alert('Erreur', "Impossible d'envoyer le signalement."));
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  }, [promoId]);

  // ── Ajouter commentaire
  const handleSubmitComment = useCallback(async () => {
    const trimmed = draftComment.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) { Alert.alert('Trop long', 'Le commentaire doit faire 500 caractères max.'); return; }
    setSubmitting(true);
    try {
      const newComment = await addComment(promoId, trimmed);
      setComments((prev) => [...prev, newComment]);
      setDraftComment('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer le commentaire. Vérifies ta connexion.");
    } finally {
      setSubmitting(false);
    }
  }, [draftComment, promoId]);

  // ── Rendu états de chargement
  if (loadingPromo) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[Typography.h2, { flex: 1 }]}>Détail promo</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!promo) {
    return (
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[Typography.h2, { flex: 1 }]}>Promo introuvable</Text>
        </View>
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={40} color={Colors.border} />
          <Text style={styles.notFoundText}>Cette promo n'existe plus ou a été supprimée.</Text>
          <TouchableOpacity style={styles.backBtnFallback} onPress={onBack}>
            <Text style={styles.backBtnFallbackText}>Retour au fil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isVerified = promo.status === 'verified';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.root}>
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onBack} hitSlop={8} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[Typography.h2, { flex: 1 }]} numberOfLines={1}>{promo.productName}</Text>
          <TouchableOpacity
            onPress={handleReport}
            disabled={reported}
            hitSlop={8}
            style={styles.reportBtn}
          >
            <MaterialIcons name="flag" size={20} color={reported ? Colors.error : Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Contenu scrollable ───────────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo preuve */}
          {promo.proofImageUrl ? (
            <Image
              source={{ uri: promo.proofImageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <MaterialIcons name="image-not-supported" size={36} color={Colors.border} />
              <Text style={styles.heroPlaceholderText}>Pas de photo de preuve</Text>
            </View>
          )}

          {/* Fiche produit */}
          <View style={[styles.promoCard, Shadows.soft]}>
            <View style={styles.promoHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{promo.productName}</Text>
                <View style={styles.storeRow}>
                  <MaterialIcons name="store" size={14} color={Colors.textMuted} />
                  <Text style={styles.storeName}>{promo.storeName}</Text>
                </View>
              </View>
              {isVerified && (
                <View style={styles.verifiedBadge}>
                  <MaterialIcons name="verified" size={14} color={Colors.success} />
                  <Text style={styles.verifiedText}>Vérifié</Text>
                </View>
              )}
            </View>

            <View style={styles.pricesRow}>
              <View style={styles.discountChip}>
                <Text style={styles.discountChipText}>-{promo.discountPercent}%</Text>
              </View>
              <Text style={styles.promoPrice}>
                {promo.promoPrice.toFixed(2).replace('.', ',')} €
              </Text>
              <Text style={styles.originalPrice}>
                {promo.originalPrice.toFixed(2).replace('.', ',')} €
              </Text>
            </View>

            <View style={styles.savingRow}>
              <MaterialIcons name="savings" size={16} color={Colors.success} />
              <Text style={styles.savingText}>
                Économie : {(promo.originalPrice - promo.promoPrice).toFixed(2).replace('.', ',')} €
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <View style={styles.authorInfo}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallLetter}>{promo.authorName.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.authorName}>{promo.authorName}</Text>
                <Text style={styles.postTime}>{formatTimeAgo(promo.createdAt)}</Text>
              </View>

              <TouchableOpacity
                style={[styles.voteBtn, hasVoted && styles.voteBtnActive]}
                onPress={() => void handleVote()}
                disabled={voting}
                activeOpacity={0.75}
              >
                <MaterialIcons
                  name={hasVoted ? 'thumb-up' : 'thumb-up-off-alt'}
                  size={16}
                  color={hasVoted ? Colors.success : Colors.textMuted}
                />
                <Text style={[styles.voteBtnText, hasVoted && styles.voteBtnTextActive]}>
                  {votes} vote{votes !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Section commentaires ───────────────────────────────────── */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsSectionTitle}>
              Commentaires · {comments.length}
            </Text>

            {loadingCmts ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : comments.length === 0 ? (
              <View style={styles.noComments}>
                <MaterialIcons name="chat-bubble-outline" size={28} color={Colors.border} />
                <Text style={styles.noCommentsText}>
                  Sois le premier à commenter !{'\n'}(ex: "Il en restait 3 en rayon ce matin")
                </Text>
              </View>
            ) : (
              comments.map((c) => <CommentRow key={c.id} comment={c} />)
            )}
          </View>
        </ScrollView>

        {/* ── Saisie commentaire (fixe en bas) ─────────────────────────── */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.commentInput}
            placeholder="Ajouter un commentaire…"
            placeholderTextColor={Colors.textMuted}
            value={draftComment}
            onChangeText={setDraftComment}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => void handleSubmitComment()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draftComment.trim() || submitting) && styles.sendBtnDisabled]}
            onPress={() => void handleSubmitComment()}
            disabled={!draftComment.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <MaterialIcons name="send" size={18} color={Colors.white} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 56,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: { padding: 4 },
  reportBtn: { padding: 4 },

  scrollContent: { paddingBottom: 16 },

  heroImage: {
    width: '100%',
    height: 240,
    backgroundColor: Colors.border,
  },
  heroPlaceholder: {
    width: '100%', height: 160,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  heroPlaceholderText: { fontSize: 13, color: Colors.textMuted },

  promoCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    padding: 16,
    margin: 16,
    marginBottom: 4,
  },
  promoHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  productName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, lineHeight: 24, marginBottom: 4 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeName: { fontSize: 13, color: Colors.textMuted },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: Colors.success },

  pricesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  discountChip: {
    backgroundColor: Colors.success, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  discountChipText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  promoPrice: { fontSize: 26, fontWeight: '900', color: Colors.success },
  originalPrice: { fontSize: 14, color: Colors.textMuted, textDecorationLine: 'line-through' },

  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  savingText: { fontSize: 14, fontWeight: '600', color: Colors.success },

  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmallLetter: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  authorName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  postTime: { fontSize: 11, color: Colors.textMuted },

  voteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.background,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
  },
  voteBtnActive: { backgroundColor: '#ECFDF5', borderColor: Colors.success },
  voteBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  voteBtnTextActive: { color: Colors.success },

  commentsSection: { padding: 16 },
  commentsSectionTitle: {
    fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16,
  },
  noComments: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  noCommentsText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.button,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
    maxHeight: 100,
    backgroundColor: Colors.background,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { backgroundColor: Colors.border },

  notFoundText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  backBtnFallback: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: Colors.primary, borderRadius: Radii.button,
  },
  backBtnFallbackText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
