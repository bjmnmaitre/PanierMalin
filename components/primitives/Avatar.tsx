// components/primitives/Avatar.tsx
// User avatar with image or initials fallback
// Supports: 5 sizes × circle/rounded variants + auto-generated colors

import React, { useMemo } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  ViewStyle,
  ImageSourcePropType,
  Pressable,
} from 'react-native';
import { colors, radii, shadows } from '@/design';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type AvatarVariant = 'circle' | 'rounded';

export interface AvatarProps {
  size?: AvatarSize;
  variant?: AvatarVariant;
  source?: ImageSourcePropType;
  initials?: string;
  name?: string;
  backgroundColor?: string;
  onPress?: () => void;
  testID?: string;
}

/**
 * Professional Avatar Component
 *
 * @example
 * <Avatar size="md" name="Jean Dupont" />
 *
 * @example
 * <Avatar size="lg" source={{ uri: 'https://...' }} />
 *
 * @example
 * <Avatar size="sm" initials="JD" backgroundColor={colors.tertiary} />
 */
const Avatar = React.memo(function Avatar({
  size = 'md',
  variant = 'circle',
  source,
  initials,
  name,
  backgroundColor,
  onPress,
  testID,
}: AvatarProps) {

  // Get pixel size
  const sizeValue = useMemo(() => {
    const sizeMap: Record<AvatarSize, number> = {
      xs: 28,
      sm: 36,
      md: 44,
      lg: 56,
      xl: 72,
    };
    return sizeMap[size];
  }, [size]);

  // Get initials from name if not provided directly
  const displayInitials = useMemo(() => {
    if (initials) return initials.toUpperCase().slice(0, 2);
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return '?';
  }, [initials, name]);

  // Generate a consistent background color from the initials/name
  const bgColor = useMemo(() => {
    if (backgroundColor) return backgroundColor;

    const palette = [
      colors.primary,
      colors.secondary,
      colors.tertiary,
      colors.warning,
      colors.success,
      colors.info,
    ];

    const seed = (name || displayInitials || '?')
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return palette[seed % palette.length];
  }, [backgroundColor, name, displayInitials]);

  // Font size scales with avatar size
  const fontSize = useMemo(() => {
    const sizes: Record<AvatarSize, number> = {
      xs: 10,
      sm: 12,
      md: 16,
      lg: 20,
      xl: 24,
    };
    return sizes[size];
  }, [size]);

  const containerStyle = useMemo<ViewStyle>(
    () => ({
      width: sizeValue,
      height: sizeValue,
      borderRadius: variant === 'circle' ? sizeValue / 2 : radii.lg,
      backgroundColor: source ? colors.gray[100] : bgColor,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      ...shadows.sm,
    }),
    [sizeValue, variant, bgColor, source]
  );

  const content = (
    <View style={containerStyle} testID={testID}>
      {source ? (
        <Image
          source={source}
          style={{ width: sizeValue, height: sizeValue }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            fontSize,
            fontWeight: '600',
            color: colors.white,
          }}
          allowFontScaling={false}
        >
          {displayInitials}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={name || 'Avatar'}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
});

Avatar.displayName = 'Avatar';

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});

export default Avatar;
export type { AvatarSize, AvatarVariant };