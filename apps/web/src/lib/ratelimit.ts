/**
 * Simple In-Memory Rate Limiter
 *
 * For production, use a Redis-based solution like @upstash/ratelimit
 * This implementation is sufficient for development and small-scale production
 */

type RateLimitRecord = {
  count: number;
  resetTime: number;
};

// Store request counts per user
const requestCounts = new Map<string, RateLimitRecord>();

export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Rate limit requests per identifier (usually user ID)
 */
export function ratelimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 10000 }
): RateLimitResult {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  // No record or window expired - create new
  if (!record || now > record.resetTime) {
    const resetTime = now + config.windowMs;
    requestCounts.set(identifier, { count: 1, resetTime });

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: resetTime,
    };
  }

  // Limit exceeded
  if (record.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: record.resetTime,
    };
  }

  // Increment count
  record.count++;

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - record.count,
    reset: record.resetTime,
  };
}

/**
 * Stricter rate limits for sensitive operations
 * 3 requests per minute
 */
export function strictRatelimit(identifier: string): RateLimitResult {
  return ratelimit(identifier, {
    maxRequests: 3,
    windowMs: 60000, // 1 minute
  });
}

/**
 * Standard rate limits for API operations
 * 10 requests per 10 seconds
 */
export function standardRatelimit(identifier: string): RateLimitResult {
  return ratelimit(identifier, {
    maxRequests: 10,
    windowMs: 10000, // 10 seconds
  });
}

/**
 * Lenient rate limits for read operations
 * 30 requests per 10 seconds
 */
export function lenientRatelimit(identifier: string): RateLimitResult {
  return ratelimit(identifier, {
    maxRequests: 30,
    windowMs: 10000, // 10 seconds
  });
}

/**
 * Cleanup old entries periodically
 * Call this from a background job or cron
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = cleanupExpiredEntries();
    if (cleaned > 0) {
      console.log(`[Rate Limit] Cleaned up ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000);
}

/**
 * Helper to format rate limit error response
 */
export function rateLimitErrorResponse(result: RateLimitResult) {
  return {
    error: 'Rate limit exceeded',
    message: `Too many requests. Limit: ${result.limit} requests per window.`,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: new Date(result.reset).toISOString(),
    retryAfter: Math.ceil((result.reset - Date.now()) / 1000), // seconds
  };
}
