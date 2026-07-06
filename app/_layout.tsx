// app/_layout.tsx
import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  React.useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Pas connecté et pas déjà sur un écran d'auth → redirection
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      // Connecté mais encore sur un écran d'auth → redirection vers l'app
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="product/[ean]" options={{ presentation: 'card' }} />
      <Stack.Screen name="optimize" options={{ presentation: 'card' }} />
      <Stack.Screen name="baskets" options={{ presentation: 'card' }} />
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