// utils/validators.ts
// Form field validators - each returns undefined if valid, or an error message string

/**
 * Validate required field
 */
export const validateRequired = (value: any, fieldName = 'Ce champ'): string | undefined => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} est requis`;
  }
  return undefined;
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): string | undefined => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Adresse email invalide';
  }
  return undefined;
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): string | undefined => {
  if (password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une majuscule';
  }

  if (!/[a-z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une minuscule';
  }

  if (!/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins un chiffre';
  }

  return undefined;
};

/**
 * Validate password confirmation matches
 */
export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): string | undefined => {
  if (password !== confirmPassword) {
    return 'Les mots de passe ne correspondent pas';
  }
  return undefined;
};

/**
 * Validate minimum length
 */
export const validateMinLength = (value: string, minLength: number): string | undefined => {
  if (value.length < minLength) {
    return `Doit contenir au moins ${minLength} caractères`;
  }
  return undefined;
};

/**
 * Validate maximum length
 */
export const validateMaxLength = (value: string, maxLength: number): string | undefined => {
  if (value.length > maxLength) {
    return `Ne doit pas dépasser ${maxLength} caractères`;
  }
  return undefined;
};

/**
 * Validate number is within range
 */
export const validateNumberRange = (
  value: number,
  min: number,
  max: number
): string | undefined => {
  if (value < min || value > max) {
    return `Doit être compris entre ${min} et ${max}`;
  }
  return undefined;
};

/**
 * Validate phone number (French/international format)
 */
export const validatePhone = (phone: string): string | undefined => {
  const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
  if (!phoneRegex.test(phone)) {
    return 'Numéro de téléphone invalide';
  }
  return undefined;
};

/**
 * Validate URL format
 */
export const validateURL = (url: string): string | undefined => {
  try {
    new URL(url);
    return undefined;
  } catch {
    return 'URL invalide';
  }
};

/**
 * Validate price value
 */
export const validatePrice = (price: number | string): string | undefined => {
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(priceNum)) {
    return 'Prix invalide';
  }

  if (priceNum < 0) {
    return 'Le prix doit être positif';
  }

  return undefined;
};

/**
 * Validate quantity value
 */
export const validateQuantity = (quantity: number | string): string | undefined => {
  const quantityNum = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;

  if (isNaN(quantityNum)) {
    return 'Quantité invalide';
  }

  if (quantityNum <= 0) {
    return 'La quantité doit être supérieure à 0';
  }

  if (!Number.isInteger(quantityNum)) {
    return 'La quantité doit être un nombre entier';
  }

  return undefined;
};

/**
 * Validate credit card number (Luhn algorithm)
 */
export const validateCreditCard = (cardNumber: string): string | undefined => {
  const cleaned = cardNumber.replace(/\s/g, '');

  if (!/^\d{13,19}$/.test(cleaned)) {
    return 'Numéro de carte invalide';
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    return 'Numéro de carte invalide';
  }

  return undefined;
};

/**
 * Compose multiple validators into a single validator.
 * Returns the first error encountered, or undefined if all pass.
 *
 * @example
 * const validateEmailField = composeValidators(
 *   (v) => validateRequired(v, 'Email'),
 *   validateEmail,
 * );
 */
export const composeValidators = (
  ...validators: Array<(value: any) => string | undefined>
): ((value: any) => string | undefined) => {
  return (value: any) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  };
};

export default {
  validateRequired,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateMinLength,
  validateMaxLength,
  validateNumberRange,
  validatePhone,
  validateURL,
  validatePrice,
  validateQuantity,
  validateCreditCard,
  composeValidators,
};