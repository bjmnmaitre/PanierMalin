// app/(tabs)/_layout.tsx
//
// IMPORTANT : on n'utilise PAS <Tabs> d'expo-router ici, parce que chaque
// écran affiche déjà son propre <BottomNav /> (composant custom avec notre
// design exact). Utiliser <Tabs> en plus créerait une double barre de
// navigation. On utilise un Stack avec animation désactivée pour simuler
// le comportement d'onglets (pas d'effet de pile qui s'accumule).

import React from 'react';
import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="scanner" />
      <Stack.Screen name="community" />
      <Stack.Screen name="lists" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
