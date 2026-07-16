// utils/_navHelpers.ts
import { TabKey } from '../components/BottomNav';

// Mappe les clés d'onglet vers les vraies routes expo-router.
// Structure à 5 onglets : Immanquables / Mes Listes / Je cherche (centre) / Communauté / Profil.
export const TAB_ROUTES: Record<TabKey, string> = {
  immanquables: '/(tabs)/immanquables',
  lists: '/(tabs)/lists',
  search: '/(tabs)',
  community: '/(tabs)/community',
  profile: '/(tabs)/profile',
};