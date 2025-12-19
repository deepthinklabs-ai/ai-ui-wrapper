/**
 * Rate Limiting Utility
 *
 * Server-side rate limiting for Pro users using corporate API keys.
 * Supports per-model limits with daily reset at midnight EST.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  tier: string;
  model_name: string;
  daily_requests: number;
  daily_tokens: number;
  requests_per_minute: number;
  warning_threshold: number;
}

// Anti-bot protection: minimum seconds between requests
const MIN_REQUEST_INTERVAL_SECONDS = 2;

export interface UsageStatus {
  daily_requests_used: number;
  daily_requests_limit: number;
  daily_tokens_used: number;
  daily_tokens_limit: number;
  minute_requests_used: number;
  minute_requests_limit: number;
  requests_remaining: number;
  tokens_remaining: number;
  is_warning: boolean;           // At or above warning threshold
  is_blocked: boolean;           // At or above limit
  block_reason?: 'daily_requests' | 'daily_tokens' | 'minute_requests' | 'burst_limit';
  warning_message?: string;
  seconds_until_next_request?: number;  // For burst limiting
  reset_time: string;            // ISO timestamp for midnight EST
}

export interface RateLimitResult {
  allowed: boolean;
  status: UsageStatus;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get current date in EST timezone (for daily reset)
 */
function getESTDate(): string {
  const now = new Date();
  // Convert to EST (UTC-5) or EDT (UTC-4)
  const estOffset = -5 * 60; // EST offset in minutes
  const localOffset = now.getTimezoneOffset();
  const estTime = new Date(now.getTime() + (localOffset - estOffset) * 60000);

  // Format as YYYY-MM-DD
  return estTime.toISOString().split('T')[0];
}

/**
 * Get next midnight EST as ISO timestamp
 */
function getNextMidnightEST(): string {
  const now = new Date();
  const estOffset = -5 * 60;
  const localOffset = now.getTimezoneOffset();

  // Get current EST time
  const estTime = new Date(now.getTime() + (localOffset - estOffset) * 60000);

  // Set to next midnight
  estTime.setDate(estTime.getDate() + 1);
  estTime.setHours(0, 0, 0, 0);

  // Convert back to UTC
  const utcMidnight = new Date(estTime.getTime() - (localOffset - estOffset) * 60000);

  return utcMidnight.toISOString();
}

/**
 * Get current minute bucket (truncated to minute)
 */
