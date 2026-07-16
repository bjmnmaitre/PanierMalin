// app/scanner.tsx
// Modal scanner plein écran — s'ouvre immédiatement sur la caméra.
// Permissions, overlay et debounce sont gérés dans ScannerView.
import React from 'react';
import { useRouter } from 'expo-router';
import ScannerView from '@/components/ScannerView';

export default function ScannerModal() {
  const router = useRouter();

  return (
    <ScannerView
      onClose={() => router.back()}
      onBarcodeScanned={(ean: string) => {
        router.back();
        router.push({ pathname: '/product/[ean]', params: { ean } });
      }}
    />
  );
}
