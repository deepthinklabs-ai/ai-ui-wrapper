/**
 * Sentry Server Configuration
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Performance Monitoring
  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Filter out known non-critical errors
  beforeSend(event, hint) {
    const error = hint.originalException;

    // Ignore rate limit errors (expected behavior)
    if (error instanceof Error && error.message.includes("Rate limit")) {
      return null;
    }

    // Ignore authentication errors (user error, not system error)
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return null;
    }

    return event;
  },

  // Don't send PII
  sendDefaultPii: false,

  // Environment tag
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
});
