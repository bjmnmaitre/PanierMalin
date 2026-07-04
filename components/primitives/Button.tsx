import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '@/design';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  fullWidth?: boolean;
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[`button_${variant}`],
        styles[`button_${size}`],
        isDisabled && styles.buttonDisabled,
        fullWidth && styles.buttonFullWidth,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.white} size={14} />
      ) : icon ? (
        <MaterialIcons 
          name={icon} 
          size={size === 'sm' ? 16 : size === 'md' ? 18 : 20}
          color={variant === 'outline' ? colors.primary : colors.white}
          style={{ marginRight: spacing[1] }}
        />
      ) : null}
      <Text style={[styles.label, styles[`label_${variant}`], styles[`label_${size}`]]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    gap: spacing[1],
  },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.secondary },
  button_outline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  button_ghost: { backgroundColor: 'transparent' },
  button_sm: { paddingVertical: spacing[1], paddingHorizontal: spacing[2] },
  button_md: { paddingVertical: spacing[2], paddingHorizontal: spacing[4] },
  button_lg: { paddingVertical: spacing[3], paddingHorizontal: spacing[5] },
  buttonDisabled: { opacity: 0.5 },
  buttonFullWidth: { width: '100%' },
  label: { ...typography.labelMd, textAlign: 'center' },
  label_primary: { color: colors.white },
  label_secondary: { color: colors.white },
  label_outline: { color: colors.primary },
  label_ghost: { color: colors.primary },
  label_sm: { ...typography.labelSm },
  label_md: { ...typography.labelMd },
  label_lg: { ...typography.labelLg },
});