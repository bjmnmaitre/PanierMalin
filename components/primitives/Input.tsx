// components/primitives/Input.tsx
// Professional input field with validation, error states, icons
// Supports: text, email, password, number, phone, url + icons + validation

import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  KeyboardTypeOptions,
  NativeSyntheticEvent,
  TextInputFocusEventData,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '@/design';

/**
 * Input types
 */
type InputType = 'text' | 'email' | 'password' | 'number' | 'phone' | 'url';

/**
 * Input states
 */
type InputState = 'default' | 'focused' | 'error' | 'success' | 'disabled';

/**
 * Complete input props
 */
export interface InputProps {
  /** Input value */
  value?: string;

  /** Value change callback */
  onChangeText?: (text: string) => void;

  /** Placeholder text */
  placeholder?: string;

  /** Label above input */
  label?: string;

  /** Helper text below input */
  helperText?: string;

  /** Error message */
  error?: string;

  /** Input type */
  type?: InputType;

  /** Left icon */
  leftIcon?: keyof typeof MaterialIcons.glyphMap;

  /** Right icon (action) */
  rightIcon?: keyof typeof MaterialIcons.glyphMap;

  /** Right icon action */
  onRightIconPress?: () => void;

  /** Maximum characters */
  maxLength?: number;

  /** Disabled state */
  disabled?: boolean;

  /** Required field */
  required?: boolean;

  /** Custom validation function - returns true if valid, or error string if invalid */
  validator?: (value: string) => boolean | string;

  /** Focus callback */
  onFocus?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;

  /** Blur callback */
  onBlur?: (e: NativeSyntheticEvent<TextInputFocusEventData>) => void;

  /** Multi-line */
  multiline?: boolean;

  /** Number of lines (for multiline) */
  numberOfLines?: number;

  /** Custom style */
  style?: ViewStyle;

  /** Custom text style */
  textStyle?: TextStyle;

  /** Test ID */
  testID?: string;

  /** Accessibility label */
  accessibilityLabel?: string;
}

/**
 * Professional Input Component
 *
 * @example
 * <Input
 *   type="email"
 *   placeholder="Enter email"
 *   leftIcon="mail"
 *   validator={validateEmail}
 * />
 */
const Input = React.memo(function Input({
  value,
  onChangeText,
  placeholder,
  label,
  helperText,
  error,
  type = 'text',
  leftIcon,
  rightIcon,
  onRightIconPress,
  maxLength,
  disabled = false,
  required = false,
  validator,
  onFocus,
  onBlur,
  multiline = false,
  numberOfLines = 1,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: InputProps) {

  const [isFocused, setIsFocused] = useState(false);
  const [validationError, setValidationError] = useState<string>();

  // Determine keyboard type
  const keyboardType = useMemo<KeyboardTypeOptions>(() => {
    const typeMap: Record<InputType, KeyboardTypeOptions> = {
      text: 'default',
      email: 'email-address',
      password: 'default',
      number: 'number-pad',
      phone: 'phone-pad',
      url: 'url',
    };
    return typeMap[type];
  }, [type]);

  // Determine if password field
  const secureTextEntry = type === 'password';

  // Determine current state
  const currentState = useMemo<InputState>(() => {
    if (disabled) return 'disabled';
    if (error || validationError) return 'error';
    if (isFocused) return 'focused';
    return 'default';
  }, [disabled, error, validationError, isFocused]);

  // Handle text change with validation
  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText?.(text);

      // Run validator if provided
      if (validator) {
        const result = validator(text);
        if (result === true) {
          setValidationError(undefined);
        } else if (typeof result === 'string') {
          setValidationError(result);
        } else {
          setValidationError(undefined);
        }
      }
    },
    [onChangeText, validator]
  );

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Get border color based on state
  const borderColor = useMemo(() => {
    if (error || validationError) return colors.error;
    if (currentState === 'focused') return colors.primary;
    return colors.border.default;
  }, [error, validationError, currentState]);

  const containerStyle = useMemo<ViewStyle>(
    () => ({
      ...styles.container,
      borderColor,
      backgroundColor: disabled ? colors.gray[100] : colors.white,
      ...(style as object),
    }),
    [borderColor, disabled, style]
  );

  return (
    <View style={styles.wrapper}>
      {/* Label */}
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
        </View>
      )}

      {/* Input container */}
      <View style={containerStyle}>
        {/* Left icon */}
        {leftIcon && (
          <MaterialIcons
            name={leftIcon}
            size={20}
            color={disabled ? colors.text.tertiary : colors.primary}
            style={styles.iconLeft}
          />
        )}

        {/* Text input */}
        <TextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            multiline ? styles.inputMultiline : undefined,
            textStyle,
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          value={value}
          onChangeText={handleChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          editable={!disabled}
          maxLength={maxLength}
          onFocus={() => handleFocus()}
          onBlur={() => handleBlur()}
          multiline={multiline}
          numberOfLines={numberOfLines}
          testID={testID}
          accessibilityLabel={accessibilityLabel || label}
          accessible
          allowFontScaling={false}
        />

        {/* Right icon (action) */}
        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            disabled={disabled}
            style={styles.iconRightButton}
            accessible
            accessibilityRole="button"
          >
            <MaterialIcons
              name={rightIcon}
              size={20}
              color={disabled ? colors.text.tertiary : colors.primary}
              style={styles.iconRight}
            />
          </Pressable>
        )}

        {/* State icon (error, success) - only if no rightIcon provided */}
        {!rightIcon && currentState === 'error' && (
          <MaterialIcons
            name="error"
            size={20}
            color={colors.error}
            style={styles.iconRight}
          />
        )}
        {!rightIcon && currentState === 'success' && (
          <MaterialIcons
            name="check-circle"
            size={20}
            color={colors.success}
            style={styles.iconRight}
          />
        )}
      </View>

      {/* Helper/Error text */}
      {(helperText || error || validationError) && (
        <Text
          style={[
            styles.helperText,
            (error || validationError) ? styles.helperTextError : undefined,
          ]}
        >
          {error || validationError || helperText}
        </Text>
      )}

      {/* Character count */}
      {maxLength && value && (
        <Text style={styles.charCount}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );
});

Input.displayName = 'Input';

/**
 * Stylesheet
 */
const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },

  label: {
    ...typography.labelMedium,
    color: colors.text.primary,
  },

  required: {
    color: colors.error,
    marginLeft: spacing[1],
    fontSize: 16,
  },

  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.white,
    paddingHorizontal: spacing[3],
    minHeight: 44,
    paddingVertical: spacing[2],
  },

  iconLeft: {
    marginRight: spacing[2],
  },

  input: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.text.primary,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },

  inputWithLeftIcon: {
    marginLeft: 0,
  },

  inputWithRightIcon: {
    marginRight: spacing[2],
  },

  inputMultiline: {
    minHeight: 100,
    paddingVertical: spacing[2],
    textAlignVertical: 'top',
  },

  iconRightButton: {
    padding: spacing[1],
    marginRight: -spacing[2],
  },

  iconRight: {
    marginLeft: spacing[1],
  },

  helperText: {
    ...typography.captionSmall,
    color: colors.text.secondary,
    marginTop: spacing[1],
    marginLeft: spacing[1],
  },

  helperTextError: {
    color: colors.error,
  },

  charCount: {
    ...typography.captionSmall,
    color: colors.text.tertiary,
    marginTop: spacing[1],
    textAlign: 'right',
    marginRight: spacing[1],
  },
});

export default Input;
export type { InputType, InputState };