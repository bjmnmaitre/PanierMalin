// hooks/useForm.ts
// Form state management with built-in validation

import { useCallback, useMemo, useState } from 'react';

/**
 * Validation function type
 */
export type Validator = (value: unknown) => string | undefined;

/**
 * Field validation rules
 */
export interface FieldValidation {
  required?: boolean | string;
  minLength?: [number, string];
  maxLength?: [number, string];
  pattern?: [RegExp, string];
  validate?: Validator;
}

/**
 * Form configuration
 */
export interface FormConfig<T extends Record<string, any>> {
  initialValues: T;
  validationRules?: Partial<Record<keyof T, FieldValidation>>;
  onSubmit: (values: T) => void | Promise<void>;
}

/**
 * useForm hook - Professional form handling
 *
 * @example
 * const form = useForm({
 *   initialValues: { email: '', password: '' },
 *   validationRules: {
 *     email: {
 *       required: 'Email is required',
 *       pattern: [/^[^@]+@[^@]+\.[^@]+$/, 'Invalid email'],
 *     },
 *   },
 *   onSubmit: async (values) => {
 *     await api.login(values);
 *   },
 * });
 */
export function useForm<T extends Record<string, any>>({
  initialValues,
  validationRules = {},
  onSubmit,
}: FormConfig<T>) {

  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate a single field
  const validateField = useCallback(
    (fieldName: keyof T, fieldValue: any): string | undefined => {
      const rules = validationRules[fieldName];
      if (!rules) return undefined;

      // Required
      if (rules.required) {
        if (!fieldValue || (typeof fieldValue === 'string' && !fieldValue.trim())) {
          return typeof rules.required === 'string'
            ? rules.required
            : `${String(fieldName)} is required`;
        }
      }

      // MinLength
      if (rules.minLength && typeof fieldValue === 'string') {
        const [min, message] = rules.minLength;
        if (fieldValue.length < min) return message;
      }

      // MaxLength
      if (rules.maxLength && typeof fieldValue === 'string') {
        const [max, message] = rules.maxLength;
        if (fieldValue.length > max) return message;
      }

      // Pattern
      if (rules.pattern && typeof fieldValue === 'string') {
        const [pattern, message] = rules.pattern;
        if (!pattern.test(fieldValue)) return message;
      }

      // Custom validator
      if (rules.validate) {
        return rules.validate(fieldValue);
      }

      return undefined;
    },
    [validationRules]
  );

  // Validate all fields
  const validateForm = useCallback((): Partial<Record<keyof T, string>> => {
    const newErrors: Partial<Record<keyof T, string>> = {};

    Object.keys(values).forEach((fieldName) => {
      const error = validateField(fieldName as keyof T, values[fieldName as keyof T]);
      if (error) {
        newErrors[fieldName as keyof T] = error;
      }
    });

    return newErrors;
  }, [values, validateField]);

  // Handle value change
  const handleChangeText = useCallback(
    (fieldName: keyof T) => (text: string) => {
      setValues(prev => ({
        ...prev,
        [fieldName]: text,
      }));

      // Validate if touched
      if (touched[fieldName]) {
        const error = validateField(fieldName, text);
        setErrors(prev => ({
          ...prev,
          [fieldName]: error,
        }));
      }
    },
    [touched, validateField]
  );

  // Handle blur
  const handleBlur = useCallback(
    (fieldName: keyof T) => () => {
      setTouched(prev => ({
        ...prev,
        [fieldName]: true,
      }));

      const error = validateField(fieldName, values[fieldName]);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error,
      }));
    },
    [validateField, values]
  );

  // Handle submit
  const handleSubmit = useCallback(
    async (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();

      const newErrors = validateForm();
      setErrors(newErrors);

      if (Object.keys(newErrors).length > 0) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [validateForm, onSubmit, values]
  );

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  // Set field value programmatically
  const setFieldValue = useCallback((fieldName: keyof T, value: any) => {
    setValues(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  // Is form valid
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  // Is form dirty (has changes)
  const isDirty = useMemo(() => {
    const currentKeys = Object.keys(values);
    const initialKeys = Object.keys(initialValues);

    if (currentKeys.length !== initialKeys.length) {
      return true;
    }

    return currentKeys.some((key) => values[key] !== initialValues[key]);
  }, [values, initialValues]);

  // Build field binding helpers (spread directly into <Input {...} />)
  const getFieldProps = useCallback(
    (fieldName: keyof T) => ({
      value: values[fieldName],
      onChangeText: handleChangeText(fieldName),
      onBlur: handleBlur(fieldName),
      error: errors[fieldName],
    }),
    [values, handleChangeText, handleBlur, errors]
  );

  return {
    // State
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,

    // Helpers
    handleChangeText,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    getFieldProps,
  };
}

export default useForm;