// app/product/[ean].tsx
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ProductComparisonScreen from '../../screens/ProductComparisonScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';
import { confirmPriceWithPhoto, reportDifferentPrice } from '../../services/api';

export default function ProductRoute() {
  const router = useRouter();
  const { ean } = useLocalSearchParams<{ ean: string }>();

  return (
    <ProductComparisonScreen
      ean={ean}
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onBack={() => router.back()}
      onAddToList={() => router.push('/(tabs)/lists')}
      onConfirmWithPhoto={() => {
        // TODO : ouvrir la vraie caméra, puis appeler confirmPriceWithPhoto()
        confirmPriceWithPhoto(ean, 'demo-store', 'demo-photo-uri').then((r) =>
          console.log('Points gagnés :', r.pointsEarned)
        );
      }}
      onReportDifferentPrice={() => {
        reportDifferentPrice(ean, 'demo-store', 0);
      }}
    />
  );
}
