import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

// Re-export du type exact attendu par l'ensemble de l'application
export type TabKey = 'home' | 'scanner' | 'map' | 'lists' | 'community' | 'profile' | 'radar';

interface BottomNavProps {
  active?: TabKey;
  onNavigate?: (tab: TabKey) => void;
}

interface NavItem {
  name: TabKey;
  label: string;
  icon: string;
  activeIcon: string;
  route: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'home', label: 'Accueil', icon: 'home-outline', activeIcon: 'home', route: '/(tabs)' },
  { name: 'scanner', label: 'Scanner', icon: 'barcode-outline', activeIcon: 'barcode', route: '/(tabs)/scanner' },
  { name: 'map', label: 'Carte', icon: 'map-outline', activeIcon: 'map', route: '/map' },
  { name: 'lists', label: 'Listes', icon: 'list-outline', activeIcon: 'list', route: '/(tabs)/lists' },
  { name: 'community', label: 'Communauté', icon: 'people-outline', activeIcon: 'people', route: '/(tabs)/community' },
  { name: 'profile', label: 'Profil', icon: 'person-outline', activeIcon: 'person', route: '/(tabs)/profile' },
];

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Détermine la tab active : priorité absolue à la prop passée, sinon fallback sur le pathname actuel
  const getActiveTab = (): TabKey => {
    if (active) return active;
    if (pathname.includes('scanner')) return 'scanner';
    if (pathname.includes('map')) return 'map';
    if (pathname.includes('lists')) return 'lists';
    if (pathname.includes('community')) return 'community';
    if (pathname.includes('profile')) return 'profile';
    return 'home';
  };

  const currentActive = getActiveTab();

  const handlePress = (item: NavItem) => {
    // Si l'ancien écran gère la navigation manuellement via onNavigate
    if (onNavigate) {
      onNavigate(item.name);
    } else {
      // Sinon on utilise le nouveau système de routing d'Expo Router
      router.push(item.route as any);
    }
  };

  return (
    <View style={styles.navBar}>
      {NAV_ITEMS.map((item, idx) => {
        const isActive = currentActive === item.name;
        return (
          <TouchableOpacity 
            key={idx} 
            onPress={() => handlePress(item)} 
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={(isActive ? item.activeIcon : item.icon) as any} 
              size={24} 
              color={isActive ? (Colors.primary || '#007AFF') : '#8E8E93'} 
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    height: 60,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});