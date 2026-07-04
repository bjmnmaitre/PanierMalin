export const semanticColors = {
  primary: '#1D9E75',
  secondary: '#FF6F00',
  tertiary: '#4F46E5',
  
  // Gray scale
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  
  // Semantic
  bg: { primary: '#FFFFFF', secondary: '#F9FAFB', tertiary: '#F3F4F6' },
  text: { primary: '#111827', secondary: '#374151', muted: '#6B7280' },
  border: { default: '#E5E7EB', light: '#F3F4F6', dark: '#D1D5DB' },
  
  // States
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export const colors = {
  ...semanticColors,
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
};