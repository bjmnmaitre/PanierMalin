// app/(tabs)/index.tsx
// 
// RÈGLE DE TRAITEMENT : Fichier intégral et autonome.
// Route de l'écran d'accueil Expo Router connecté à la v2.0.

import React from 'react';
import { useRouter } from 'expo-router';
import HomePlaceholderScreen from '../../screens/HomePlaceholderScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function HomeRoute() {
  const router = useRouter();

  const handleSearchSubmit = (naturalQuery: string) => {
    console.log('[HomeRoute] Requête naturelle interceptée :', naturalQuery);
    
    // Démo de routage : Si l'utilisateur cherche un produit précis, 
    // on le redirige vers l'EAN correspondant. Ici on utilise un EAN d'exemple "3017620422003"
    router.push({
      pathname: '/product/[ean]',
      params: { ean: '3017620422003' }
    });
  };

  return (
    <HomePlaceholderScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onScan={() => router.replace(TAB_ROUTES.scanner as any)}
      onViewBaskets={() => router.replace(TAB_ROUTES.lists as any)}
      onSearchSubmit={handleSearchSubmit}
    />
  );
}