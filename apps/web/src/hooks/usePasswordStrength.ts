/**
 * usePasswordStrength Hook
 *
 * React hook that provides real-time password strength checking
 * as the user types.
 */

import { useMemo } from 'react';
import { calculatePasswordStrength, type PasswordStrengthResult } from '@/lib/passwordStrength';

type UsePasswordStrengthOptions = {
  password: string;
  enabled?: boolean; // Only calculate if enabled (e.g., only on signup page)
};

export function usePasswordStrength({ password, enabled = true }: UsePasswordStrengthOptions): PasswordStrengthResult {
  const result = useMemo(() => {
    if (!enabled) {
      return {
        strength: 'weak' as const,
        score: 0,
        feedback: [],
      };
    }

    return calculatePasswordStrength(password);
  }, [password, enabled]);

  return result;
}
