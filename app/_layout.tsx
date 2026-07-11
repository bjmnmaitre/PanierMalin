import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootLayoutNav() {
  const { session, profile, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  React.useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/welcome');
      }
      return;
    }

    if (!profile) return;

    if (!profile.onboardingCompleted) {
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
      return;
    }

    if (inAuthGroup || inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [session, profile, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" options={{ presentation: 'card' }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="product/[ean]" options={{ presentation: 'card' }} />
      <Stack.Screen name="optimize" options={{ presentation: 'card' }} />
      <Stack.Screen name="baskets" options={{ presentation: 'card' }} />
      <Stack.Screen name="shopping-mode" options={{ presentation: 'card', headerShown: false }} />
      <Stack.Screen name="community/leaderboard" options={{ presentation: 'card' }} />
      <Stack.Screen name="community/invite" options={{ presentation: 'card' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#1D9E75' }} />;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}