// components/primitives/Button.tsx
// Professional, accessible, fully-featured button component
// Supports: 4 variants × 3 sizes × multiple states + icons + loading

import React, { useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radii, shadows } from '@/design';
import { triggerSelection } from '@/utils/haptics';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonState = 'default' | 'loading' | 'disabled' | 'error';

export interface ButtonProps {
  label: string;
  onPress: (e?: GestureResponderEvent) => void | Promise<void>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
}

/**
 * Professional Button Component
 *
 * @example
 * <Button label="Save" variant="primary" onPress={handleSave} />
 */
const Button = React.memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
  style,
  textStyle,
  haptic = true,
}: ButtonProps) {

  const isDisabled = disabled || loading;

  const containerStyles = useMemo<ViewStyle[]>(
    () =>
      [
        styles.button,
        styles[`button_${variant}`],
        styles[`button_${size}`],
        isDisabled && styles.buttonDisabled,
        fullWidth && styles.buttonFullWidth,
        style,
      ].filter(Boolean) as ViewStyle[],
    [variant, size, isDisabled, fullWidth, style]
  );

  const labelStyles = useMemo<TextStyle[]>(
    () =>
      [
        styles.label,
        styles[`label_${variant}`],
        styles[`label_${size}`],
        isDisabled && styles.labelDisabled,
        textStyle,
      ].filter(Boolean) as TextStyle[],
    [variant, size, isDisabled, textStyle]
  );

  const iconSize = useMemo(() => {
    const sizesMap = { sm: 14, md: 16, lg: 18 };
    return sizesMap[size];
  }, [size]);

  const iconColor = useMemo(() => {
    if (variant === 'outline' || variant === 'ghost') return colors.primary;
    return colors.white;
  }, [variant]);

  const handlePress = useCallback(
    async (e: GestureResponderEvent) => {
      if (isDisabled) return;

      if (haptic) {
        await triggerSelection();
      }

      onPress?.(e);
    },
    [onPress, isDisabled, haptic]
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      android_ripple={{
        color: 'rgba(0, 0, 0, 0.1)',
        borderless: false,
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        ...containerStyles,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {icon && iconPosition === 'left' && !loading && (
        <MaterialIcons
          name={icon}
          size={iconSize}
          color={iconColor}
          style={styles.iconLeft}
        />
      )}

      {loading && (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.white}
          size={iconSize}
          style={styles.spinner}
        />
      )}

      <Text style={labelStyles} numberOfLines={1} allowFontScaling={false}>
        {label}
      </Text>

      {icon && iconPosition === 'right' && !loading && (
        <MaterialIcons
          name={icon}
          size={iconSize}
          color={iconColor}
          style={styles.iconRight}
        />
      )}
    </Pressable>
  );
});

Button.displayName = 'Button';

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    gap: spacing[1],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    minHeight: 44,
    ...shadows.sm,
  },

  button_primary: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },

  button_secondary: {
    backgroundColor: colors.secondary,
    borderWidth: 0,
  },

  button_outline: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },

  button_ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },

  button_sm: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    minHeight: 36,
  },

  button_md: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    minHeight: 44,
  },

  button_lg: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    minHeight: 52,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  labelDisabled: {
    opacity: 0.7,
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  buttonFullWidth: {
    width: '100%',
  },

  label: {
    ...typography.labelMedium,
    textAlign: 'center',
    flex: 0,
  },

  label_primary: {
    color: colors.white,
  },

  label_secondary: {
    color: colors.white,
  },

  label_outline: {
    color: colors.primary,
  },

  label_ghost: {
    color: colors.primary,
  },

  label_sm: {
    ...typography.labelSmall,
    fontSize: 12,
  },

  label_md: {
    ...typography.labelMedium,
    fontSize: 14,
  },

  label_lg: {
    ...typography.labelLarge,
    fontSize: 16,
  },

  iconLeft: {
    marginRight: spacing[1],
  },

  iconRight: {
    marginLeft: spacing[1],
  },

  spinner: {
    marginRight: spacing[1],
  },
});

export default Button;
export type { ButtonVariant, ButtonSize, ButtonState };