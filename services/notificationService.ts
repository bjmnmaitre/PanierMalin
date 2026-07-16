import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiClient } from './api/client';

const supabase = apiClient.getSupabase();

// ─── Handler global ───────────────────────────────────────────────────────────
// Doit être appelé une seule fois au démarrage de l'app (module-level = safe).
// Configure le comportement quand une notification arrive en foreground.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  false,
    shouldSetBadge:   false,
  }),
});

// ─── Types publics ────────────────────────────────────────────────────────────

export type NotificationType = 'promo_nearby' | 'comment_reply' | 'badge_earned' | 'system';

export interface UserNotification {
  id:        string;
  userId:    string;
  title:     string;
  body:      string;
  type:      NotificationType;
  relatedId: string | null;
  isRead:    boolean;
  createdAt: string;
}

// ─── Mappage DB → TS ─────────────────────────────────────────────────────────

interface DbRow {
  id:         string;
  user_id:    string;
  title:      string;
  body:       string;
  type:       string;
  related_id: string | null;
  is_read:    boolean;
  created_at: string;
}

function rowToNotification(row: DbRow): UserNotification {
  const knownTypes: NotificationType[] = [
    'promo_nearby', 'comment_reply', 'badge_earned', 'system',
  ];
  const type: NotificationType =
    knownTypes.includes(row.type as NotificationType)
      ? (row.type as NotificationType)
      : 'system';

  return {
    id:        row.id,
    userId:    row.user_id,
    title:     row.title,
    body:      row.body,
    type,
    relatedId: row.related_id ?? null,
    isRead:    row.is_read,
    createdAt: row.created_at,
  };
}

// ─── Fonctions du service ─────────────────────────────────────────────────────

/**
 * Récupère toutes les notifications de l'utilisateur connecté, les plus récentes
 * en premier.
 */
export async function getNotifications(): Promise<UserNotification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return (data as DbRow[]).map(rowToNotification);
}

/**
 * Marque une notification comme lue.
 * Retourne true si la mise à jour a réussi.
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  return !error;
}

/**
 * Marque toutes les notifications de l'utilisateur comme lues.
 * Utilisé par le bouton "Tout marquer comme lu".
 */
export async function markAllAsRead(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  return !error;
}

/**
 * Retourne le nombre exact de notifications non lues.
 * Utilise `count: 'exact'` + `head: true` pour éviter de rapatrier les données.
 */
export async function getUnreadCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Insère une notification dans la table pour l'utilisateur connecté.
 * Utilisé côté client pour les notifications système immédiates
 * (ex: badge gagné après une action locale).
 */
export async function createNotification(
  title:     string,
  body:      string,
  type:      NotificationType,
  relatedId?: string,
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_notifications')
    .insert({
      user_id:    user.id,
      title,
      body,
      type,
      related_id: relatedId ?? null,
    });

  return !error;
}

// ─── Push locale via expo-notifications ──────────────────────────────────────

/**
 * Affiche une bannière système (push locale) si les permissions sont accordées,
 * ou une alerte in-app élégante en fallback.
 *
 * Fire-and-forget : retourne void pour ne jamais bloquer l'appelant.
 */
export function simulateLocalPush(
  title:     string,
  body:      string,
  relatedId?: string,
): void {
  void (async () => {
    try {
      // Sur Android, s'assurer qu'un channel par défaut existe
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('panier-malin', {
          name:       'PanierMalin',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      // Vérification / demande de permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        // Notification système immédiate
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data:        { relatedId: relatedId ?? null },
            categoryIdentifier: 'panier-malin',
          },
          trigger: null, // null = affichage immédiat
        });
      } else {
        // Fallback in-app : simple Alert pour ne pas perdre l'information
        const { Alert } = await import('react-native');
        Alert.alert(title, body);
      }
    } catch {
      // Dernier recours silencieux — on ne bloque jamais l'UI pour les notifs
      try {
        const { Alert } = await import('react-native');
        Alert.alert(title, body);
      } catch { /* rien */ }
    }
  })();
}

// ─── Abonnement Realtime ──────────────────────────────────────────────────────

/**
 * S'abonne aux nouvelles notifications en temps réel pour l'utilisateur connecté.
 * Supabase applique la RLS sur les events → seules les notifications de cet
 * utilisateur sont reçues.
 *
 * @returns Fonction de nettoyage (unsubscribe) à appeler dans le cleanup de useEffect.
 */
export function subscribeToNotifications(
  userId:   string,
  onInsert: (notif: UserNotification) => void,
  onUpdate: () => void,
): () => void {
  const channel = supabase
    .channel(`notif-${userId}`)
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      {
        event:  'INSERT',
        schema: 'public',
        table:  'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload: { new: DbRow }) => {
        onInsert(rowToNotification(payload.new));
      }
    )
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        // Un UPDATE = marquage comme lu → on recalcule le badge
        onUpdate();
      }
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
