// design/shadows.ts
// Material Design 3 elevation system
// Provides visual hierarchy through shadows

import { ViewStyle } from 'react-native';

/**
 * No shadow - Flat surfaces
 */
export const shadowNone: ViewStyle = {
  elevation: 0,
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
};

/**
 * Extra small shadow - Subtle depth (elevation 1)
 * Use for: Hover states, slight elevation
 */
export const shadowXs: ViewStyle = {
  elevation: 1,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 1,
};

/**
 * Small shadow - Subtle elevation (elevation 2)
 * Use for: Input fields, small cards, badges
 */
export const shadowSm: ViewStyle = {
  elevation: 2,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 2,
};

/**
 * Medium shadow - Default depth (elevation 4)
 * Use for: Cards, modals, dropdowns
 */
export const shadowMd: ViewStyle = {
  elevation: 4,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
};

/**
 * Large shadow - Prominent elevation (elevation 8)
 * Use for: Large cards, floating action buttons
 */
export const shadowLg: ViewStyle = {
  elevation: 8,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
};

/**
 * Extra large shadow - Strong elevation (elevation 16)
 * Use for: Featured cards, important overlays
 */
export const shadowXl: ViewStyle = {
  elevation: 16,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.20,
  shadowRadius: 12,
};

/**
 * Extra extra large shadow - Maximum elevation (elevation 24)
 * Use for: Top-level modals, dialogs
 */
export const shadow2xl: ViewStyle = {
  elevation: 24,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 16 },
  shadowOpacity: 0.25,
  shadowRadius: 16,
};

/**
 * Soft shadow - Subtle and soft (for light UIs)
 * Use for: Cards on light backgrounds
 */
export const shadowSoft: ViewStyle = {
  elevation: 3,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
};

/**
 * Hard shadow - Sharp and defined
 * Use for: Modern, minimalist designs
 */
export const shadowHard: ViewStyle = {
  elevation: 5,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.18,
  shadowRadius: 5,
};

/**
 * Inset shadow - Pressed/indented effect
 * Note: React Native doesn't support inset, this is CSS equivalent
 */
export const shadowInset = {
  // Can be achieved with border approach
  borderColor: 'rgba(0,0,0,0.1)',
  borderWidth: 1,
};

/**
 * Complete shadows object
 */
export const shadows = {
  none: shadowNone,
  xs: shadowXs,
  sm: shadowSm,
  md: shadowMd,
  lg: shadowLg,
  xl: shadowXl,
  '2xl': shadow2xl,
  soft: shadowSoft,
  hard: shadowHard,
  inset: shadowInset,
};

/**
 * Elevation levels mapping
 */
export const elevation = {
  0: shadowNone,
  1: shadowXs,
  2: shadowSm,
  3: shadowSoft,
  4: shadowMd,
  5: shadowHard,
  8: shadowLg,
  16: shadowXl,
  24: shadow2xl,
} as const;

/**
 * Dark mode shadow adjustments
 */
export const darkModeShadows = {
  none: shadowNone,
  xs: {
    ...shadowXs,
    shadowOpacity: 0.15,
  },
  sm: {
    ...shadowSm,
    shadowOpacity: 0.25,
  },
  md: {
    ...shadowMd,
    shadowOpacity: 0.30,
  },
  lg: {
    ...shadowLg,
    shadowOpacity: 0.35,
  },
  xl: {
    ...shadowXl,
    shadowOpacity: 0.40,
  },
  '2xl': {
    ...shadow2xl,
    shadowOpacity: 0.45,
  },
};

export default shadows;