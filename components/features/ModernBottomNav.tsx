// components/features/ModernBottomNav.tsx
// Modern bottom tab navigation bar - 5 equal squares, active tab subtly emphasized

import React, { useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, shadows, radii } from '@/design';
import { triggerSelection } from '@/utils/haptics';

export type TabKey = 'immanquables' | 'lists' | 'search' | 'community' | 'profile';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconActive: keyof typeof MaterialIcons.glyphMap;
}

const TABS: TabConfig[] = [
  { key: 'immanquables', label: 'Immanq.', icon: 'local-fire-department', iconActive: 'local-fire-department' },
  { key: 'lists', label: 'Listes', icon: 'list-alt', iconActive: 'list-alt' },
  { key: 'search', label: 'Cherche', icon: 'search', iconActive: 'search' },
  { key: 'community', label: 'Commu.', icon: 'people-outline', iconActive: 'people' },
  { key: 'profile', label: 'Profil', icon: 'person-outline', iconActive: 'person' },
];

export interface ModernBottomNavProps {
  active: TabKey;
  onNavigate: (tab: TabKey) => void;
  showLabels?: boolean;
  testID?: string;
}

// ── Onglet individuel avec spring élastique ───────────────────────────────────

function TabButton({
  tab, isActive, onPress, showLabels,
}: {
  tab: TabConfig;
  isActive: boolean;
  onPress: () => void;
  showLabels: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.78, speed: 50, bounciness: 0, useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.00, speed: 16, bounciness: 14, useNativeDriver: true,
      }),
    ]).start();
    onPress();
  }, [scale, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.square}
      accessible
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.label}
      hitSlop={4}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
          <MaterialIcons
            name={isActive ? tab.iconActive : tab.icon}
            size={22}
            color={isActive ? colors.primary : colors.text.tertiary}
          />
        </View>
        {showLabels && (
          <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
            {tab.label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Bottom Navigation Bar - 5 equal-width squares.
 * The active tab is subtly emphasized (tinted background + raised icon)
 * without changing its size relative to the others.
 *
 * @example
 * <ModernBottomNav active="search" onNavigate={(tab) => router.push(`/${tab}`)} />
 */
const ModernBottomNav = React.memo(function ModernBottomNav({
  active,
  onNavigate,
  showLabels = true,
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
      {TABS.map(tab => (
        <TabButton
          key={tab.key}
          tab={tab}
          isActive={tab.key === active}
          onPress={() => { void handlePress(tab.key); }}
          showLabels={showLabels}
        />
      ))}
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

  square: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },

  tabInner: {
    alignItems: 'center',
  },

  // Neutral icon container - same size whether active or not
  iconBox: {
    width: 40,
    height: 32,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Active state: subtle tint background only - no size change
  iconBoxActive: {
    backgroundColor: colors.primary_light,
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