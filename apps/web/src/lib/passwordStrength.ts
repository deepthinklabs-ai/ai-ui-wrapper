/**
 * Password Strength Utility
 *
 * Calculates password strength based on various criteria:
 * - Length
 * - Character variety (lowercase, uppercase, numbers, special chars)
 * - Common patterns
 */

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export type PasswordStrengthResult = {
  strength: PasswordStrength;
  score: number; // 0-100
  feedback: string[];
};

/**
 * Calculate password strength
 * @param password - The password to analyze
 * @returns Strength result with score and feedback
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      strength: 'weak',
      score: 0,
      feedback: ['Password is required'],
    };
  }

  let score = 0;
  const feedback: string[] = [];

  // Length check (max 40 points)
  if (password.length >= 8) {
    score += 20;
  } else {
    feedback.push('Use at least 8 characters');
  }

  if (password.length >= 12) {
    score += 10;
  }

  if (password.length >= 16) {
    score += 10;
  }

  // Character variety checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLowercase) {
    score += 10;
  } else {
    feedback.push('Add lowercase letters');
  }

  if (hasUppercase) {
    score += 10;
  } else {
    feedback.push('Add uppercase letters');
  }

  if (hasNumbers) {
    score += 15;
  } else {
    feedback.push('Add numbers');
  }

  if (hasSpecialChars) {
    score += 15;
  } else {
    feedback.push('Add special characters (!@#$%^&*)');
  }

  // Bonus for mixing all character types
  if (hasLowercase && hasUppercase && hasNumbers && hasSpecialChars) {
    score += 20;
  }

  // Common pattern penalties
  const commonPatterns = [
    /^123456/,
    /^password/i,
    /^qwerty/i,
    /^abc123/i,
    /^111111/,
    /(.)\1{2,}/, // Repeated characters (e.g., 'aaa', '111')
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score = Math.max(0, score - 20);
      feedback.push('Avoid common patterns or repeated characters');
      break;
    }
  }

  // Cap score at 100
  score = Math.min(100, score);

  // Determine strength level
  let strength: PasswordStrength;
  if (score < 40) {
    strength = 'weak';
  } else if (score < 60) {
    strength = 'fair';
  } else if (score < 80) {
    strength = 'good';
  } else {
    strength = 'strong';
  }

  return {
    strength,
    score,
    feedback: feedback.length > 0 ? feedback : ['Great password!'],
  };
}
