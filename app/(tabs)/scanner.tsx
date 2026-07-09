// app/(tabs)/scanner.tsx
//
// Route de l'onglet Scanner. Branche désormais le vrai scan caméra sur la
// recherche produit réelle : dès qu'un code-barres est reconnu, on navigue
// vers app/product/[ean].tsx (qui existait déjà et appelle getProductByEan).
// Avant ce chantier, l'onglet Scanner affichait uniquement un message
// "bientôt disponible", sans aucun lien vers cette route pourtant
// fonctionnelle.

import React from 'react';
import { useRouter } from 'expo-router';
import ScannerPlaceholderScreen from '../../screens/ScannerPlaceholderScreen';
import { type TabKey } from '../../components/features/ModernBottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function ScannerTab() {
  const router = useRouter();

  return (
    <ScannerPlaceholderScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onProductScanned={(ean: string) => router.push(`/product/${ean}`)}
      onViewDemoProduct={() => router.push('/product/demo')}
    />
  );
}
