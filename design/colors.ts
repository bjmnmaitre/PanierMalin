// design/colors.ts
// Color system for PanierMalin - Professional, accessible, modern
// Organized by semantic meaning and contrast ratios

/**
 * Primary brand color - Green (savings, money, eco)
 * Used for: CTAs, success states, savings highlights
 */
export const PRIMARY = '#1D9E75';
export const PRIMARY_LIGHT = '#E1F5EE';
export const PRIMARY_DARK = '#00796B';
export const PRIMARY_DARKER = '#004D40';

/**
 * Secondary brand color - PM-Orange (rewards, energy, gamification)
 * Used for: Badges, streaks, premium features, achievements
 */
export const SECONDARY = '#FF6B00';          // PM-Orange officiel
export const SECONDARY_LIGHT = '#FFF8F0';    // PM-Cream (fond chaud)
export const SECONDARY_DARK = '#E65100';
export const SECONDARY_DARKER = '#BF360C';

/**
 * Dark Slate - Fonds premium admin/splash
 */
export const DARK_SLATE = '#1A202C';         // PM-DarkSlate

/**
 * Tertiary brand color - Blue (community, trust, social)
 * Used for: Links, community features, user connections
 */
export const TERTIARY = '#2563EB';
export const TERTIARY_LIGHT = '#DBEAFE';
export const TERTIARY_DARK = '#1E40AF';
export const TERTIARY_DARKER = '#1E3A8A';

/**
 * Neutral grays - Complete scale for backgrounds, text, borders
 * WCAG AAA compliant contrast ratios
 */
export const GRAY = {
  50: '#F9FAFB',   // Lightest, almost white
  100: '#F3F4F6',  // Very light background
  150: '#EEEEF2',  // Card backgrounds
  200: '#E5E7EB',  // Subtle borders, disabled states
  300: '#D1D5DB',  // Borders, dividers
  400: '#9CA3AF',  // Secondary text, placeholders
  500: '#6B7280',  // Tertiary text
  600: '#4B5563',  // Secondary text
  700: '#374151',  // Primary text
  800: '#1F2937',  // Dark text
  900: '#111827',  // Darkest text
};

/**
 * Semantic colors for UI states
 */
export const SEMANTIC = {
  // Success - Positive actions, confirmations
  success: '#10B981',
  success_light: '#D1FAE5',
  success_dark: '#059669',
  
  // Error - Warnings, deletions, critical states
  error: '#EF4444',
  error_light: '#FEE2E2',
  error_dark: '#DC2626',
  
  // Warning - Caution, attention-needed states
  warning: '#F59E0B',
  warning_light: '#FEF3C7',
  warning_dark: '#D97706',
  
  // Info - Informational messages
  info: '#3B82F6',
  info_light: '#DBEAFE',
  info_dark: '#1D4ED8',
  
  // Freshness badges - Price data freshness
  fresh_green: '#10B981',     // < 6h
  fresh_orange: '#F59E0B',    // 6h - 5 days
  fresh_gray: '#9CA3AF',      // > 5 days
};

/**
 * Background colors - Layered system
 */
export const BACKGROUND = {
  primary: '#FFFFFF',          // Main background
  secondary: '#F9FAFB',        // Secondary surfaces
  tertiary: '#F3F4F6',         // Tertiary surfaces
  overlay_light: 'rgba(0,0,0,0.3)',
  overlay_medium: 'rgba(0,0,0,0.5)',
  overlay_dark: 'rgba(0,0,0,0.7)',
};

/**
 * Text colors - Hierarchical
 */
export const TEXT = {
  primary: '#111827',           // Primary text, headings
  secondary: '#4B5563',         // Secondary text
  tertiary: '#9CA3AF',          // Tertiary text, disabled
  muted: '#D1D5DB',            // Very light text on dark bg
  inverse: '#FFFFFF',          // Text on dark backgrounds
};

/**
 * Border colors - Subtle to prominent
 */
export const BORDER = {
  default: '#E5E7EB',          // Default borders
  light: '#F3F4F6',            // Very light borders
  dark: '#D1D5DB',             // Darker borders
  focus: PRIMARY,              // Focus states
};

/**
 * Shadow colors - For depth
 */
export const SHADOW = '#000000';

/**
 * Complete color palette export
 */
export const colors = {
  // Brand colors
  primary: PRIMARY,
  primary_light: PRIMARY_LIGHT,
  primary_dark: PRIMARY_DARK,
  primary_darker: PRIMARY_DARKER,
  
  secondary: SECONDARY,
  secondary_light: SECONDARY_LIGHT,
  secondary_dark: SECONDARY_DARK,
  secondary_darker: SECONDARY_DARKER,
  
  tertiary: TERTIARY,
  tertiary_light: TERTIARY_LIGHT,
  tertiary_dark: TERTIARY_DARK,
  tertiary_darker: TERTIARY_DARKER,
  
  // Grays
  gray: GRAY,
  
  // Semantic
  ...SEMANTIC,
  
  // Surfaces
  bg: BACKGROUND,
  text: TEXT,
  border: BORDER,
  shadow: SHADOW,
  
  // Basics
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Tokens PM nommés (pour référence explicite dans les écrans)
  pmOrange:    SECONDARY,          // '#FF6B00'
  pmCream:     SECONDARY_LIGHT,    // '#FFF8F0'
  pmDarkSlate: DARK_SLATE,         // '#1A202C'
};

/**
 * Color utility types
 */
export type ColorKey = keyof typeof colors;
export type GrayScale = keyof typeof GRAY;

/**
 * Dark mode color overrides
 */
export const darkModeColors = {
  bg: {
    primary: '#0F172A',
    secondary: '#1E293B',
    tertiary: '#334155',
    overlay_light: 'rgba(255,255,255,0.1)',
    overlay_medium: 'rgba(255,255,255,0.2)',
    overlay_dark: 'rgba(255,255,255,0.3)',
  },
  text: {
    primary: '#F8FAFC',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
    muted: '#475569',
    inverse: '#0F172A',
  },
  border: {
    default: '#334155',
    light: '#1E293B',
    dark: '#475569',
    focus: TERTIARY_LIGHT,
  },
};

export default colors;