// components/primitives/Badge.tsx
// Status badges, tags, labels
// Supports: 6 variants (primary, secondary, success, warning, error, info) × 2 sizes

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '@/design';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onClose?: () => void;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Professional Badge Component
 *
 * @example
 * <Badge label="Nouveau" variant="success" />
 *
 * @example
 * <Badge label="-15%" variant="secondary" icon="local-offer" />
 *
 * @example
 * <Badge label="Filtre actif" variant="info" onClose={handleRemoveFilter} />
 */
const Badge = React.memo(function Badge({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  onClose,
  style,
  testID,
}: BadgeProps) {

  const containerStyle = useMemo<ViewStyle[]>(
    () => [
      styles.container,
      styles[`container_${variant}`],
      styles[`container_${size}`],
      style,
    ].filter(Boolean) as ViewStyle[],
    [variant, size, style]
  );

  const textStyleCombined = useMemo<TextStyle[]>(
    () => [
      styles.text,
      styles[`text_${variant}`],
      styles[`text_${size}`],
    ],
    [variant, size]
  );

  const iconSize = size === 'sm' ? 12 : 14;
  const iconColor = colors.white;

  return (
    <View style={containerStyle} testID={testID}>
      {icon && (
        <MaterialIcons
          name={icon}
          size={iconSize}
          color={iconColor}
          style={styles.icon}
        />
      )}
      <Text style={textStyleCombined} numberOfLines={1}>
        {label}
      </Text>
      {onClose && (
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        >
          <MaterialIcons
            name="close"
            size={iconSize}
            color={iconColor}
            style={styles.closeIcon}
          />
        </Pressable>
      )}
    </View>
  );
});

Badge.displayName = 'Badge';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },

  // Variants
  container_primary: {
    backgroundColor: colors.primary,
  },
  container_secondary: {
    backgroundColor: colors.secondary,
  },
  container_success: {
    backgroundColor: colors.success,
  },
  container_warning: {
    backgroundColor: colors.warning,
  },
  container_error: {
    backgroundColor: colors.error,
  },
  container_info: {
    backgroundColor: colors.info,
  },

  // Sizes
  container_sm: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  container_md: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },

  text: {
    textAlign: 'center',
  },
  text_primary: {
    color: colors.white,
  },
  text_secondary: {
    color: colors.white,
  },
  text_success: {
    color: colors.white,
  },
  text_warning: {
    color: colors.white,
  },
  text_error: {
    color: colors.white,
  },
  text_info: {
    color: colors.white,
  },
  text_sm: {
    ...typography.labelSmall,
  },
  text_md: {
    ...typography.labelMedium,
  },

  icon: {
    marginRight: spacing[1],
  },

  closeIcon: {
    marginLeft: spacing[1],
  },
});

export default Badge;
export type { BadgeVariant, BadgeSize };