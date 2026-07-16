// app/_layout.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { CoinRainProvider } from '../contexts/CoinRainContext';
import { CartProvider } from '../contexts/CartContext';
import { SplashOverlay, ErrorBoundary } from '../components/primitives';
import CoinsWatcher from '../components/features/CoinsWatcher';
import { initErrorReporting } from '../services/errorReporting';
import { ONBOARDING_KEY } from './onboarding';

// Crash reporter initialisé avant tout render (mode prod uniquement)
initErrorReporting();

// ─── Navigation protégée ─────────────────────────────────────────────────────

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const router   = useRouter();
  const segments = useSegments();

  // Gestion du fade-out du splash écran (opacity + scale-out pour effet premium)
  const splashOpacity  = useRef(new Animated.Value(1)).current;
  const splashScale    = useRef(new Animated.Value(1)).current;
  const [splashMounted, setSplashMounted] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      Animated.parallel([
        Animated.timing(splashOpacity, {
          toValue: 0, duration: 450, useNativeDriver: true,
        }),
        Animated.spring(splashScale, {
          toValue: 1.12, friction: 8, tension: 55, useNativeDriver: true,
        }),
      ]).start(() => setSplashMounted(false));
    }
  }, [isLoading, splashOpacity, splashScale]);

  useEffect(() => {
    if (isLoading) return;

    AsyncStorage.getItem(ONBOARDING_KEY)
      .catch(() => null)
      .then((val) => {
        const onboardingDone = val === 'true';

        const inAuthGroup  = segments[0] === '(auth)';
        const inOnboarding = segments[0] === 'onboarding';
        const inTabs       = segments[0] === '(tabs)';

        if (session) {
          if (inAuthGroup || inOnboarding) router.replace('/(tabs)');
        } else {
          if (!onboardingDone && !inOnboarding) {
            router.replace('/onboarding');
          } else if (onboardingDone && !inAuthGroup && !inTabs) {
            router.replace('/(auth)/welcome');
          }
        }
      });
  }, [session, isLoading, segments]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Transitions fondues pour éviter le flash blanc auth→tabs */}
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)"     options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)"     options={{ animation: 'fade' }} />
        <Stack.Screen name="product/[ean]"          options={{ presentation: 'card'  }} />
        <Stack.Screen name="optimize"               options={{ presentation: 'card'  }} />
        <Stack.Screen name="baskets"                options={{ presentation: 'card'  }} />
        <Stack.Screen name="scanner"                options={{ presentation: 'modal' }} />
        <Stack.Screen name="search"                 options={{ presentation: 'modal' }} />
        <Stack.Screen name="share-promo"            options={{ presentation: 'modal' }} />
        <Stack.Screen name="map"                    options={{ presentation: 'card'  }} />
        <Stack.Screen name="community/leaderboard"  options={{ presentation: 'card'  }} />
        <Stack.Screen name="community/invite"       options={{ presentation: 'card'  }} />
        <Stack.Screen name="promo/[id]"             options={{ presentation: 'card'  }} />
        <Stack.Screen name="rewards"                options={{ presentation: 'card'  }} />
        <Stack.Screen name="scan-receipt"           options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings"               options={{ presentation: 'card'  }} />
        <Stack.Screen name="stats"                  options={{ presentation: 'card'  }} />
        <Stack.Screen name="report-promo"           options={{ presentation: 'modal' }} />
        <Stack.Screen name="pro/dashboard"          options={{ presentation: 'card'  }} />
        <Stack.Screen name="notifications"          options={{ presentation: 'card'  }} />
        <Stack.Screen name="admin/claims"           options={{ presentation: 'card'  }} />
        <Stack.Screen name="store/[id]"             options={{ presentation: 'card'  }} />
      </Stack>

      {/* Splash avec fade-out fluide — évite le flash blanc entre l'auth et le premier écran */}
      {splashMounted && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]}>
          <SplashOverlay />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  // Splash statique (fonts pas encore prêts, pas de contexte auth)
  if (!fontsLoaded) {
    return <SplashOverlay />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <CoinRainProvider>
            <RootLayoutNav />
            <CoinsWatcher />
          </CoinRainProvider>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
