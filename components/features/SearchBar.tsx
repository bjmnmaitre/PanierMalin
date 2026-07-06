// components/features/SearchBar.tsx
// Search input with debounce, clear button, and filter action

import React, { useState, useCallback, useEffect } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radii, shadows } from '@/design';
import { useDebounce } from '@/hooks';

export interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onDebouncedChange?: (text: string) => void;
  debounceDelay?: number;
  onFilterPress?: () => void;
  hasActiveFilters?: boolean;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * Professional SearchBar Component
 * Debounces search input automatically for performant filtering
 *
 * @example
 * <SearchBar
 *   placeholder="Rechercher un produit..."
 *   onDebouncedChange={(text) => searchProducts(text)}
 *   onFilterPress={() => openFilterModal()}
 *   hasActiveFilters={filters.length > 0}
 * />
 */
const SearchBar = React.memo(function SearchBar({
  placeholder = 'Rechercher...',
  value: controlledValue,
  onChangeText,
  onDebouncedChange,
  debounceDelay = 300,
  onFilterPress,
  hasActiveFilters = false,
  autoFocus = false,
  testID,
}: SearchBarProps) {

  const [internalValue, setInternalValue] = useState(controlledValue || '');
  const debouncedValue = useDebounce(internalValue, debounceDelay);

  // Sync controlled value if provided externally
  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== internalValue) {
      setInternalValue(controlledValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue]);

  // Fire debounced callback when debounced value changes
  useEffect(() => {
    onDebouncedChange?.(debouncedValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  const handleChangeText = useCallback(
    (text: string) => {
      setInternalValue(text);
      onChangeText?.(text);
    },
    [onChangeText]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChangeText?.('');
    onDebouncedChange?.('');
  }, [onChangeText, onDebouncedChange]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.searchField}>
        <MaterialIcons name="search" size={20} color={colors.text.tertiary} />

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          value={internalValue}
          onChangeText={handleChangeText}
          autoFocus={autoFocus}
          returnKeyType="search"
          allowFontScaling={false}
          accessible
          accessibilityLabel={placeholder}
        />

        {internalValue.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
          >
            <MaterialIcons name="close" size={18} color={colors.text.tertiary} />
          </Pressable>
        )}
      </View>

      {onFilterPress && (
        <Pressable
          onPress={onFilterPress}
          style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Filtres"
        >
          <MaterialIcons
            name="tune"
            size={20}
            color={hasActiveFilters ? colors.white : colors.primary}
          />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </Pressable>
      )}
    </View>
  );
});

SearchBar.displayName = 'SearchBar';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },

  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: radii.full,
    paddingHorizontal: spacing[3],
    height: 44,
    gap: spacing[2],
  },

  input: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.text.primary,
    paddingVertical: 0,
  },

  filterButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...shadows.sm,
  },

  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});

export default SearchBar;