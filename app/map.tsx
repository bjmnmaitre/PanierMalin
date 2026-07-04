// app/map.tsx
import React from 'react';
import { useRouter } from 'expo-router';
import LiveMapScreen from '../screens/LiveMapScreen';
import { TabKey } from '../components/BottomNav';
import { TAB_ROUTES } from '../utils/_navHelpers';

export default function MapRoute() {
  const router = useRouter();

  return (
    <LiveMapScreen
      onNavigate={(tab: TabKey) => {
        // Redirection vers l'onglet sélectionné
        router.replace(TAB_ROUTES[tab] as any);
      }}
    />
  );
}