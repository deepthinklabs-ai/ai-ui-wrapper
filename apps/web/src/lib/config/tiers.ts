/**
 * Tier Configuration
 *
 * Single source of truth for all tier-related constants and mappings.
 * This centralizes tier definitions to prevent inconsistencies.
 */

/**
 * User subscription tiers
 */
export type UserTier = 'trial' | 'pro' | 'expired' | 'pending';

/**
 * Stripe subscription statuses that map to our tiers
 */
export type StripeSubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'past_due'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired';

/**
 * Tier configuration with limits and features
 */
export const TIER_CONFIG = {
  trial: {
    name: '7-Day Free Trial',
    maxThreads: Infinity,
    canUseServices: true,
    description: 'Full access during trial period',
  },
  pro: {
    name: 'Pro',
    maxThreads: Infinity,
    canUseServices: true,
    description: 'Full unlimited access',
  },
  expired: {
    name: 'Expired',
    maxThreads: 0,
    canUseServices: false,
    description: 'Trial ended - subscribe to continue',
  },
  pending: {
    name: 'Pending',
    maxThreads: 0,
    canUseServices: false,
    description: 'Complete payment to access',
  },
} as const;

/**
 * Tiers that allow service access
 */
export const SERVICE_TIERS: readonly UserTier[] = ['trial', 'pro'];

/**
 * Tiers that block service access
 */
export const BLOCKED_TIERS: readonly UserTier[] = ['pending', 'expired'];

/**
 * Map Stripe subscription status to our tier
 * Single source of truth for this mapping
 */
export function mapStripeStatusToTier(stripeStatus: string): UserTier {
  switch (stripeStatus) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'pro';
    case 'canceled':
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired';
    default:
      console.warn(`[tiers] Unknown Stripe status: ${stripeStatus}, defaulting to expired`);
      return 'expired';
  }
}

/**
 * Check if a tier can use services
 */
export function canTierUseServices(tier: UserTier): boolean {
  return TIER_CONFIG[tier].canUseServices;
}

/**
 * Check if user should see onboarding
 */
export function shouldShowOnboarding(tier: UserTier, onboardingCompleted: boolean): boolean {
  return !onboardingCompleted || tier === 'pending';
}
