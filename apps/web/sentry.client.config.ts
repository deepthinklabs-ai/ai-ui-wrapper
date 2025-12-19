/**
 * Sentry Client Configuration
 *
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Performance Monitoring
  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Session Replay
  // Capture 1% of sessions for replay, 100% on error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text content for privacy
      maskAllText: true,
      // Block all media for privacy
      blockAllMedia: true,
    }),
  ],

  // Filter out known non-critical errors
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Ignore ResizeObserver errors (browser quirk, not actionable)
    if (error instanceof Error && error.message.includes("ResizeObserver")) {
      return null;
    }

    // Ignore network errors that are likely user connectivity issues
    if (error instanceof Error && error.message.includes("Failed to fetch")) {
      return null;
    }

    // Ignore cancelled requests
    if (error instanceof Error && error.name === "AbortError") {
      return null;
    }

    return event;
  },

  // Don't send PII
  sendDefaultPii: false,

  // Environment tag
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
});
