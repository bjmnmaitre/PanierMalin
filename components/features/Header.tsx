// components/features/Header.tsx
// Screen header with title, back button, and action buttons

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/design';
import Logo from '@/components/primitives/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { getUnreadCount, subscribeToNotifications } from '@/services/notificationService';

export interface HeaderAction {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: number;
}

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  /** Affiche le logo PanierMalin complet à la place du titre. Ignoré si title est fourni. */
  showLogo?: boolean;
  onBackPress?: () => void;
  actions?: HeaderAction[];
  transparent?: boolean;
  testID?: string;
  /** Affiche la cloche de notifications avec badge en temps réel. */
  showNotificationBell?: boolean;
  onNotificationPress?: () => void;
}

// ─── NotificationBell ─────────────────────────────────────────────────────────

function NotificationBell({ onPress }: { onPress: () => void }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;

    // Charge le compteur initial
    getUnreadCount().then(setCount).catch(() => { /* silencieux */ });

    // Abonnement Realtime : INSERT → +1 ; UPDATE → re-fetch
    cleanupRef.current = subscribeToNotifications(
      user.id,
      () => setCount((prev) => prev + 1),
      () => { getUnreadCount().then(setCount).catch(() => { /* silencieux */ }); },
    );

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [user]);

  return (
    <Pressable
      onPress={onPress}
      style={styles.actionButton}
      hitSlop={8}
      accessible
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${count} notifications non lues` : 'Notifications'}
    >
      <MaterialIcons name="notifications-none" size={24} color={colors.text.primary} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
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
  showLogo = false,
  onBackPress,
  actions,
  transparent = false,
  testID,
  showNotificationBell = false,
  onNotificationPress,
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

        {/* Title / Logo */}
        <View style={styles.titleContainer}>
          {title ? (
            <>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              {subtitle && (
                <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
              )}
            </>
          ) : showLogo ? (
            <Logo variant="full" size={28} />
          ) : null}
        </View>

        {/* Action buttons */}
        {(actions && actions.length > 0 || showNotificationBell) && (
          <View style={styles.actionsRow}>
            {actions?.map((action, index) => (
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
            {showNotificationBell && onNotificationPress && (
              <NotificationBell onPress={onNotificationPress} />
            )}
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