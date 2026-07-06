// hooks/useTheme.ts
// Dark/light mode theme management

import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { colors, darkModeColors } from '@/design';

export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Complete theme object with all color values
 */
export interface Theme {
  colors: typeof colors;
  isDark: boolean;
  mode: 'light' | 'dark';
}

/**
 * useTheme hook - Get current theme based on system settings
 * Automatically detects system dark mode
 *
 * @returns Theme object with colors and isDark flag
 *
 * @example
 * const theme = useTheme();
 * <View style={{ backgroundColor: theme.colors.bg.primary }} />
 */
export function useTheme(): Theme {
  const systemColorScheme = useColorScheme();

  const isDark = systemColorScheme === 'dark';

  const currentColors = useMemo(() => {
    if (isDark) {
      return {
        ...colors,
        bg: darkModeColors.bg,
        text: darkModeColors.text,
        border: darkModeColors.border,
      };
    }
    return colors;
  }, [isDark]);

  return useMemo(
    () => ({
      colors: currentColors,
      isDark,
      mode: isDark ? 'dark' : 'light',
    }),
    [currentColors, isDark]
  );
}

export default useTheme;