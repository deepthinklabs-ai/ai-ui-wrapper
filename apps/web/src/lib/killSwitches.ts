/**
 * Kill Switches - Emergency Feature Controls
 *
 * Provides real-time toggle capability for critical system features.
 * Kill switches are stored in Supabase and cached server-side for performance.
 *
 * Available switches:
 *   - master_kill_switch: Disables ALL AI API calls (emergency shutoff)
 *   - ai_features_enabled: Enables/disables AI features
 *   - oauth_enabled: Enables/disables OAuth connections
 *   - new_signups_enabled: Enables/disables new registrations
 *   - payments_enabled: Enables/disables Stripe payments
 *
 * Usage:
 *   import { isAIEnabled, isKillSwitchActive, checkKillSwitch } from '@/lib/killSwitches';
 *
 *   // In an API route:
 *   if (await isKillSwitchActive()) {
 *     return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 });
 *   }
 */

import { createClient } from "@supabase/supabase-js";

// Kill switch keys
export type KillSwitchKey =
  | "master_kill_switch"
  | "ai_features_enabled"
  | "oauth_enabled"
  | "new_signups_enabled"
  | "payments_enabled";

// Cache for kill switch values
interface CacheEntry {
  value: boolean;
  expiry: number;
}

const cache = new Map<KillSwitchKey, CacheEntry>();

// Cache TTL in milliseconds (30 seconds for responsive toggling)
const CACHE_TTL_MS = 30_000;

// Supabase admin client (lazy initialized)
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error("[KillSwitch] Missing Supabase credentials");
      return null;
    }

    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

/**
 * Get a kill switch value from database (with caching)
 */
async function getKillSwitchValue(key: KillSwitchKey): Promise<boolean | null> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.value;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // If Supabase isn't configured, return safe defaults
    console.warn("[KillSwitch] Supabase not configured, using safe defaults");
    return getDefaultValue(key);
  }

  try {
    const { data, error } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", key)
      .single();

    if (error || !data) {
      // Table might not exist yet, use defaults
      if (error?.code === "PGRST116" || error?.code === "42P01") {
        console.warn(`[KillSwitch] Config not found for ${key}, using default`);
        const defaultValue = getDefaultValue(key);
        cacheValue(key, defaultValue);
        return defaultValue;
      }
      console.error(`[KillSwitch] Error fetching ${key}:`, error?.message);
      return getDefaultValue(key);
    }

    // Parse the JSONB value (stored as boolean)
    const rawValue = (data as { value: unknown }).value;
    const value = rawValue === true || rawValue === "true";
    cacheValue(key, value);
    return value;
  } catch (error) {
    console.error(`[KillSwitch] Unexpected error fetching ${key}:`, error);
    return getDefaultValue(key);
  }
}

/**
 * Cache a kill switch value
 */
