// app/optimize.tsx
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import BasketOptimizationScreen from '../screens/BasketOptimizationScreen';
import { TabKey } from '../components/BottomNav';
import { TAB_ROUTES } from '../utils/_navHelpers';

export default function OptimizeRoute() {
  const router = useRouter();
  const { basketId } = useLocalSearchParams<{ basketId?: string }>();

  return (
    <BasketOptimizationScreen
      basketIdOrListId={basketId ?? 'default'}
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onValidateRoute={() => {
        console.log('[OptimizeRoute] Trajet validé avec succès !');
        
        // 🚀 FLUX PRINCIPAL : Redirection directe vers le Mode Course
        // On transmet le basketId pour charger la session correspondante
        router.push({
          pathname: '/shopping-mode',
          params: { basketId: basketId ?? 'default' },
        });
      }}
      onViewMap={() => {
        console.log('[OptimizeRoute] Ouverture du trajet cartographique');
      }}
    />
  );
}