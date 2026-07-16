import { useLocalSearchParams, useRouter } from 'expo-router';
import PromoDetailScreen from '../../screens/PromoDetailScreen';

export default function PromoDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <PromoDetailScreen promoId={id} onBack={() => router.back()} />;
}
