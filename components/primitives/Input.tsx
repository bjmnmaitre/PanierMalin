import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radii } from '@/design';

interface InputProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  type?: 'text' | 'email' | 'password';
  disabled?: boolean;
  editable?: boolean;
}

export default function Input({
  placeholder,
  value,
  onChangeText,
  icon,
  type = 'text',
  disabled = false,
  editable = true,
}: InputProps) {
  const keyboardType = type === 'email' ? 'email-address' : 'default';
  const secureTextEntry = type === 'password';

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {icon && (
        <MaterialIcons
          name={icon}
          size={18}
          color={colors.text.muted}
          style={styles.icon}
        />
      )}
      <TextInput
        style={[styles.input, icon && styles.inputWithIcon]}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        editable={!disabled && editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.white,
    paddingHorizontal: spacing[3],
    height: 44,
  },
  containerDisabled: {
    backgroundColor: colors.gray[50],
    opacity: 0.6,
  },
  icon: {
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
});