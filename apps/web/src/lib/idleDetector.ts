/**
 * Idle Detector - Tracks user activity to detect idle state
 *
 * Monitors user interactions (mouse, keyboard, touch, scroll)
 * and triggers callbacks when user becomes idle or returns.
 */

export type IdleDetectorConfig = {
  // Callback when activity is detected
  onActivity?: () => void;
  // Events to listen for
  events?: string[];
  // Throttle activity updates (ms)
  throttleMs?: number;
};

const DEFAULT_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'keypress',
  'scroll',
  'touchstart',
  'touchmove',
  'wheel',
  'resize',
  'focus',
  'visibilitychange',
];

const DEFAULT_THROTTLE_MS = 5000; // Only update activity every 5 seconds max

export class IdleDetector {
  private config: Required<IdleDetectorConfig>;
  private lastActivityUpdate: number = 0;
  private isRunning: boolean = false;
  private boundHandleActivity: (e: Event) => void;

  constructor(config: IdleDetectorConfig = {}) {
    this.config = {
      onActivity: config.onActivity || (() => {}),
      events: config.events || DEFAULT_EVENTS,
      throttleMs: config.throttleMs ?? DEFAULT_THROTTLE_MS,
    };

    this.boundHandleActivity = this.handleActivity.bind(this);
  }

  /**
   * Start listening for user activity
   */
  start(): void {
    if (this.isRunning || typeof window === 'undefined') return;

    this.isRunning = true;
    this.lastActivityUpdate = Date.now();

    // Add event listeners
    this.config.events.forEach((event) => {
      if (event === 'visibilitychange') {
        document.addEventListener(event, this.boundHandleActivity, { passive: true });
      } else {
        window.addEventListener(event, this.boundHandleActivity, { passive: true });
      }
    });
  }

  /**
   * Stop listening for user activity
   */
  stop(): void {
    if (!this.isRunning || typeof window === 'undefined') return;

    this.isRunning = false;

    // Remove event listeners
    this.config.events.forEach((event) => {
      if (event === 'visibilitychange') {
        document.removeEventListener(event, this.boundHandleActivity);
      } else {
        window.removeEventListener(event, this.boundHandleActivity);
      }
    });
  }

  /**
   * Handle activity event
   */
  private handleActivity(event: Event): void {
    // Special handling for visibility change
    if (event.type === 'visibilitychange') {
      // Only count as activity when tab becomes visible
      if (document.visibilityState !== 'visible') {
        return;
      }
    }

    const now = Date.now();

    // Throttle updates to avoid excessive calls
    if (now - this.lastActivityUpdate < this.config.throttleMs) {
      return;
    }

    this.lastActivityUpdate = now;
    this.config.onActivity();
  }

  /**
   * Manually trigger activity (e.g., after API call)
   */
  triggerActivity(): void {
    this.lastActivityUpdate = Date.now();
    this.config.onActivity();
  }

  /**
   * Check if detector is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Create and start an idle detector instance
 */
export function createIdleDetector(config: IdleDetectorConfig): IdleDetector {
  const detector = new IdleDetector(config);
  detector.start();
  return detector;
}
