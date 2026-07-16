import { useRouter } from 'expo-router';
import ScanReceiptScreen from '../screens/ScanReceiptScreen';

export default function ScanReceiptRoute() {
  const router = useRouter();
  return <ScanReceiptScreen onBack={() => router.back()} />;
}
