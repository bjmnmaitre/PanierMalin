// app/event/[id].tsx
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import EventExpensesScreen from '../../screens/EventExpensesScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';
import { settleEvent } from '../../services/api';

export default function EventRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <EventExpensesScreen
      eventId={id}
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onBack={() => router.back()}
      onShare={() => console.log('TODO: partager le lien d\'invitation événement', id)}
      onInvite={() => router.push('/community/invite')}
      onSettle={() => settleEvent(id).catch((err) => console.error('[EventRoute] settleEvent failed', err))}
    />
  );
}
