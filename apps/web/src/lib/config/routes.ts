/**
 * Route Configuration
 *
 * Single source of truth for all application routes.
 * This prevents hardcoded URLs scattered across the codebase.
 */

/**
 * Application routes
 */
export const ROUTES = {
  // Public routes (no auth required)
  AUTH: '/auth',
  STAGING_LOGIN: '/staging-login',
  DOCS: '/docs',
  PRIVACY_POLICY: '/privacy-policy',
  TERMS: '/terms',
  CONTACT: '/contact',

  // Protected routes (auth required)
  DASHBOARD: '/dashboard',
  SETTINGS: '/settings',
  CANVAS: '/canvas',
} as const;

/**
 * URL query parameters
 */
export const QUERY_PARAMS = {
  UPGRADE_SUCCESS: 'upgrade=success',
  UPGRADE_CANCELED: 'upgrade=canceled',
  FROM_ONBOARDING: 'onboarding=true',
} as const;

/**
 * Stripe redirect configurations
 */
export const STRIPE_REDIRECTS = {
  // After successful checkout, go to settings to configure API keys
  SUCCESS_URL: `${ROUTES.SETTINGS}?${QUERY_PARAMS.UPGRADE_SUCCESS}`,
  // After cancel/back, go to dashboard (will show plan selection for pending users)
  CANCEL_URL: ROUTES.DASHBOARD,
} as const;

/**
 * Build a URL with the success parameter
 */
export function buildSuccessUrl(origin: string): string {
  return `${origin}${STRIPE_REDIRECTS.SUCCESS_URL}`;
}

/**
 * Build a URL with the cancel parameter
 */
export function buildCancelUrl(origin: string): string {
  return `${origin}${STRIPE_REDIRECTS.CANCEL_URL}`;
}

/**
 * Check if current URL has upgrade success parameter
 */
export function isUpgradeSuccessUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('upgrade') === 'success';
}

/**
 * Clean up upgrade parameter from URL
 */
export function cleanUpgradeParam(route: string = ROUTES.SETTINGS): void {
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', route);
  }
}