function getMinuteBucket(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get rate limit configuration for a model and tier
 */
export async function getRateLimitConfig(
  supabase: SupabaseClient,
  tier: string,
  modelName: string
): Promise<RateLimitConfig | null> {
  const { data, error } = await supabase
    .from('model_rate_limits')
    .select('*')
    .eq('tier', tier)
    .eq('model_name', modelName)
    .single();

  if (error || !data) {
    console.warn(`[RateLimit] No config found for tier=${tier}, model=${modelName}`);
    return null;
  }

  return data as RateLimitConfig;
}

/**
 * Get current usage status for a user and model
 */
export async function getUsageStatus(
  supabase: SupabaseClient,
  userId: string,
  modelName: string,
  config: RateLimitConfig
): Promise<UsageStatus> {
  const estDate = getESTDate();
  const minuteBucket = getMinuteBucket();

  // Get daily usage (includes last_request_at for burst protection)
  const { data: dailyUsage } = await supabase
    .from('user_daily_usage')
    .select('request_count, token_count, last_request_at')
    .eq('user_id', userId)
    .eq('model_name', modelName)
    .eq('usage_date', estDate)
    .single();

  // Get minute usage
  const { data: minuteUsage } = await supabase
    .from('user_minute_usage')
    .select('request_count')
    .eq('user_id', userId)
    .eq('model_name', modelName)
    .eq('minute_bucket', minuteBucket)
    .single();

  const dailyRequestsUsed = dailyUsage?.request_count || 0;
  const dailyTokensUsed = dailyUsage?.token_count || 0;
  const minuteRequestsUsed = minuteUsage?.request_count || 0;
  const lastRequestAt = dailyUsage?.last_request_at ? new Date(dailyUsage.last_request_at) : null;

  const requestsRemaining = Math.max(0, config.daily_requests - dailyRequestsUsed);
  const tokensRemaining = Math.max(0, config.daily_tokens - dailyTokensUsed);

  // Check if at warning threshold
  const requestsPercentage = dailyRequestsUsed / config.daily_requests;
  const tokensPercentage = dailyTokensUsed / config.daily_tokens;
  const isWarning = requestsPercentage >= config.warning_threshold ||
                    tokensPercentage >= config.warning_threshold;

  // Check if blocked (order matters - burst limit first for bot protection)
  let isBlocked = false;
  let blockReason: UsageStatus['block_reason'] = undefined;
  let secondsUntilNextRequest: number | undefined;

  // BURST/BOT PROTECTION: Check if last request was too recent
  if (lastRequestAt) {
    const secondsSinceLastRequest = (Date.now() - lastRequestAt.getTime()) / 1000;
    if (secondsSinceLastRequest < MIN_REQUEST_INTERVAL_SECONDS) {
      isBlocked = true;
      blockReason = 'burst_limit';
      secondsUntilNextRequest = Math.ceil(MIN_REQUEST_INTERVAL_SECONDS - secondsSinceLastRequest);
    }
  }

  // Check other limits only if not already blocked by burst limit
  if (!isBlocked) {
    if (dailyRequestsUsed >= config.daily_requests) {
      isBlocked = true;
      blockReason = 'daily_requests';
    } else if (dailyTokensUsed >= config.daily_tokens) {
      isBlocked = true;
      blockReason = 'daily_tokens';
    } else if (minuteRequestsUsed >= config.requests_per_minute) {
      isBlocked = true;
      blockReason = 'minute_requests';
    }
  }

  // Generate warning message if applicable
  let warningMessage: string | undefined;
  if (isWarning && !isBlocked) {
    const higherUsage = requestsPercentage > tokensPercentage ? 'requests' : 'tokens';
    const percentage = Math.round(Math.max(requestsPercentage, tokensPercentage) * 100);
    warningMessage = `You've used ${percentage}% of your daily ${higherUsage} limit for ${modelName}. Consider using a more efficient model.`;
  }

  return {
    daily_requests_used: dailyRequestsUsed,
    daily_requests_limit: config.daily_requests,
    daily_tokens_used: dailyTokensUsed,
    daily_tokens_limit: config.daily_tokens,
    minute_requests_used: minuteRequestsUsed,
    minute_requests_limit: config.requests_per_minute,
    requests_remaining: requestsRemaining,
    tokens_remaining: tokensRemaining,
    is_warning: isWarning,
    is_blocked: isBlocked,
    block_reason: blockReason,
    warning_message: warningMessage,
    seconds_until_next_request: secondsUntilNextRequest,
    reset_time: getNextMidnightEST(),
  };
}

/**
 * Check if a request is allowed (pre-request check)
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  tier: string,
  modelName: string
): Promise<RateLimitResult> {
  // Get rate limit config
  const config = await getRateLimitConfig(supabase, tier, modelName);

  if (!config) {
    // No config = no limits (fallback for unconfigured models)
    console.warn(`[RateLimit] No config for ${modelName}, allowing request`);
    return {
      allowed: true,
      status: {
        daily_requests_used: 0,
        daily_requests_limit: Infinity,
        daily_tokens_used: 0,
        daily_tokens_limit: Infinity,
        minute_requests_used: 0,
        minute_requests_limit: Infinity,
        requests_remaining: Infinity,
        tokens_remaining: Infinity,
        is_warning: false,
        is_blocked: false,
        reset_time: getNextMidnightEST(),
      },
    };
  }

  const status = await getUsageStatus(supabase, userId, modelName, config);

  return {
    allowed: !status.is_blocked,
    status,
  };
}

/**
 * Immediately record request timestamp for burst protection
 * Call this right after checkRateLimit passes, BEFORE making API call
 */
export async function recordRequestTimestamp(
  supabase: SupabaseClient,
  userId: string,
  modelName: string
): Promise<void> {
  const estDate = getESTDate();
  const now = new Date().toISOString();

  // Try to update existing record first (preserves counts)
  const { data: updated } = await supabase
    .from('user_daily_usage')
    .update({ last_request_at: now, updated_at: now })
    .eq('user_id', userId)
    .eq('model_name', modelName)
    .eq('usage_date', estDate)
    .select('id')
    .single();

  // If no record exists, create one
  if (!updated) {
    await supabase
      .from('user_daily_usage')
      .insert({
        user_id: userId,
        model_name: modelName,
        usage_date: estDate,
        request_count: 0,
        token_count: 0,
        last_request_at: now,
      });
  }

  console.log(`[RateLimit] Recorded request timestamp: user=${userId}, model=${modelName}`);
}

/**
 * Record usage after a successful request
 */
export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  modelName: string,
  tokensUsed: number
): Promise<void> {
  const estDate = getESTDate();
  const minuteBucket = getMinuteBucket();
  const now = new Date().toISOString();

  // Upsert daily usage
  const { error: dailyError } = await supabase
    .from('user_daily_usage')
    .upsert(
      {
        user_id: userId,
        model_name: modelName,
        usage_date: estDate,
        request_count: 1,
        token_count: tokensUsed,
        last_request_at: now,
        updated_at: now,
      },
      {
        onConflict: 'user_id,model_name,usage_date',
      }
    );

  if (dailyError) {
    // If upsert fails, try increment approach
    const { data: existing } = await supabase
      .from('user_daily_usage')
      .select('id, request_count, token_count')
      .eq('user_id', userId)
      .eq('model_name', modelName)
      .eq('usage_date', estDate)
      .single();

    if (existing) {
      await supabase
        .from('user_daily_usage')
        .update({
          request_count: existing.request_count + 1,
          token_count: existing.token_count + tokensUsed,
          last_request_at: now,
          updated_at: now,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('user_daily_usage')
        .insert({
          user_id: userId,
          model_name: modelName,
          usage_date: estDate,
          request_count: 1,
          token_count: tokensUsed,
          last_request_at: now,
        });
    }
  } else {
    // Upsert succeeded but we need to increment, not replace
    // Fetch current and update
    const { data: current } = await supabase
      .from('user_daily_usage')
      .select('id, request_count, token_count')
      .eq('user_id', userId)
      .eq('model_name', modelName)
      .eq('usage_date', estDate)
      .single();

    if (current && current.request_count === 1) {
      // This was an insert, we're good
    } else if (current) {
      // Need to properly increment
      await supabase
        .from('user_daily_usage')
        .update({
          request_count: current.request_count + 1,
          token_count: current.token_count + tokensUsed,
          last_request_at: now,
          updated_at: now,
        })
        .eq('id', current.id);
    }
  }

  // Upsert minute usage
  const { error: minuteError } = await supabase
    .from('user_minute_usage')
    .upsert(
      {
        user_id: userId,
        model_name: modelName,
        minute_bucket: minuteBucket,
        request_count: 1,
      },
      {
        onConflict: 'user_id,model_name,minute_bucket',
      }
    );

  if (minuteError) {
    // Try increment approach
    const { data: existing } = await supabase
      .from('user_minute_usage')
      .select('id, request_count')
      .eq('user_id', userId)
      .eq('model_name', modelName)
      .eq('minute_bucket', minuteBucket)
      .single();

    if (existing) {
      await supabase
        .from('user_minute_usage')
        .update({
          request_count: existing.request_count + 1,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('user_minute_usage')
        .insert({
          user_id: userId,
          model_name: modelName,
          minute_bucket: minuteBucket,
          request_count: 1,
        });
    }
  } else {
    // Fetch and increment if needed
    const { data: current } = await supabase
      .from('user_minute_usage')
      .select('id, request_count')
      .eq('user_id', userId)
      .eq('model_name', modelName)
      .eq('minute_bucket', minuteBucket)
      .single();

    if (current && current.request_count > 1) {
      // Already existed, increment
      await supabase
        .from('user_minute_usage')
        .update({
          request_count: current.request_count + 1,
        })
        .eq('id', current.id);
    }
  }

  console.log(`[RateLimit] Recorded usage: user=${userId}, model=${modelName}, tokens=${tokensUsed}`);
}

/**
 * Get formatted error message for rate limit block
 */
export function getRateLimitErrorMessage(status: UsageStatus): string {
  switch (status.block_reason) {
    case 'burst_limit':
      return `Slow down! Please wait ${status.seconds_until_next_request || 2} second(s) between requests.`;
    case 'daily_requests':
      return `Daily request limit reached (${status.daily_requests_used}/${status.daily_requests_limit}). Resets at midnight EST.`;
    case 'daily_tokens':
      return `Daily token limit reached (${status.daily_tokens_used.toLocaleString()}/${status.daily_tokens_limit.toLocaleString()}). Resets at midnight EST.`;
    case 'minute_requests':
      return `Too many requests. Please wait a moment and try again (${status.minute_requests_used}/${status.minute_requests_limit} per minute).`;
    default:
      return 'Rate limit exceeded. Please try again later.';
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(status: UsageStatus): Record<string, string> {
  return {
    'X-RateLimit-Limit-Requests': status.daily_requests_limit.toString(),
    'X-RateLimit-Remaining-Requests': status.requests_remaining.toString(),
    'X-RateLimit-Limit-Tokens': status.daily_tokens_limit.toString(),
    'X-RateLimit-Remaining-Tokens': status.tokens_remaining.toString(),
    'X-RateLimit-Reset': status.reset_time,
    ...(status.is_warning && status.warning_message
      ? { 'X-RateLimit-Warning': status.warning_message }
      : {}),
  };
}

// ============================================================================
// ADMIN NOTIFICATIONS
// ============================================================================

// Track recent threshold checks to prevent spam
const recentThresholdChecks = new Map<string, number>();
const THRESHOLD_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a user has been rate limited too frequently and notify admins
 * Call this after a rate limit block is detected
 *
 * @param supabase - Supabase client
 * @param userId - User ID that was blocked
 * @param userEmail - User's email (if available)
 * @param modelName - Model that was rate limited
 * @param blockReason - Why the user was blocked
 */
export async function checkRateLimitAlertThreshold(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null,
  modelName: string,
  blockReason: string
): Promise<void> {
  // Check cooldown to prevent spam
  const key = `threshold:${userId}`;
  const lastChecked = recentThresholdChecks.get(key);

  if (lastChecked && Date.now() - lastChecked < THRESHOLD_COOLDOWN_MS) {
    return; // Already checked recently
  }

  recentThresholdChecks.set(key, Date.now());

  // Clean up old entries
  if (recentThresholdChecks.size > 100) {
    const now = Date.now();
    for (const [k, v] of recentThresholdChecks.entries()) {
      if (now - v > THRESHOLD_COOLDOWN_MS) {
        recentThresholdChecks.delete(k);
      }
    }
  }

  try {
    // Count recent rate limit blocks for this user from audit logs
    const windowStart = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { count, error } = await supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'rate_limit_exceeded')
      .eq('user_id', userId)
      .gte('timestamp', windowStart);

    if (error) {
      console.error('[RateLimit] Failed to check threshold:', error.message);
      return;
    }

    // Alert if user has been blocked 5+ times in 5 minutes
    const ALERT_THRESHOLD = 5;
    if (count && count >= ALERT_THRESHOLD) {
      // Dynamic import to avoid circular dependencies
      const { notifyRateLimitThreshold } = await import('./errorNotifications');
      await notifyRateLimitThreshold(userId, userEmail, modelName, count);
    }
  } catch (err) {
    console.error('[RateLimit] Error checking alert threshold:', err);
  }
}
