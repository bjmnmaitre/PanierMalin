import { useRouter } from 'expo-router';
import ScannerPlaceholderScreen from '../../screens/ScannerPlaceholderScreen';

export type TabKey = 'home' | 'map' | 'scanner' | 'profile' | 'community';

const TAB_ROUTES: Record<TabKey, string> = {
  home: '/',
  map: '/map',
  scanner: '/scanner',
  profile: '/profile',
  community: '/community',
};

export default function ScannerTab() {
  const router = useRouter();

  return (
    <ScannerPlaceholderScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab])}
      onViewDemoProduct={() => router.push('/product/demo')}
    />
  );
}