function cacheValue(key: KillSwitchKey, value: boolean): void {
  cache.set(key, {
    value,
    expiry: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Get safe default values for kill switches
 * Defaults are designed to be permissive (features enabled) to prevent
 * accidental lockouts if the database is unavailable
 */
function getDefaultValue(key: KillSwitchKey): boolean {
  switch (key) {
    case "master_kill_switch":
      // Default OFF (not triggered) - allows services to run
      return false;
    case "ai_features_enabled":
    case "oauth_enabled":
    case "new_signups_enabled":
    case "payments_enabled":
      // Default ON (enabled) - allows services to run
      return true;
    default:
      return true;
  }
}

/**
 * Clear the kill switch cache
 * Useful for testing or forcing a refresh
 */
export function clearKillSwitchCache(): void {
  cache.clear();
}

// ============================================================================
// Public API - Convenience Functions
// ============================================================================

/**
 * Check if the master kill switch is active (AI services disabled)
 * Returns true if services should be BLOCKED
 */
export async function isKillSwitchActive(): Promise<boolean> {
  const isActive = await getKillSwitchValue("master_kill_switch");
  return isActive === true;
}

/**
 * Check if AI features are enabled
 * Returns true if AI features should work
 */
export async function isAIEnabled(): Promise<boolean> {
  // First check master kill switch
  const isKilled = await isKillSwitchActive();
  if (isKilled) {
    return false;
  }

  const enabled = await getKillSwitchValue("ai_features_enabled");
  return enabled === true;
}

/**
 * Check if OAuth features are enabled
 * Returns true if OAuth should work
 */
export async function isOAuthEnabled(): Promise<boolean> {
  const enabled = await getKillSwitchValue("oauth_enabled");
  return enabled === true;
}

/**
 * Check if new signups are enabled
 * Returns true if signups should be allowed
 */
export async function isSignupEnabled(): Promise<boolean> {
  const enabled = await getKillSwitchValue("new_signups_enabled");
  return enabled === true;
}

/**
 * Check if payments are enabled
 * Returns true if payments should work
 */
export async function isPaymentsEnabled(): Promise<boolean> {
  const enabled = await getKillSwitchValue("payments_enabled");
  return enabled === true;
}

/**
 * Get all kill switch states at once
 * Useful for admin dashboards
 */
export async function getAllKillSwitchStates(): Promise<
  Record<KillSwitchKey, boolean>
> {
  const [masterKill, ai, oauth, signups, payments] = await Promise.all([
    getKillSwitchValue("master_kill_switch"),
    getKillSwitchValue("ai_features_enabled"),
    getKillSwitchValue("oauth_enabled"),
    getKillSwitchValue("new_signups_enabled"),
    getKillSwitchValue("payments_enabled"),
  ]);

  return {
    master_kill_switch: masterKill ?? false,
    ai_features_enabled: ai ?? true,
    oauth_enabled: oauth ?? true,
    new_signups_enabled: signups ?? true,
    payments_enabled: payments ?? true,
  };
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Check if AI is enabled and return an error response if not
 * Use in API routes for consistent error handling
 */
export async function checkAIEnabled(): Promise<{
  enabled: boolean;
  error?: { message: string; status: number };
}> {
  const isKilled = await isKillSwitchActive();
  if (isKilled) {
    return {
      enabled: false,
      error: {
        message: "AI services are temporarily unavailable. Please try again later.",
        status: 503,
      },
    };
  }

  const aiEnabled = await getKillSwitchValue("ai_features_enabled");
  if (!aiEnabled) {
    return {
      enabled: false,
      error: {
        message: "AI features are currently disabled. Please try again later.",
        status: 503,
      },
    };
  }

  return { enabled: true };
}

/**
 * Check if OAuth is enabled and return an error response if not
 */
export async function checkOAuthEnabled(): Promise<{
  enabled: boolean;
  error?: { message: string; status: number };
}> {
  const enabled = await isOAuthEnabled();
  if (!enabled) {
    return {
      enabled: false,
      error: {
        message: "OAuth connections are temporarily disabled. Please try again later.",
        status: 503,
      },
    };
  }
  return { enabled: true };
}

/**
 * Check if signups are enabled and return an error response if not
 */
export async function checkSignupEnabled(): Promise<{
  enabled: boolean;
  error?: { message: string; status: number };
}> {
  const enabled = await isSignupEnabled();
  if (!enabled) {
    return {
      enabled: false,
      error: {
        message: "New registrations are temporarily closed. Please try again later.",
        status: 503,
      },
    };
  }
  return { enabled: true };
}

/**
 * Check if payments are enabled and return an error response if not
 */
export async function checkPaymentsEnabled(): Promise<{
  enabled: boolean;
  error?: { message: string; status: number };
}> {
  const enabled = await isPaymentsEnabled();
  if (!enabled) {
    return {
      enabled: false,
      error: {
        message: "Payment processing is temporarily unavailable. Please try again later.",
        status: 503,
      },
    };
  }
  return { enabled: true };
}
