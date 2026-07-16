import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii } from '@/design';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCommentsForPromo,
  postComment,
  togglePinComment,
} from '@/services/socialService';
import type { FlatComment, AuthorRole } from '@/services/socialService';

// ─── Constantes ───────────────────────────────────────────────────────────────

const INDENT_PX     = 16;           // décalage horizontal par niveau d'imbrication
const MAX_DEPTH     = 5;            // profondeur maximale affichée (protection visuelle)
const THREAD_COLOR  = '#E2E8F0';    // couleur du filet de guidage vertical

// Couleurs déterministes des avatars de secours (initiales)
const AVATAR_PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B'];

function avatarColor(name: string): string {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)     return "A l'instant";
  if (diff < 3600)   return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Sous-composant : avatar ──────────────────────────────────────────────────

const Avatar = memo(function Avatar({
  url,
  name,
  size = 34,
}: {
  url:  string | null;
  name: string;
  size?: number;
}) {
  const borderRadius = size / 2;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={[
        { width: size, height: size, borderRadius },
        { backgroundColor: avatarColor(name), alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#FFFFFF' }}>
        {initials(name)}
      </Text>
    </View>
  );
});

// ─── Sous-composant : badge rôle ─────────────────────────────────────────────

const RoleBadge = memo(function RoleBadge({ role }: { role: AuthorRole }) {
  if (role === 'pro') {
    return (
      <View style={badge.proPill}>
        <MaterialIcons name="verified" size={11} color="#059669" />
        <Text style={badge.proTxt}>Commercant Certifie</Text>
      </View>
    );
  }
  if (role === 'admin') {
    return (
      <View style={badge.adminPill}>
        <MaterialIcons name="shield" size={11} color="#7C3AED" />
        <Text style={badge.adminTxt}>PanierMalin</Text>
      </View>
    );
  }
  return null;
});

const badge = StyleSheet.create({
  proPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ECFDF5', borderRadius: radii.full,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#A7F3D0',
  },
  proTxt:   { fontSize: 9, fontWeight: '800', color: '#059669' },
  adminPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F5F3FF', borderRadius: radii.full,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  adminTxt: { fontSize: 9, fontWeight: '800', color: '#7C3AED' },
});

// ─── Sous-composant : carte commentaire ──────────────────────────────────────

interface CommentCardProps {
  item:         FlatComment;
  currentUserId: string | null;
  isPro:        boolean;
  onReply:      (id: string, name: string) => void;
  onPin:        (id: string, pin: boolean) => void;
}

const CommentCard = memo(function CommentCard({
  item,
  currentUserId,
  isPro,
  onReply,
  onPin,
}: CommentCardProps) {
  const depth      = Math.min(item.depth, MAX_DEPTH);
  const isOwn      = item.userId === currentUserId;
  const isPro_role = item.authorRole === 'pro';

  return (
    <View style={[card.wrapper, { marginLeft: depth * INDENT_PX }]}>
      {/* Filet de guidage vertical pour les réponses imbriquées */}
      {depth > 0 && <View style={card.threadLine} />}

      {/* Indicateur "Épinglé" */}
      {item.isPinned && (
        <View style={card.pinnedBanner}>
          <MaterialIcons name="push-pin" size={12} color="#FF6B00" />
          <Text style={card.pinnedTxt}>Epingle par le magasin</Text>
        </View>
      )}

      {/* Fond teinté pour les commerçants certifiés */}
      <View style={[card.bubble, isPro_role && card.bubblePro]}>

        {/* En-tête : avatar + nom + badge */}
        <View style={card.header}>
          <Avatar url={item.authorAvatarUrl} name={item.authorName} size={32} />
          <View style={card.headerText}>
            <View style={card.nameRow}>
              <Text style={card.authorName} numberOfLines={1}>{item.authorName}</Text>
              <RoleBadge role={item.authorRole} />
            </View>
            <Text style={card.time}>{relativeTime(item.createdAt)}</Text>
          </View>
        </View>

        {/* Contenu */}
        <Text style={card.content}>{item.content}</Text>

        {/* Actions */}
        <View style={card.actions}>
          <TouchableOpacity
            style={card.actionBtn}
            onPress={() => onReply(item.id, item.authorName)}
            hitSlop={8}
          >
            <MaterialIcons name="reply" size={14} color="#94A3B8" />
            <Text style={card.actionTxt}>Repondre</Text>
          </TouchableOpacity>

          {/* Épinglage : auteur de la promo Pro ou admin */}
          {(isPro || isOwn) && (
            <TouchableOpacity
              style={card.actionBtn}
              onPress={() => onPin(item.id, !item.isPinned)}
              hitSlop={8}
            >
              <MaterialIcons
                name={item.isPinned ? 'push-pin' : 'push-pin'}
                size={14}
                color={item.isPinned ? '#FF6B00' : '#CBD5E1'}
              />
              <Text style={[card.actionTxt, item.isPinned && { color: '#FF6B00' }]}>
                {item.isPinned ? 'Desepingler' : 'Epingler'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const card = StyleSheet.create({
  wrapper: {
    position: 'relative',
    paddingLeft: 2,
    marginBottom: 2,
  },
  threadLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: THREAD_COLOR,
  },
  pinnedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#FFF7ED',
    borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg,
    borderWidth: 1, borderColor: '#FED7AA', borderBottomWidth: 0,
  },
  pinnedTxt: { fontSize: 10, fontWeight: '700', color: '#C2410C' },

  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 12,
    gap: 8,
  },
  bubblePro: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  header:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerText: { flex: 1, gap: 2 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  authorName: { fontSize: 13, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  time:       { fontSize: 10, color: '#94A3B8' },
  content:    { fontSize: 14, color: '#374151', lineHeight: 20 },

  actions:    { flexDirection: 'row', gap: 16, paddingTop: 2 },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionTxt:  { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
});

// ─── Sous-composant : barre "Réponse à…" ─────────────────────────────────────

interface ReplyBarProps {
  name:    string;
  onCancel: () => void;
}

const ReplyBar = memo(function ReplyBar({ name, onCancel }: ReplyBarProps) {
  return (
    <View style={rb.root}>
      <MaterialIcons name="reply" size={14} color="#FF6B00" />
      <Text style={rb.txt} numberOfLines={1}>
        Reponse a <Text style={rb.name}>{name}</Text>
      </Text>
      <TouchableOpacity onPress={onCancel} hitSlop={10}>
        <MaterialIcons name="close" size={16} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );
});

const rb = StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF7ED',
    borderTopWidth: 1, borderColor: '#FED7AA',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  txt:  { flex: 1, fontSize: 12, color: '#C2410C', fontWeight: '500' },
  name: { fontWeight: '800' },
});

// ─── Composant principal ──────────────────────────────────────────────────────

export interface PromoCommentsSectionProps {
  promoId: string;
}

export default function PromoCommentsSection({ promoId }: PromoCommentsSectionProps) {
  const insets  = useSafeAreaInsets();
  const { profile } = useAuth();

  const [comments,  setComments]  = useState<FlatComment[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(false);
  const [inputText, setInputText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);

  const inputRef  = useRef<TextInput>(null);
  const listRef   = useRef<FlatList<FlatComment>>(null);

  const isPro = profile?.plan === 'pro';

  // ── Chargement initial ──────────────────────────────────────────────────────
  const loadComments = useCallback(async () => {
    setLoading(true);
    const data = await getCommentsForPromo(promoId);
    setComments(data);
    setLoading(false);
  }, [promoId]);

  useEffect(() => { void loadComments(); }, [loadComments]);

  // ── Envoi d'un commentaire ──────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const result = await postComment(promoId, text, replyTarget?.id);
      if (result.success) {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch { /* haptics non disponibles */ }

        setInputText('');
        setReplyTarget(null);

        // Recharge l'arbre complet pour reconstruire les profondeurs
        const updated = await getCommentsForPromo(promoId);
        setComments(updated);

        // Scroll vers le dernier commentaire
        if (updated.length > 0) {
          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
          }, 150);
        }
      } else {
        Alert.alert('Erreur', "Impossible d'envoyer le commentaire. Reessaie.");
      }
    } finally {
      setSending(false);
    }
  }, [inputText, sending, promoId, replyTarget]);

  // ── Répondre à un commentaire ───────────────────────────────────────────────
  const handleReply = useCallback((id: string, name: string) => {
    setReplyTarget({ id, name });
    inputRef.current?.focus();
  }, []);

  // ── Épingler un commentaire ─────────────────────────────────────────────────
  const handlePin = useCallback(async (commentId: string, pin: boolean) => {
    const ok = await togglePinComment(commentId, pin);
    if (ok) {
      // Mise à jour locale immédiate, puis rechargement pour retrouver le bon tri
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, isPinned: pin } : c))
      );
      const updated = await getCommentsForPromo(promoId);
      setComments(updated);
    } else {
      Alert.alert('Non autorise', "Seuls les commerçants proprietaires et les admins peuvent epingler.");
    }
  }, [promoId]);

  // ── Rendu d'un item ─────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: FlatComment }) => (
      <CommentCard
        item={item}
        currentUserId={profile?.id ?? null}
        isPro={isPro}
        onReply={handleReply}
        onPin={handlePin}
      />
    ),
    [profile?.id, isPro, handleReply, handlePin]
  );

  const keyExtractor = useCallback((item: FlatComment) => item.id, []);

  const ItemSeparator = useCallback(() => <View style={{ height: 6 }} />, []);

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.bottom + 10}
    >
      {/* ── En-tête de la section ─────────────────────────────────────── */}
      <View style={s.sectionHeader}>
        <MaterialIcons name="forum" size={16} color="#64748B" />
        <Text style={s.sectionTitle}>
          {loading ? 'Discussion' : `Discussion · ${comments.length} commentaire${comments.length > 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* ── Liste des commentaires ────────────────────────────────────── */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="small" color="#FF6B00" />
          <Text style={s.loadingTxt}>Chargement de la discussion…</Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={s.emptyWrap}>
          <MaterialIcons name="chat-bubble-outline" size={36} color="#CBD5E1" />
          <Text style={s.emptyTitle}>Aucun commentaire</Text>
          <Text style={s.emptySub}>Soyez le premier a valider ou poser une question sur cette promo !</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={comments}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={ItemSeparator}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          // La liste ne prend que la hauteur de son contenu ; le scroll global
          // est géré par le ScrollView parent dans la fiche de promo.
          scrollEnabled={false}
          // Optimisations
          removeClippedSubviews={false}
        />
      )}

      {/* ── Barre de réponse contextuelle ────────────────────────────── */}
      {replyTarget && (
        <ReplyBar
          name={replyTarget.name}
          onCancel={() => setReplyTarget(null)}
        />
      )}

      {/* ── Zone de saisie ───────────────────────────────────────────── */}
      <View style={s.compose}>
        <Avatar
          url={profile?.avatarUrl ?? null}
          name={profile?.displayName ?? 'Moi'}
          size={32}
        />
        <View style={s.inputWrap}>
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder={
              replyTarget
                ? `Repondre a ${replyTarget.name}…`
                : 'Ajouter un commentaire…'
            }
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            returnKeyType="default"
            blurOnSubmit={false}
          />
        </View>
        <TouchableOpacity
          style={[s.sendBtn, (!inputText.trim() || sending) && s.sendBtnDisabled]}
          onPress={() => void handleSend()}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.82}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <MaterialIcons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles du composant principal ───────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  // ── États ─────────────────────────────────────────────────────────────────
  loadingWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 24,
  },
  loadingTxt: { fontSize: 13, color: '#94A3B8' },

  emptyWrap: {
    alignItems: 'center', paddingVertical: 28, gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#94A3B8' },
  emptySub:   { fontSize: 13, color: '#CBD5E1', textAlign: 'center', maxWidth: 260, lineHeight: 19 },

  // ── Liste ─────────────────────────────────────────────────────────────────
  list: { paddingBottom: 8 },

  // ── Zone de saisie ────────────────────────────────────────────────────────
  compose: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: radii.lg,
    paddingHorizontal: 12, paddingVertical: 8,
    minHeight: 40, justifyContent: 'center',
  },
  input: {
    fontSize: 14, color: '#0F172A',
    maxHeight: 100,
    padding: 0, margin: 0,
  },
  sendBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B00',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28, shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0, elevation: 0,
  },
});
