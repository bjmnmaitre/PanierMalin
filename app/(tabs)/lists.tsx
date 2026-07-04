// app/(tabs)/lists.tsx
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import MyListsScreen from '../../screens/MyListsScreen';
import ListDetailScreen from '../../screens/ListDetailScreen';
import { TabKey } from '../../components/BottomNav';
import { TAB_ROUTES } from '../../utils/_navHelpers';

// Type pour suivre la sous-navigation interne de l'onglet
type SubScreenState =
  | { mode: 'overview' }
  | { mode: 'detail'; listId: string; listName: string };

export default function ListsRoute() {
  const router = useRouter();
  
  // État local pour piloter l'affichage dynamique
  const [currentView, setCurrentView] = useState<SubScreenState>({ mode: 'overview' });

  // Si on est en mode détail, on affiche ListDetailScreen
  if (currentView.mode === 'detail') {
    return (
      <ListDetailScreen
        listId={currentView.listId}
        listName={currentView.listName}
        onBack={() => setCurrentView({ mode: 'overview' })}
      />
    );
  }

  // Sinon, on affiche l'écran principal des listes
  return (
    <MyListsScreen
      onNavigate={(tab: TabKey) => router.replace(TAB_ROUTES[tab] as any)}
      onSelectList={(id: string, name: string) => {
        setCurrentView({ mode: 'detail', listId: id, listName: name });
      }}
    />
  );
}