// app/scanner.tsx
//
// Modal de scan, accessible depuis n'importe quel onglet (icône caméra sur
// l'écran "Je cherche..."). N'est pas un onglet de la tab bar.

import React from 'react';
import { useRouter } from 'expo-router';
import ScannerPlaceholderScreen from '../screens/ScannerPlaceholderScreen';

export default function ScannerRoute() {
  const router = useRouter();

  return (
    <ScannerPlaceholderScreen
      onClose={() => router.back()}
      onProductScanned={(ean: string) => {
        router.back();
        router.push(`/product/${ean}`);
      }}
      onViewDemoProduct={() => router.push('/product/3017620422003')}
    />
  );
}