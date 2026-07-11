import React from 'react';
import { useRouter } from 'expo-router';
import OnboardingScreen from '@/screens/OnboardingScreen';
import { useAuth } from '@/contexts/AuthContext';

export default function OnboardingRoute() {
  const router = useRouter();
  const { refreshProfile } = useAuth();

  return (
    <OnboardingScreen
      onComplete={async () => {
        await refreshProfile();
        router.replace('/(tabs)');
      }}
    />
  );
}