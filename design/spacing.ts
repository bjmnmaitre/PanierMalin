// design/spacing.ts
// 8px baseline grid system - Professional spacing scale
// Powers consistent layouts across the app

/**
 * 8px grid spacing scale
 * Multiples of 4 for fine control
 */
export const spacing = {
  0: 0,      // No space
  1: 4,      // xs - Tight
  2: 8,      // sm - Small gaps
  3: 12,     // md - Medium
  4: 16,     // lg - Default margin
  5: 20,     // xl - Large
  6: 24,     // 2xl
  8: 32,     // 3xl
  10: 40,    // 4xl
  12: 48,    // 5xl
  16: 64,    // 6xl
  20: 80,    // 7xl
  24: 96,    // 8xl
} as const;

/**
 * Border radius - Consistent corner rounding
 */
export const radii = {
  none: 0,
  sm: 4,      // Subtle rounding
  md: 8,      // Default for inputs, cards
  lg: 12,     // Cards, buttons
  xl: 16,     // Large cards
  '2xl': 20,  // Extra large
  '3xl': 24,  // Hero sections
  full: 999,  // Fully rounded (pills, circles)
} as const;

/**
 * Sizes - For width/height consistency
 */
export const sizes = {
  // Avatar sizes
  avatar_xs: 28,
  avatar_sm: 36,
  avatar_md: 44,
  avatar_lg: 56,
  avatar_xl: 72,

  // Icon sizes
  icon_xs: 16,
  icon_sm: 20,
  icon_md: 24,
  icon_lg: 32,
  icon_xl: 48,

  // Touch target sizes (minimum 44x44)
  touch_sm: 40,
  touch_md: 44,
  touch_lg: 52,
  touch_xl: 60,

  // Container sizes
  container_sm: 320,
  container_md: 375,
  container_lg: 428,
  container_xl: 512,
};

/**
 * Z-index scale
 */
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal_backdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  notification: 1080,
} as const;

/**
 * Padding presets for consistent spacing
 */
export const padding = {
  none: spacing[0],
  xs: spacing[1],
  sm: spacing[2],
  md: spacing[3],
  lg: spacing[4],
  xl: spacing[5],
  '2xl': spacing[6],
} as const;

/**
 * Margin presets
 */
export const margin = padding;

/**
 * Gap presets for Flexbox layouts
 */
export const gap = spacing;

/**
 * Breakpoints for responsive design
 */
export const breakpoints = {
  xs: 0,      // Extra small
  sm: 375,    // Small phones
  md: 428,    // Medium/large phones
  lg: 768,    // Tablets
  xl: 1024,   // Large tablets/desktop
  '2xl': 1280, // Extra large
} as const;

/**
 * Safe area padding
 */
export const safeArea = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
};

/**
 * Container padding - Standard padding for screens
 */
export const containerPadding = {
  horizontal: spacing[4],  // 16px
  vertical: spacing[4],    // 16px
};

/**
 * Modal/overlay sizes
 */
export const modal = {
  minHeight: 300,
  maxWidth: 500,
  padding: spacing[4],
};

/**
 * Bottom sheet sizes
 */
export const bottomSheet = {
  defaultHeight: '60%',
  maxHeight: '90%',
  snapPoints: ['25%', '50%', '90%'],
};

export default {
  spacing,
  radii,
  sizes,
  zIndex,
  padding,
  margin,
  gap,
  breakpoints,
  safeArea,
  containerPadding,
  modal,
  bottomSheet,
};