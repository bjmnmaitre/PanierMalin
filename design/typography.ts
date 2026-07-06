// design/typography.ts
// Complete typography system - Professional, accessible, modern
// Based on 4px baseline, golden ratio for scaling

import { TextStyle } from 'react-native';

export const displayLarge: TextStyle = {
  fontSize: 48,
  fontWeight: '700',
  lineHeight: 56,
  letterSpacing: -1.5,
};

export const displayMedium: TextStyle = {
  fontSize: 40,
  fontWeight: '700',
  lineHeight: 48,
  letterSpacing: -0.5,
};

export const displaySmall: TextStyle = {
  fontSize: 32,
  fontWeight: '700',
  lineHeight: 40,
  letterSpacing: 0,
};

export const headlineH1: TextStyle = {
  fontSize: 28,
  fontWeight: '700',
  lineHeight: 36,
  letterSpacing: 0,
};

export const headlineH2: TextStyle = {
  fontSize: 24,
  fontWeight: '700',
  lineHeight: 32,
  letterSpacing: 0,
};

export const headlineH3: TextStyle = {
  fontSize: 20,
  fontWeight: '600',
  lineHeight: 28,
  letterSpacing: 0.15,
};

export const headlineH4: TextStyle = {
  fontSize: 18,
  fontWeight: '600',
  lineHeight: 26,
  letterSpacing: 0.1,
};

export const bodyLarge: TextStyle = {
  fontSize: 16,
  fontWeight: '400',
  lineHeight: 24,
  letterSpacing: 0.5,
};

export const bodyMedium: TextStyle = {
  fontSize: 14,
  fontWeight: '400',
  lineHeight: 20,
  letterSpacing: 0.25,
};

export const bodySmall: TextStyle = {
  fontSize: 12,
  fontWeight: '400',
  lineHeight: 16,
  letterSpacing: 0.4,
};

export const labelLarge: TextStyle = {
  fontSize: 14,
  fontWeight: '600',
  lineHeight: 20,
  letterSpacing: 0.1,
};

export const labelMedium: TextStyle = {
  fontSize: 12,
  fontWeight: '600',
  lineHeight: 16,
  letterSpacing: 0.5,
};

export const labelSmall: TextStyle = {
  fontSize: 11,
  fontWeight: '600',
  lineHeight: 14,
  letterSpacing: 0.5,
};

export const captionLarge: TextStyle = {
  fontSize: 12,
  fontWeight: '500',
  lineHeight: 16,
  letterSpacing: 0.4,
};

export const captionSmall: TextStyle = {
  fontSize: 10,
  fontWeight: '500',
  lineHeight: 12,
  letterSpacing: 0.5,
};

export const overline: TextStyle = {
  fontSize: 10,
  fontWeight: '700',
  lineHeight: 14,
  letterSpacing: 1.5,
};

export const priceLarge: TextStyle = {
  fontSize: 32,
  fontWeight: '700',
  lineHeight: 40,
  letterSpacing: 0,
};

export const priceMedium: TextStyle = {
  fontSize: 24,
  fontWeight: '700',
  lineHeight: 32,
  letterSpacing: 0,
};

export const priceSmall: TextStyle = {
  fontSize: 16,
  fontWeight: '600',
  lineHeight: 24,
  letterSpacing: 0,
};

/**
 * Complete typography system
 * Includes both full names (labelLarge) and short legacy aliases (labelLg)
 * so screens referencing typography.labelMd / labelSm / labelLg keep working.
 */
export const typography = {
  displayLarge,
  displayMedium,
  displaySmall,

  h1: headlineH1,
  h2: headlineH2,
  h3: headlineH3,
  h4: headlineH4,
  headlineH1,
  headlineH2,
  headlineH3,
  headlineH4,

  bodyLarge,
  bodyMedium,
  bodySmall,

  labelLarge,
  labelMedium,
  labelSmall,

  // Short legacy aliases (used by BottomNav.tsx, BasketOptimizationScreen.tsx, etc.)
  labelLg: labelLarge,
  labelMd: labelMedium,
  labelSm: labelSmall,

  caption: captionLarge,
  captionLarge,
  captionSmall,

  overline,

  priceLarge,
  priceMedium,
  priceSmall,
};

export const fontWeights = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
  loose: 2,
} as const;

export default typography;