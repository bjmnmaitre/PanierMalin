import React from 'react';
import { useRouter } from 'expo-router';
import UniversalSearchScreen from '@/screens/UniversalSearchScreen';

export default function SearchRoute() {
  const router = useRouter();

  return <UniversalSearchScreen onBack={() => router.back()} />;
}
