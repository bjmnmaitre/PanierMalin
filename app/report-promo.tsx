import { useRouter } from 'expo-router';
import ReportPromoScreen from '../screens/ReportPromoScreen';

export default function ReportPromoRoute() {
  const router = useRouter();
  return (
    <ReportPromoScreen
      onBack={() => router.back()}
      onPublished={() => router.back()}
    />
  );
}
