
import React from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import SavedBasketsScreen from '../screens/SavedBasketsScreen';
import { type TabKey } from '../components/features/ModernBottomNav';
import { TAB_ROUTES } from '../utils/_navHelpers';

export default function BasketsRoute() {
  const router = useRouter();

  return (
    <SavedBasketsScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onOptimize={(basketId: string) => router.push({ pathname: '/optimize', params: { basketId } })}
      onEditBasket={() => {
        Alert.alert('Bientôt disponible', "La modification d'un panier habituel arrive dans une prochaine mise à jour.");
      }}
      onCreateBasket={() => {
        Alert.alert('Bientôt disponible', "La création d'un panier habituel arrive dans une prochaine mise à jour.");
      }}
    />
  );
}
