import { useRouter } from 'expo-router';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';

export default function NotificationsRoute() {
  const router = useRouter();
  return <NotificationCenterScreen onBack={() => router.back()} />;
}
