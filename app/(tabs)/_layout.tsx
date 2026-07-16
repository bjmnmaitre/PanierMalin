// app/(tabs)/_layout.tsx
//
// IMPORTANT : on n'utilise PAS <Tabs> d'expo-router ici, parce que chaque
// écran affiche déjà son propre <BottomNav /> (composant custom avec notre
// design exact). Utiliser <Tabs> en plus créerait une double barre de
// navigation. On utilise un Stack avec animation désactivée pour simuler
// le comportement d'onglets (pas d'effet de pile qui s'accumule).
//
// 5 routes = 5 onglets validés : index (Je cherche, centre), immanquables,
// lists, community, profile. Le scanner est sorti du groupe (tabs) — voir
// app/scanner.tsx, accessible en modal depuis n'importe quel onglet.

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
      <Stack.Screen name="immanquables" />
      <Stack.Screen name="lists" />
      <Stack.Screen name="community" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}