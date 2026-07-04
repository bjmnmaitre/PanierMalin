// app/community/leaderboard.tsx
import React from 'react';
import { useRouter } from 'expo-router';
import LeaderboardScreen from '../../screens/LeaderboardScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function LeaderboardRoute() {
  const router = useRouter();

  return (
    <LeaderboardScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onBack={() => router.back()}
    />
  );
}
