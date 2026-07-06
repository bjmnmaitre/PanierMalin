// components/features/Header.tsx
// Screen header with title, back button, and action buttons

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/design';

export interface HeaderAction {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: number;
}

export interface HeaderProps {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  actions?: HeaderAction[];
  transparent?: boolean;
  testID?: string;
}

/**
 * Professional Header Component
 *
 * @example
 * <Header
 *   title="Mes listes"
 *   onBackPress={() => router.back()}
 *   actions={[
 *     { icon: 'add', onPress: handleAdd, accessibilityLabel: 'Ajouter' },
 *     { icon: 'notifications', onPress: handleNotifs, accessibilityLabel: 'Notifications', badge: 3 },
 *   ]}
 * />
 */
const Header = React.memo(function Header({
  title,
  subtitle,
  onBackPress,
  actions,
  transparent = false,
  testID,
}: HeaderProps) {

  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing[2] },
        transparent && styles.transparent,
      ]}
      testID={testID}
    >
      <View style={styles.row}>
        {/* Back button */}
        {onBackPress && (
          <Pressable
            onPress={onBackPress}
            style={styles.backButton}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
        )}

        {/* Title + subtitle */}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Action buttons */}
        {actions && actions.length > 0 && (
          <View style={styles.actionsRow}>
            {actions.map((action, index) => (
              <Pressable
                key={index}
                onPress={action.onPress}
                style={styles.actionButton}
                hitSlop={8}
                accessible
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
              >
                <MaterialIcons name={action.icon} size={24} color={colors.text.primary} />
                {action.badge !== undefined && action.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {action.badge > 9 ? '9+' : action.badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

Header.displayName = 'Header';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[4],
  },

  transparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  backButton: {
    marginRight: spacing[2],
    padding: spacing[1],
  },

  titleContainer: {
    flex: 1,
  },

  title: {
    ...typography.h3,
    color: colors.text.primary,
  },

  subtitle: {
    ...typography.captionLarge,
    color: colors.text.secondary,
    marginTop: 2,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },

  actionButton: {
    padding: spacing[1],
    position: 'relative',
  },

  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },

  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
});

export default Header;