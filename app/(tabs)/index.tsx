import React from 'react';
import { useRouter } from 'expo-router';
import HomePlaceholderScreen from '../../screens/HomePlaceholderScreen';
import { type TabKey } from '../../components/features/ModernBottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function HomeRoute() {
  const router = useRouter();

  return (
    <HomePlaceholderScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onOptimize={() => router.push('/optimize')}
    />
  );
}
