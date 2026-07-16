// app/(tabs)/index.tsx
//
// Route de l'écran central "Je cherche..." (onglet 3/5, affiché par défaut
// à l'ouverture de l'app après connexion). Fusionne recherche + carte.

import React from 'react';
import { useRouter } from 'expo-router';
import SearchMapScreen from '../../screens/SearchMapScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function SearchRoute() {
  const router = useRouter();

  return (
    <SearchMapScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onScan={() => router.push('/scanner')}
      onSearchPress={() => router.push('/search')}
      onProductFound={(ean: string) => {
        router.push({
          pathname: '/product/[ean]',
          params: { ean },
        });
      }}
    />
  );
}