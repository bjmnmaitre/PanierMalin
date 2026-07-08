import { useRouter } from 'expo-router';
import HomePlaceholderScreen from '../../screens/HomePlaceholderScreen';

export type TabKey = 'home' | 'map' | 'scanner' | 'profile' | 'community';

const TAB_ROUTES: Record<TabKey, string> = {
  home: '/',
  map: '/map',
  scanner: '/scanner',
  profile: '/profile',
  community: '/community',
};

export default function HomeTab() {
  const router = useRouter();

  return (
    <HomePlaceholderScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab])}
      onScan={() => router.push('/scanner')}
      onViewBaskets={() => router.push('/(tabs)/profile')}
      onOpenMap={() => router.push('/map')}
      onSearchSubmit={(query: string) => console.log('Search:', query)}
    />
  );
}
