// components/features/ModernBottomNav.tsx
// Modern bottom tab navigation bar with icons and active state
// Exports TabKey properly for use across the app

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, shadows } from '@/design';
import { triggerSelection } from '@/utils/haptics';

export type TabKey = 'home' | 'scanner' | 'map' | 'lists' | 'community' | 'profile';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconActive: keyof typeof MaterialIcons.glyphMap;
}

const TABS: TabConfig[] = [
  { key: 'home', label: 'Accueil', icon: 'home', iconActive: 'home' },
  { key: 'scanner', label: 'Scanner', icon: 'qr-code-scanner', iconActive: 'qr-code-scanner' },
  { key: 'map', label: 'Carte', icon: 'map', iconActive: 'map' },
  { key: 'lists', label: 'Listes', icon: 'list-alt', iconActive: 'list-alt' },
  { key: 'community', label: 'Communauté', icon: 'people-outline', iconActive: 'people' },
  { key: 'profile', label: 'Profil', icon: 'person-outline', iconActive: 'person' },
];

export interface ModernBottomNavProps {
  active: TabKey;
  onNavigate: (tab: TabKey) => void;
  testID?: string;
}

/**
 * Modern Bottom Navigation Bar
 *
 * @example
 * <ModernBottomNav active="home" onNavigate={(tab) => router.push(`/${tab}`)} />
 */
const ModernBottomNav = React.memo(function ModernBottomNav({
  active,
  onNavigate,
  testID,
}: ModernBottomNavProps) {

  const insets = useSafeAreaInsets();

  const handlePress = React.useCallback(
    async (tab: TabKey) => {
      if (tab === active) return;
      await triggerSelection();
      onNavigate(tab);
    },
    [active, onNavigate]
  );

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing[2]) },
      ]}
      testID={testID}
    >
      {TABS.map(tab => {
        const isActive = tab.key === active;

        return (
          <Pressable
            key={tab.key}
            onPress={() => handlePress(tab.key)}
            style={styles.tabButton}
            accessible
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            hitSlop={4}
          >
            {isActive && <View style={styles.activeIndicator} />}

            <MaterialIcons
              name={isActive ? tab.iconActive : tab.icon}
              size={24}
              color={isActive ? colors.primary : colors.text.tertiary}
            />

            <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

ModernBottomNav.displayName = 'ModernBottomNav';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing[2],
    paddingHorizontal: spacing[1],
    ...shadows.lg,
  },

  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[1],
    position: 'relative',
  },

  activeIndicator: {
    position: 'absolute',
    top: -spacing[2],
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  label: {
    ...typography.captionSmall,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default ModernBottomNav;