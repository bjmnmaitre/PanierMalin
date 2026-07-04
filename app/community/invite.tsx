// app/community/invite.tsx
import React from 'react';
import { useRouter } from 'expo-router';
import InviteFriendsScreen from '../../screens/InviteFriendsScreen';

export default function InviteRoute() {
  const router = useRouter();

  return <InviteFriendsScreen onBack={() => router.back()} />;
}
