// app/(tabs)/community.tsx
import React from 'react';
import { useRouter } from 'expo-router';
import CommunityFeedScreen from '../../screens/CommunityFeedScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function CommunityRoute() {
  const router = useRouter();

  return (
    <CommunityFeedScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onOpenLeaderboard={() => router.push('/community/leaderboard')}
      onInviteFriends={() => router.push('/community/invite')}
    />
  );
}
