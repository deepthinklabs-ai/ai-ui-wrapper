/**
 * Subscription Service
 *
 * Centralizes all subscription verification and management logic.
 * This eliminates duplication across dashboard and settings pages.
 */

import { UserTier } from '@/lib/config/tiers';

/**
 * Retry strategy configuration
 */
export interface RetryStrategy {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number;
}

/**
 * Predefined retry strategies
 */
export const RETRY_STRATEGIES = {
  // Fast polling for immediate feedback (used after checkout)
  AGGRESSIVE: { maxAttempts: 10, delayMs: 500 },
  // Slower polling for background checks
  CONSERVATIVE: { maxAttempts: 3, delayMs: 2000 },
  // Exponential backoff for resilience
  EXPONENTIAL: { maxAttempts: 5, delayMs: 500, backoffMultiplier: 2 },
} as const;

/**
 * Result of subscription verification
 */
export interface VerificationResult {
  verified: boolean;
  tier: UserTier;
  message?: string;
  error?: string;
}

/**
 * Verify subscription status with retry logic
 *
 * @param userId - The user ID to verify
 * @param strategy - Retry strategy to use (default: AGGRESSIVE)
 * @param onProgress - Optional callback for progress updates
 * @returns Promise with verification result
 */
export async function verifySubscriptionWithRetry(
  userId: string,
  strategy: RetryStrategy = RETRY_STRATEGIES.AGGRESSIVE,
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<VerificationResult> {
  let lastResult: VerificationResult = {
    verified: false,
    tier: 'pending',
    message: 'Verification not started',
  };

  for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
    try {
      // Notify progress if callback provided
      if (onProgress) {
        onProgress(attempt, strategy.maxAttempts);
      }

      console.log(`[SubscriptionService] Verification attempt ${attempt}/${strategy.maxAttempts}`);

      const response = await fetch('/api/stripe/verify-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (data.verified && (data.tier === 'pro' || data.tier === 'trial')) {
        console.log(`[SubscriptionService] Verified: tier=${data.tier}`);
        return {
          verified: true,
          tier: data.tier,
          message: data.message,
        };
      }

      lastResult = {
        verified: false,
        tier: data.tier || 'pending',
        message: data.message || 'Not verified yet',
      };

      // If not the last attempt, wait before retry
      if (attempt < strategy.maxAttempts) {
        const delay = strategy.backoffMultiplier
          ? strategy.delayMs * Math.pow(strategy.backoffMultiplier, attempt - 1)
          : strategy.delayMs;

        console.log(`[SubscriptionService] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    } catch (error) {
      console.error(`[SubscriptionService] Attempt ${attempt} failed:`, error);
      lastResult = {
        verified: false,
        tier: 'pending',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      // If not the last attempt, wait before retry
      if (attempt < strategy.maxAttempts) {
        const delay = strategy.backoffMultiplier
          ? strategy.delayMs * Math.pow(strategy.backoffMultiplier, attempt - 1)
          : strategy.delayMs;
        await sleep(delay);
      }
    }
  }

  console.log(`[SubscriptionService] Max retries reached, returning last result`);
  return lastResult;
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if subscription is active (trial or pro)
 */
export function isSubscriptionActive(tier: UserTier): boolean {
  return tier === 'trial' || tier === 'pro';
}
