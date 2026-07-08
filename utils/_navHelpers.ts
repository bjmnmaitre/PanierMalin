// app/_navHelpers.ts
import { TabKey } from '../components/BottomNav';

// Mappe les clés d'onglet (utilisées par BottomNav) vers les vraies routes expo-router.
export const TAB_ROUTES: Record<TabKey, string> = {
  home: '/(tabs)',
  scanner: '/(tabs)/scanner',
  map: '/(tabs)/map',
  community: '/(tabs)/community',
  lists: '/(tabs)/lists',
  profile: '/(tabs)/profile',
};
