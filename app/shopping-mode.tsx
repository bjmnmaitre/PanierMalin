import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ShoppingModeScreen from '@/screens/ShoppingModeScreen';

export default function ShoppingModeRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listId: string }>();
  const listId = Array.isArray(params.listId) ? params.listId[0] : params.listId;

  if (!listId) {
    return null;
  }

  return <ShoppingModeScreen listId={listId} onBack={() => router.back()} />;
}