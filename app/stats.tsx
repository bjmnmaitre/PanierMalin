import { useRouter } from 'expo-router';
import StatsDashboardScreen from '../screens/StatsDashboardScreen';

export default function StatsRoute() {
  const router = useRouter();
  return <StatsDashboardScreen onBack={() => router.back()} />;
}
