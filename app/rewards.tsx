import { useRouter } from 'expo-router';
import RewardsScreen from '../screens/RewardsScreen';

export default function RewardsRoute() {
  const router = useRouter();
  return <RewardsScreen onBack={() => router.back()} />;
}
