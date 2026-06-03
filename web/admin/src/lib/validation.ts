/**
 * Global validation regex and helpers.
 * Use these everywhere (login, signup, profile, etc.) for consistent rules.
 */

/** Username / Email / Mobile: letters, numbers, dot, underscore, @, +, -, space; 1–255 chars */
export const USERNAME_REGEX = /^[\w.@+\-\s]{1,255}$/;

/** Password: min 8 chars, at least one letter and one digit */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

/** Optional: strict email format (use when field is email-only) */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Min/max lengths for reuse */
export const USERNAME_MIN_LENGTH = 1;
export const USERNAME_MAX_LENGTH = 255;
export const PASSWORD_MIN_LENGTH = 8;

export const validationMessages = {
  username: {
    required: "Username or email is required",
    invalid: "Username can only contain letters, numbers, and . _ @ + -",
    minLength: `Username must be at least ${USERNAME_MIN_LENGTH} character`,
    maxLength: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
  },
  password: {
    required: "Password is required",
    invalid: "Password must be at least 8 characters with at least one letter and one number",
    minLength: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  },
  email: {
    required: "Email is required",
    invalid: "Enter a valid email address",
  },
} as const;

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validate username / email / mobile (single field).
 * Use wherever you need to validate a username-style identifier.
 */
export function validateUsername(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, message: validationMessages.username.required };
  }
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return { valid: false, message: validationMessages.username.minLength };
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return { valid: false, message: validationMessages.username.maxLength };
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return { valid: false, message: validationMessages.username.invalid };
  }
  return { valid: true };
}

/**
 * Validate password.
 * Use wherever you need to validate password (login, signup, change password).
 */
export function validatePassword(value: string): ValidationResult {
  if (!value) {
    return { valid: false, message: validationMessages.password.required };
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: validationMessages.password.minLength };
  }
  if (!PASSWORD_REGEX.test(value)) {
    return { valid: false, message: validationMessages.password.invalid };
  }
  return { valid: true };
}

/**
 * Validate email (strict format).
 * Use when the field is email-only (e.g. signup email).
 */
export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, message: validationMessages.email.required };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, message: validationMessages.email.invalid };
  }
  return { valid: true };
}
