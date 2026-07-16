// utils/haptics.ts
// Wrappers autour d'expo-haptics pour un retour haptique cohérent dans l'app.
// Chaque fonction est silencieuse sur les appareils sans moteur haptique.

import * as Haptics from 'expo-haptics';

export const triggerSelection = (): Promise<void> =>
  Haptics.selectionAsync().catch(() => undefined);

export const triggerLight = (): Promise<void> =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

export const triggerMedium = (): Promise<void> =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

export const triggerHeavy = (): Promise<void> =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);

export const triggerSuccess = (): Promise<void> =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

export const triggerWarning = (): Promise<void> =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);

export const triggerError = (): Promise<void> =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);

export default {
  triggerSelection,
  triggerLight,
  triggerMedium,
  triggerHeavy,
  triggerSuccess,
  triggerWarning,
  triggerError,
};
