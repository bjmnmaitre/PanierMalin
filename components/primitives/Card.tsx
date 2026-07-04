import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing, radii, shadows } from '@/design';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardShadow = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: React.ReactNode;
  padding?: CardPadding;
  shadow?: CardShadow;
  backgroundColor?: string;
  borderRadius?: number;
}

export default function Card({
  children,
  padding = 'md',
  shadow = 'md',
  backgroundColor = colors.white,
  borderRadius = radii.lg,
}: CardProps) {
  const paddingValue = {
    none: spacing[0],
    sm: spacing[2],
    md: spacing[3],
    lg: spacing[4],
  }[padding];

  const shadowStyle = shadows[shadow as keyof typeof shadows];

  return (
    <View
      style={[
        styles.card,
        {
          padding: paddingValue,
          backgroundColor,
          borderRadius,
          ...shadowStyle,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
  },
});