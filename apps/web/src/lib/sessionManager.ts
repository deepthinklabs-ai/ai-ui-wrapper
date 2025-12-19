/**
 * Session Manager - Handles session lifecycle with timeout enforcement
 *
 * Security features:
 * - Idle timeout: Auto-logout after 20 minutes of inactivity
 * - Absolute timeout: Maximum 24-hour session duration
 * - Session metadata tracking in localStorage
 */

// Session timeout configuration
export const SESSION_CONFIG = {
  // Idle timeout: 20 minutes (in milliseconds)
  IDLE_TIMEOUT_MS: 20 * 60 * 1000,

  // Absolute timeout: 24 hours (in milliseconds)
  ABSOLUTE_TIMEOUT_MS: 24 * 60 * 60 * 1000,

  // Warning before timeout: 2 minutes (in milliseconds)
  WARNING_BEFORE_TIMEOUT_MS: 2 * 60 * 1000,

  // Activity check interval: 30 seconds
  CHECK_INTERVAL_MS: 30 * 1000,

  // Storage keys
  STORAGE_KEY_SESSION_START: 'session_start_time',
  STORAGE_KEY_LAST_ACTIVITY: 'session_last_activity',
  STORAGE_KEY_SESSION_ID: 'session_id',
} as const;

export type SessionState = {
  isValid: boolean;
  sessionId: string | null;
  startTime: number | null;
  lastActivity: number | null;
  idleTimeRemaining: number;
  absoluteTimeRemaining: number;
  shouldWarn: boolean;
  reason?: 'idle_timeout' | 'absolute_timeout' | 'no_session' | 'manual_logout';
};

/**
 * Generate a cryptographically secure session ID
 */
export function generateSessionId(): string {
  // Use crypto.randomUUID() for cryptographically secure random IDs
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `sess_${crypto.randomUUID()}`;
  }
  // Fallback using crypto.getRandomValues for older environments
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return `sess_${Array.from(array, b => b.toString(16).padStart(2, '0')).join('')}`;
  }
  // This should never happen in modern browsers/Node.js
  throw new Error('No cryptographically secure random number generator available');
}

/**
 * Initialize a new session (call on login)
 */
export function initializeSession(): string {
  const now = Date.now();
  const sessionId = generateSessionId();

  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_CONFIG.STORAGE_KEY_SESSION_ID, sessionId);
    localStorage.setItem(SESSION_CONFIG.STORAGE_KEY_SESSION_START, now.toString());
    localStorage.setItem(SESSION_CONFIG.STORAGE_KEY_LAST_ACTIVITY, now.toString());
  }

  return sessionId;
}

/**
 * Update last activity timestamp (call on user interaction)
 */
export function updateLastActivity(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_CONFIG.STORAGE_KEY_LAST_ACTIVITY, Date.now().toString());
  }
}

/**
 * Get current session state
 */
export function getSessionState(): SessionState {
  if (typeof window === 'undefined') {
    return {
      isValid: false,
      sessionId: null,
      startTime: null,
      lastActivity: null,
      idleTimeRemaining: 0,
      absoluteTimeRemaining: 0,
      shouldWarn: false,
      reason: 'no_session',
    };
  }

  const sessionId = localStorage.getItem(SESSION_CONFIG.STORAGE_KEY_SESSION_ID);
  const startTimeStr = localStorage.getItem(SESSION_CONFIG.STORAGE_KEY_SESSION_START);
  const lastActivityStr = localStorage.getItem(SESSION_CONFIG.STORAGE_KEY_LAST_ACTIVITY);

  // No session exists
  if (!sessionId || !startTimeStr || !lastActivityStr) {
    return {
      isValid: false,
      sessionId: null,
      startTime: null,
      lastActivity: null,
      idleTimeRemaining: 0,
      absoluteTimeRemaining: 0,
      shouldWarn: false,
      reason: 'no_session',
    };
  }

  const now = Date.now();
  const startTime = parseInt(startTimeStr, 10);
  const lastActivity = parseInt(lastActivityStr, 10);

  // Validate parsed timestamps - prevent NaN propagation and clock skew/tampering
  if (
    isNaN(startTime) ||
    isNaN(lastActivity) ||
    startTime < 0 ||
    lastActivity < 0 ||
    startTime > now ||
    lastActivity > now
  ) {
    // Clear corrupted session data
    clearSession();
    return {
      isValid: false,
      sessionId: null,
      startTime: null,
      lastActivity: null,
      idleTimeRemaining: 0,
      absoluteTimeRemaining: 0,
      shouldWarn: false,
      reason: 'no_session',
    };
  }

  // Calculate time remaining
  const timeSinceStart = now - startTime;
  const timeSinceActivity = now - lastActivity;

  const absoluteTimeRemaining = SESSION_CONFIG.ABSOLUTE_TIMEOUT_MS - timeSinceStart;
  const idleTimeRemaining = SESSION_CONFIG.IDLE_TIMEOUT_MS - timeSinceActivity;

  // Check for absolute timeout
  if (absoluteTimeRemaining <= 0) {
    return {
      isValid: false,
      sessionId,
      startTime,
      lastActivity,
      idleTimeRemaining: 0,
      absoluteTimeRemaining: 0,
      shouldWarn: false,
      reason: 'absolute_timeout',
    };
  }

  // Check for idle timeout
  if (idleTimeRemaining <= 0) {
    return {
      isValid: false,
      sessionId,
      startTime,
      lastActivity,
      idleTimeRemaining: 0,
      absoluteTimeRemaining,
      shouldWarn: false,
      reason: 'idle_timeout',
    };
  }

  // Determine minimum time remaining (could be either idle or absolute)
  const minTimeRemaining = Math.min(idleTimeRemaining, absoluteTimeRemaining);
  const shouldWarn = minTimeRemaining <= SESSION_CONFIG.WARNING_BEFORE_TIMEOUT_MS;

  return {
    isValid: true,
    sessionId,
    startTime,
    lastActivity,
    idleTimeRemaining,
    absoluteTimeRemaining,
    shouldWarn,
  };
}

/**
 * Clear session data (call on logout or timeout)
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY_SESSION_ID);
    localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY_SESSION_START);
    localStorage.removeItem(SESSION_CONFIG.STORAGE_KEY_LAST_ACTIVITY);
  }
}

/**
 * Check if session data exists in localStorage (quick presence check).
 * NOTE: This does NOT validate if the session has expired - use getSessionState() for full validation.
 */
export function hasSessionData(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(SESSION_CONFIG.STORAGE_KEY_SESSION_ID);
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0:00';

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
