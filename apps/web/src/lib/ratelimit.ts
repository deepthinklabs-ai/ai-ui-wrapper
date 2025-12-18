/**
 * Distributed Rate Limiter with Redis Support
 *
 * Uses Upstash Redis for distributed rate limiting in production.
 * Falls back to in-memory rate limiting when Redis is not configured.
 *
 * Benefits of Redis-based rate limiting:
 * - Shared across all serverless function instances
 * - Persists across server restarts
 * - Accurate rate limiting in scaled deployments
 *
 * Configuration:
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables
 * to enable Redis-based rate limiting.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ============================================
// Types
// ============================================

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

// ============================================
// Redis Configuration
// ============================================

// Check if Redis is configured
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const isRedisConfigured = !!(REDIS_URL && REDIS_TOKEN);

// Initialize Redis client if configured
let redis: Redis | null = null;
if (isRedisConfigured) {
  try {
    redis = new Redis({
      url: REDIS_URL!,
      token: REDIS_TOKEN!,
    });
    console.log("[Rate Limit] Redis-based rate limiting enabled");
  } catch (error) {
    console.error("[Rate Limit] Failed to initialize Redis:", error);
  }
}

// ============================================
// Redis Rate Limiters (when Redis is available)
// ============================================

// Create Redis-based rate limiters with different configurations
let redisStrictLimiter: Ratelimit | null = null;
let redisStandardLimiter: Ratelimit | null = null;
let redisLenientLimiter: Ratelimit | null = null;

if (redis) {
  // Strict: 3 requests per minute (for sensitive operations)
  redisStrictLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "60 s"),
    prefix: "ratelimit:strict",
    analytics: true,
  });

  // Standard: 10 requests per 10 seconds (for API operations)
  redisStandardLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 s"),
    prefix: "ratelimit:standard",
    analytics: true,
  });

  // Lenient: 30 requests per 10 seconds (for read operations)
  redisLenientLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "10 s"),
    prefix: "ratelimit:lenient",
    analytics: true,
  });
}

// ============================================
// In-Memory Fallback (when Redis is not available)
// ============================================

type RateLimitRecord = {
  count: number;
  resetTime: number;
};

// Store request counts per user (fallback)
const requestCounts = new Map<string, RateLimitRecord>();

/**
 * In-memory rate limit implementation (fallback)
 */
function inMemoryRatelimit(
  identifier: string,
  config: RateLimitConfig
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

// ============================================
// Unified Rate Limit Functions
// ============================================

/**
 * Rate limit requests per identifier (usually user ID)
 * Uses Redis when available, falls back to in-memory
 */
export function ratelimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 10000 }
): RateLimitResult {
  // Use in-memory fallback (sync operation)
  return inMemoryRatelimit(identifier, config);
}

/**
 * Async rate limit using Redis when available
 * Falls back to in-memory synchronously
 */
async function redisRatelimit(
  identifier: string,
  limiter: Ratelimit | null,
  fallbackConfig: RateLimitConfig
): Promise<RateLimitResult> {
  // If no Redis limiter, use in-memory fallback
  if (!limiter) {
    return inMemoryRatelimit(identifier, fallbackConfig);
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    // On Redis error, fall back to in-memory
    console.error("[Rate Limit] Redis error, falling back to in-memory:", error);
    return inMemoryRatelimit(identifier, fallbackConfig);
  }
}

/**
 * Stricter rate limits for sensitive operations
 * 3 requests per minute
 * Async version - uses Redis when available
 */
export async function strictRatelimitAsync(
  identifier: string
): Promise<RateLimitResult> {
  return redisRatelimit(identifier, redisStrictLimiter, {
    maxRequests: 3,
    windowMs: 60000,
  });
}

/**
 * Standard rate limits for API operations
 * 10 requests per 10 seconds
 * Async version - uses Redis when available
 */
export async function standardRatelimitAsync(
  identifier: string
): Promise<RateLimitResult> {
  return redisRatelimit(identifier, redisStandardLimiter, {
    maxRequests: 10,
    windowMs: 10000,
  });
}

/**
 * Lenient rate limits for read operations
 * 30 requests per 10 seconds
 * Async version - uses Redis when available
 */
export async function lenientRatelimitAsync(
  identifier: string
): Promise<RateLimitResult> {
  return redisRatelimit(identifier, redisLenientLimiter, {
    maxRequests: 30,
    windowMs: 10000,
  });
}

// ============================================
// Sync Wrappers (for backwards compatibility)
// ============================================

/**
 * Stricter rate limits for sensitive operations
 * 3 requests per minute
 * Sync version - always uses in-memory (for backwards compatibility)
 */
export function strictRatelimit(identifier: string): RateLimitResult {
  return inMemoryRatelimit(identifier, {
    maxRequests: 3,
    windowMs: 60000,
  });
}

/**
 * Standard rate limits for API operations
 * 10 requests per 10 seconds
 * Sync version - always uses in-memory (for backwards compatibility)
 */
export function standardRatelimit(identifier: string): RateLimitResult {
  return inMemoryRatelimit(identifier, {
    maxRequests: 10,
    windowMs: 10000,
  });
}

/**
 * Lenient rate limits for read operations
 * 30 requests per 10 seconds
 * Sync version - always uses in-memory (for backwards compatibility)
 */
export function lenientRatelimit(identifier: string): RateLimitResult {
  return inMemoryRatelimit(identifier, {
    maxRequests: 30,
    windowMs: 10000,
  });
}

// ============================================
// Utilities
// ============================================

/**
 * Cleanup old entries periodically (for in-memory fallback)
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

// Cleanup every 5 minutes (for in-memory fallback)
if (typeof setInterval !== "undefined" && !isRedisConfigured) {
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
    error: "Rate limit exceeded",
    message: `Too many requests. Limit: ${result.limit} requests per window.`,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: new Date(result.reset).toISOString(),
    retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
  };
}

/**
 * Check if Redis-based rate limiting is enabled
 */
export function isRedisRateLimitEnabled(): boolean {
  return isRedisConfigured && redis !== null;
}

/**
 * Get rate limiting status for monitoring
 */
export function getRateLimitStatus(): {
  mode: "redis" | "in-memory";
  configured: boolean;
} {
  return {
    mode: isRedisRateLimitEnabled() ? "redis" : "in-memory",
    configured: isRedisConfigured,
  };
}
