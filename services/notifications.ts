import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Comportement des notifications reçues quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('paniermalin', {
      name: 'PanierMalin — Alertes promos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B00',
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Alerte de proximité ──────────────────────────────────────────────────────
// Déclenche une notification locale ~3 s après l'ajout d'un magasin favori.

export async function scheduleProximityAlert(storeName: string): Promise<void> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🛒 Nouvelle promo dans ton magasin !',
        body: `Une promo vient d'être signalée dans ton ${storeName} favori. Profites-en vite !`,
        data: { storeName },
        sound: true,
        categoryIdentifier: 'promo_alert',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 3,
        repeats: false,
      },
    });
  } catch (err) {
    console.warn('[Notifications] scheduleProximityAlert failed:', err);
  }
}

// ─── Alerte géo-proximité ─────────────────────────────────────────────────────
// Déclenche une notification immédiate quand l'utilisateur passe à proximité
// d'un magasin favori. Le corps du message est personnalisé par l'appelant.

export async function scheduleGeoProximityAlert(
  storeName: string,
  body: string,
): Promise<void> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `📍 ${storeName} est à portée !`,
        body,
        data: { storeName },
        sound: true,
      },
      trigger: null, // immédiat
    });
  } catch (err) {
    console.warn('[Notifications] scheduleGeoProximityAlert failed:', err);
  }
}

// ─── Nettoyage ────────────────────────────────────────────────────────────────

export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
