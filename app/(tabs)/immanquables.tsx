// app/(tabs)/immanquables.tsx
//
// Route de l'écran "Immanquables" (onglet 1/5).

import React from 'react';
import { useRouter } from 'expo-router';
import ImmanquablesScreen, { DealItem } from '../../screens/ImmanquablesScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function ImmanquablesRoute() {
  const router = useRouter();

  return (
    <ImmanquablesScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onSelectDeal={(deal: DealItem) => {
        if (deal.ean) {
          router.push({
            pathname: '/product/[ean]',
            params: { ean: deal.ean },
          });
        }
      }}
    />
  );
}