// components/primitives/Card.tsx
// Flexible, reusable card component for any content
// Supports: 4 shadow levels × 4 padding levels + custom styling

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { colors, spacing, radii, shadows } from '@/design';

/**
 * Shadow/elevation levels
 */
type CardShadow = 'none' | 'sm' | 'md' | 'lg';

/**
 * Padding presets
 */
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Complete card props
 */
export interface CardProps {
  /** Card content */
  children: React.ReactNode;

  /** Padding inside card */
  padding?: CardPadding;

  /** Shadow/elevation level */
  shadow?: CardShadow;

  /** Background color */
  backgroundColor?: string;

  /** Border radius */
  borderRadius?: number;

  /** Border color */
  borderColor?: string;

  /** Border width */
  borderWidth?: number;

  /** Pressable callback */
  onPress?: (e: GestureResponderEvent) => void;

  /** Custom container style */
  style?: ViewStyle;

  /** Test ID */
  testID?: string;

  /** Accessibility role */
  accessible?: boolean;
}

/**
 * Professional Card Component
 *
 * @example
 * <Card padding="md" shadow="md">
 *   <Text>Card content here</Text>
 * </Card>
 *
 * @example
 * <Card onPress={handlePress} padding="lg">
 *   Pressable card
 * </Card>
 */
const Card = React.memo(function Card({
  children,
  padding = 'md',
  shadow = 'md',
  backgroundColor = colors.white,
  borderRadius = radii.lg,
  borderColor,
  borderWidth,
  onPress,
  style,
  testID,
  accessible = true,
}: CardProps) {

  // Memoized padding value
  const paddingValue = useMemo(() => {
    const paddingMap: Record<CardPadding, number> = {
      none: spacing[0],
      sm: spacing[2],
      md: spacing[3],
      lg: spacing[4],
    };
    return paddingMap[padding];
  }, [padding]);

  // Memoized shadow style
  const shadowStyle = useMemo(() => {
    const shadowMap: Record<CardShadow, ViewStyle> = {
      none: shadows.none,
      sm: shadows.sm,
      md: shadows.md,
      lg: shadows.lg,
    };
    return shadowMap[shadow];
  }, [shadow]);

  // Combined container style
  const containerStyle = useMemo<ViewStyle>(
    () => ({
      padding: paddingValue,
      backgroundColor,
      borderRadius,
      ...(borderColor && { borderColor }),
      ...(borderWidth !== undefined && { borderWidth }),
      ...shadowStyle,
    }),
    [paddingValue, backgroundColor, borderRadius, borderColor, borderWidth, shadowStyle]
  );

  // If pressable, return Pressable component
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessible={accessible}
        accessibilityRole="button"
        testID={testID}
        style={({ pressed }) => [
          styles.card,
          containerStyle,
          pressed && styles.cardPressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  // Otherwise return View
  return (
    <View
      style={[styles.card, containerStyle, style]}
      testID={testID}
      accessible={accessible}
    >
      {children}
    </View>
  );
});

Card.displayName = 'Card';

/**
 * Stylesheet
 */
const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },

  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

export default Card;
export type { CardShadow, CardPadding };