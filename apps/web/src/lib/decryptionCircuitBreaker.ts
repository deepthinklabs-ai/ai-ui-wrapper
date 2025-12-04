/**
 * Decryption Circuit Breaker
 *
 * Tracks decryption failures and prevents cascading failures
 * by stopping decryption attempts after too many failures.
 *
 * This helps prevent:
 * - Infinite retry loops
 * - Performance degradation from repeated failed attempts
 * - User confusion from partial decryption results
 */

import { EncryptionError } from './encryptionErrors';

interface CircuitBreakerConfig {
  /** Number of failures before circuit opens */
  failureThreshold: number;
  /** Time window in ms to track failures */
  windowMs: number;
  /** Time in ms before circuit resets after opening */
  resetTimeMs: number;
}

interface CircuitBreakerState {
  failures: number;
  windowStart: number;
  isOpen: boolean;
  openedAt: number | null;
  lastError: EncryptionError | null;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  windowMs: 60000, // 1 minute
  resetTimeMs: 30000, // 30 seconds
};

/**
 * Circuit breaker for decryption operations
 */
class DecryptionCircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    windowStart: Date.now(),
    isOpen: false,
    openedAt: null,
    lastError: null,
  };

  private config: CircuitBreakerConfig;
  private listeners: Set<(state: CircuitBreakerState) => void> = new Set();

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a decryption failure
   */
  recordFailure(error: EncryptionError): void {
    const now = Date.now();

    // Reset window if expired
    if (now - this.state.windowStart > this.config.windowMs) {
      this.state.failures = 0;
      this.state.windowStart = now;
    }

    this.state.failures++;
    this.state.lastError = error;

    // Open circuit if threshold reached
    if (this.state.failures >= this.config.failureThreshold) {
      this.openCircuit();
    }

    this.notifyListeners();
  }

  /**
   * Record a successful decryption (resets failure count)
   */
  recordSuccess(): void {
    if (this.state.failures > 0 || this.state.isOpen) {
      this.state.failures = 0;
      this.state.isOpen = false;
      this.state.openedAt = null;
      this.state.lastError = null;
      this.notifyListeners();
    }
  }

  /**
   * Check if decryption should be attempted
   */
  canAttemptDecryption(): boolean {
    if (!this.state.isOpen) {
      return true;
    }

    // Check if reset time has passed
    const now = Date.now();
    if (this.state.openedAt && now - this.state.openedAt > this.config.resetTimeMs) {
      // Allow a single attempt (half-open state)
      return true;
    }

    return false;
  }

  /**
   * Check if circuit is currently open
   */
  isCircuitOpen(): boolean {
    // Check if we should auto-reset
    if (this.state.isOpen && this.state.openedAt) {
      const now = Date.now();
      if (now - this.state.openedAt > this.config.resetTimeMs) {
        // Auto-reset to half-open state
        return false;
      }
    }
    return this.state.isOpen;
  }

  /**
   * Get the last error that caused circuit to open
   */
  getLastError(): EncryptionError | null {
    return this.state.lastError;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.state.failures;
  }

  /**
   * Get time until circuit resets (or 0 if not open)
   */
  getResetTimeRemaining(): number {
    if (!this.state.isOpen || !this.state.openedAt) {
      return 0;
    }
    const elapsed = Date.now() - this.state.openedAt;
    return Math.max(0, this.config.resetTimeMs - elapsed);
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = {
      failures: 0,
      windowStart: Date.now(),
      isOpen: false,
      openedAt: null,
      lastError: null,
    };
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: CircuitBreakerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current state snapshot
   */
  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }

  private openCircuit(): void {
    this.state.isOpen = true;
    this.state.openedAt = Date.now();
    console.warn('[CircuitBreaker] Circuit opened after', this.state.failures, 'failures');
  }

  private notifyListeners(): void {
    const snapshot = this.getState();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

// Singleton instances for different contexts
const circuitBreakers: Map<string, DecryptionCircuitBreaker> = new Map();

/**
 * Get or create a circuit breaker for a specific context
 */
export function getCircuitBreaker(
  context: string = 'default',
  config?: Partial<CircuitBreakerConfig>
): DecryptionCircuitBreaker {
  if (!circuitBreakers.has(context)) {
    circuitBreakers.set(context, new DecryptionCircuitBreaker(config));
  }
  return circuitBreakers.get(context)!;
}

/**
 * Reset all circuit breakers (useful for testing or on user action)
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach(cb => cb.reset());
}

/**
 * Execute a decryption operation with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  context: string,
  operation: () => Promise<T>,
  onCircuitOpen?: (error: EncryptionError) => T
): Promise<T> {
  const breaker = getCircuitBreaker(context);

  if (!breaker.canAttemptDecryption()) {
    const lastError = breaker.getLastError();
    if (onCircuitOpen && lastError) {
      return onCircuitOpen(lastError);
    }
    throw new EncryptionError(
      'RATE_LIMITED',
      `Decryption temporarily disabled after ${breaker.getFailureCount()} failures. ` +
      `Retry in ${Math.ceil(breaker.getResetTimeRemaining() / 1000)} seconds.`
    );
  }

  try {
    const result = await operation();
    breaker.recordSuccess();
    return result;
  } catch (err) {
    const error = err instanceof EncryptionError
      ? err
      : new EncryptionError('UNKNOWN', err instanceof Error ? err.message : 'Unknown error');

    // Only count certain errors toward the circuit breaker
    // Don't count "locked" errors since those are expected when user hasn't unlocked
    if (error.code !== 'LOCKED' && error.code !== 'NOT_SETUP') {
      breaker.recordFailure(error);
    }

    throw error;
  }
}

export { DecryptionCircuitBreaker };
export type { CircuitBreakerConfig, CircuitBreakerState };
