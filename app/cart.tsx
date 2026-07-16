import React from 'react';
import { useRouter } from 'expo-router';
import SmartCartScreen from '../screens/SmartCartScreen';

export default function CartRoute() {
  const router = useRouter();
  return <SmartCartScreen onBack={() => router.back()} />;
}
