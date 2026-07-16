import { useRouter } from 'expo-router';
import ProDashboardScreen from '../../screens/ProDashboardScreen';

export default function ProDashboardRoute() {
  const router = useRouter();
  return <ProDashboardScreen onBack={() => router.back()} />;
}
