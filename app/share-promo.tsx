import React from 'react';
import { useRouter } from 'expo-router';
import SharePromoScreen from '@/screens/SharePromoScreen';

export default function SharePromoRoute() {
  const router = useRouter();
  return (
    <SharePromoScreen
      onBack={() => router.back()}
      onPublished={() => router.back()}
    />
  );
}
