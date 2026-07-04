// app/(tabs)/scanner.tsx
import React from 'react';
import { useRouter } from 'expo-router';
import ScannerPlaceholderScreen from '../../screens/ScannerPlaceholderScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function ScannerRoute() {
  const router = useRouter();

  return (
    <ScannerPlaceholderScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onViewDemoProduct={() => router.push('/product/3017620422003')}
    />
  );
}
