import { TabKey } from '../components/BottomNav';

export const TAB_ROUTES: Record<TabKey, string> = {
  home: '/(tabs)',
  scanner: '/(tabs)/scanner',
  map: '/map',
  lists: '/(tabs)/lists',
  community: '/(tabs)/community',
  profile: '/(tabs)/profile',
  radar: '/(tabs)/radar', // Ajout de la route pour le radar
};