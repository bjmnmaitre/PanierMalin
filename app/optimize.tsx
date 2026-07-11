import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import BasketOptimizationScreen from '@/screens/BasketOptimizationScreen';

export default function OptimizeRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listId?: string; listName?: string }>();
  const listId = Array.isArray(params.listId) ? params.listId[0] : params.listId;
  const listName = Array.isArray(params.listName) ? params.listName[0] : params.listName;

  if (!listId) {
    return null;
  }

  return (
    <BasketOptimizationScreen
      listId={listId}
      listName={listName}
      onBack={() => router.back()}
      onValidateRoute={() => {
        router.push({
          pathname: '/shopping-mode',
          params: { listId },
        });
      }}
      onViewMap={() => router.push('/(tabs)/map')}
    />
  );
}
