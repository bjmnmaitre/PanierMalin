// components/BottomNav.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

export type TabKey = 'home' | 'scanner' | 'community' | 'lists' | 'profile';

interface BottomNavProps {
  active: TabKey;
  onNavigate: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'home', label: 'Accueil', icon: 'home' },
  { key: 'scanner', label: 'Scanner', icon: 'qr-code-scanner' },
  { key: 'community', label: 'Communauté', icon: 'groups' },
  { key: 'lists', label: 'Listes', icon: 'receipt-long' },
  { key: 'profile', label: 'Profil', icon: 'person' },
];

export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <View style={styles.nav}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabButton}
            onPress={() => onNavigate(tab.key)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={tab.icon}
              size={24}
              color={isActive ? Colors.primary : Colors.textSecondary}
            />
            <Text
              style={[
                Typography.labelSm,
                { color: isActive ? Colors.primary : Colors.textSecondary, textTransform: 'none', marginTop: 2 },
                isActive && { fontFamily: 'Inter_600SemiBold' },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});
