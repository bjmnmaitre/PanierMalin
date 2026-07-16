import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { radii } from '@/design';
import { LogoPM } from '@/components/primitives';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '@/services/notificationService';
import type { UserNotification, NotificationType } from '@/services/notificationService';

// ─── Constantes de configuration par type ────────────────────────────────────

interface NotifConfig {
  icon:  keyof typeof MaterialIcons.glyphMap;
  color: string;
  bg:    string;
  label: string;
}

const TYPE_CONFIG: Record<NotificationType, NotifConfig> = {
  promo_nearby:  { icon: 'local-offer',   color: '#FF6B00', bg: '#FFF7ED', label: 'Promo a proximite' },
  comment_reply: { icon: 'reply',         color: '#3B82F6', bg: '#EFF6FF', label: 'Reponse'           },
  badge_earned:  { icon: 'emoji-events',  color: '#F59E0B', bg: '#FFFBEB', label: 'Recompense'        },
  system:        { icon: 'info-outline',  color: '#6B7280', bg: '#F1F5F9', label: 'Systeme'           },
};

// ─── Utilitaires de date ──────────────────────────────────────────────────────

function dateLabel(iso: string): string {
  const d    = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60)     return "A l'instant";
  if (diff < 3600)   return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

type Section = { title: string; data: UserNotification[] };

function buildSections(notifs: UserNotification[]): Section[] {
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayItems:     UserNotification[] = [];
  const yesterdayItems: UserNotification[] = [];
  const olderItems:     UserNotification[] = [];

  for (const n of notifs) {
    const d = new Date(n.createdAt);
    if (d.toDateString() === today.toDateString())     todayItems.push(n);
    else if (d.toDateString() === yesterday.toDateString()) yesterdayItems.push(n);
    else olderItems.push(n);
  }

  const sections: Section[] = [];
  if (todayItems.length)     sections.push({ title: "Aujourd'hui", data: todayItems });
  if (yesterdayItems.length) sections.push({ title: 'Hier',        data: yesterdayItems });
  if (olderItems.length)     sections.push({ title: 'Plus ancien', data: olderItems });

  return sections;
}

// ─── Carte de notification ────────────────────────────────────────────────────

interface NotifCardProps {
  notif:   UserNotification;
  onPress: (notif: UserNotification) => void;
}

function NotifCard({ notif, onPress }: NotifCardProps) {
  const cfg = TYPE_CONFIG[notif.type];

  return (
    <TouchableOpacity
      style={[styles.card, !notif.isRead && styles.cardUnread]}
      onPress={() => onPress(notif)}
      activeOpacity={0.78}
    >
      {/* Pastille non-lu */}
      {!notif.isRead && <View style={styles.unreadDot} />}

      {/* Icône type */}
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <MaterialIcons name={cfg.icon} size={22} color={cfg.color} />
      </View>

      {/* Contenu */}
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <View style={[styles.typePill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.typePillTxt, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.cardTime}>{dateLabel(notif.createdAt)}</Text>
        </View>
        <Text style={[styles.cardTitle, !notif.isRead && styles.cardTitleUnread]} numberOfLines={2}>
          {notif.title}
        </Text>
        <Text style={styles.cardBody2} numberOfLines={2}>
          {notif.body}
        </Text>
      </View>

      <MaterialIcons name="chevron-right" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

// ─── En-tête de section ───────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── État vide ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name="notifications-none" size={48} color="#CBD5E1" />
      </View>
      <Text style={styles.emptyTitle}>Tout est calme ici</Text>
      <Text style={styles.emptySub}>
        Vous serez notifie quand une promo interessante apparait pres de chez vous ou quand quelqu'un repond a vos commentaires.
      </Text>
    </View>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export interface NotificationCenterScreenProps {
  onBack: () => void;
}

export default function NotificationCenterScreen({ onBack }: NotificationCenterScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [markingAll,    setMarkingAll]    = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const sections    = buildSections(notifications);

  // ── Chargement ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const data = await getNotifications();
    setNotifications(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Clic sur une notification ────────────────────────────────────────────────
  const handlePress = useCallback((notif: UserNotification) => {
    // Marquer comme lu en tâche de fond + mise à jour optimiste
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      void markAsRead(notif.id);
    }

    // Navigation vers le contenu associé
    if (notif.relatedId) {
      switch (notif.type) {
        case 'promo_nearby':
        case 'comment_reply':
          router.push(`/promo/${notif.relatedId}` as Parameters<typeof router.push>[0]);
          break;
        case 'badge_earned':
          router.push('/rewards' as Parameters<typeof router.push>[0]);
          break;
        case 'system':
        default:
          break;
      }
    }
  }, [router]);

  // ── Tout marquer comme lu ────────────────────────────────────────────────────
  const handleMarkAll = useCallback(async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    const ok = await markAllAsRead();
    if (ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
    setMarkingAll(false);
  }, [unreadCount, markingAll]);

  // ── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeTxt}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={() => void handleMarkAll()}
              disabled={markingAll}
              activeOpacity={0.75}
            >
              {markingAll
                ? <ActivityIndicator size="small" color="#FF6B00" />
                : <Text style={styles.markAllTxt}>Tout lire</Text>
              }
            </TouchableOpacity>
          )}
          <LogoPM size={26} />
        </View>
      </View>

      {/* Corps */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingTxt}>Chargement…</Text>
        </View>
      ) : sections.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList<UserNotification, Section>
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotifCard notif={item} onPress={handlePress} />
          )}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} />
          )}
          stickySectionHeadersEnabled
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  backBtn:      { padding: 2 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  headerBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#FF6B00',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  headerBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markAllBtn:  { paddingVertical: 4, paddingHorizontal: 10 },
  markAllTxt:  { fontSize: 12, fontWeight: '700', color: '#FF6B00' },

  // ── Chargement ───────────────────────────────────────────────────────────
  loadingWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingTxt: { fontSize: 14, color: '#94A3B8' },

  // ── Section header ────────────────────────────────────────────────────────
  sectionHeader: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  // ── Liste ─────────────────────────────────────────────────────────────────
  list: { paddingTop: 4 },

  // ── Carte ─────────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginVertical: 3,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardUnread: {
    backgroundColor: '#FFF8F0',
    borderColor: '#FED7AA',
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    left: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF6B00',
  },

  iconWrap: {
    width: 44, height: 44,
    borderRadius: radii.lg,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  cardBody: { flex: 1, gap: 4 },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },

  typePill: {
    borderRadius: radii.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  typePillTxt: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  cardTime:         { fontSize: 10, color: '#94A3B8', marginLeft: 'auto' as any },
  cardTitle:        { fontSize: 13, fontWeight: '600', color: '#374151', lineHeight: 18 },
  cardTitleUnread:  { fontWeight: '800', color: '#0F172A' },
  cardBody2:        { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  // ── État vide ─────────────────────────────────────────────────────────────
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#94A3B8', textAlign: 'center' },
  emptySub:   { fontSize: 13, color: '#CBD5E1', textAlign: 'center', lineHeight: 20, maxWidth: 280 },
});
