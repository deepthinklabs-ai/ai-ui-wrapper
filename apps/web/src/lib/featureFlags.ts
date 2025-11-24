/**
 * Feature Flags - Environment-Based Feature Control
 *
 * Simple on/off switches for features using environment variables.
 * Controls visibility of experimental/unreleased features.
 *
 * Usage:
 *   import { FEATURE_FLAGS } from '@/lib/featureFlags';
 *
 *   {FEATURE_FLAGS.ASK_ANSWER && <AskAnswerUI />}
 */

export const FEATURE_FLAGS = {
  /**
   * Ask/Answer Feature
   * Allows Genesis Bot nodes to communicate with each other.
   *
   * Enable in .env.local:
   *   NEXT_PUBLIC_ENABLE_ASK_ANSWER=true
   */
  ASK_ANSWER: process.env.NEXT_PUBLIC_ENABLE_ASK_ANSWER === 'true',

  /**
   * Debug Mode
   * Shows additional debugging information and tools.
   * Automatically enabled in development.
   */
  DEBUG_MODE: process.env.NODE_ENV === 'development',
} as const;

/**
 * Helper function to check if a feature is enabled
 * Useful for conditional logic in hooks/utils
 */
export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature];
}

/**
 * Log feature flag states (useful for debugging)
 */
export function logFeatureFlags(): void {
  if (FEATURE_FLAGS.DEBUG_MODE) {
    console.log('[Feature Flags]', FEATURE_FLAGS);
  }
}
