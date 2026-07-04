// app/(tabs)/profile.tsx
import React from 'react';
import { useRouter } from 'expo-router';
import ProfilePlaceholderScreen from '../../screens/ProfilePlaceholderScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

export default function ProfileRoute() {
  const router = useRouter();

  return (
    <ProfilePlaceholderScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onViewBaskets={() => router.push('/baskets')}
      onInviteFriends={() => router.push('/community/invite')}
    />
  );
}
