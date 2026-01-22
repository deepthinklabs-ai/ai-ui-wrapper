import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Next.js Configuration
 *
 * Environment-aware configuration for development, staging, and production.
 * Vercel automatically sets VERCEL_ENV to 'production', 'preview', or 'development'
 */

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = !!process.env.VERCEL;
const isPreview = process.env.VERCEL_ENV === 'preview';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Skip TypeScript checking during build due to Next.js 16 bug
  // where generated validator types reference deleted API routes
  // See: https://github.com/vercel/next.js/issues - generated .next/dev/types/validator.ts
  typescript: {
    ignoreBuildErrors: true,
  },

  // Enable source maps in production for debugging
  productionBrowserSourceMaps: true,

  // Logging configuration for debugging
  logging: {
    fetches: {
      fullUrl: !isProduction, // Log full URLs in development only
    },
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            // HSTS - Force HTTPS for 2 years
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            // Prevent clickjacking
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            // Prevent MIME type sniffing
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            // XSS protection (legacy browsers)
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            // Control referrer information
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            // Disable unnecessary browser features
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            // Content Security Policy
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live", // Next.js requires unsafe-eval, vercel.live for preview comments
              "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.openai.com https://api.x.ai https://api.stripe.com https://*.vercel-insights.com https://*.vercel-analytics.com https://secretmanager.googleapis.com https://generativelanguage.googleapis.com https://*.sentry.io https://*.ingest.sentry.io${isPreview ? ' http://localhost:3847' : ''}`,
              "media-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          }
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppress source map uploading logs during build
  silent: true,

  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Upload source maps to Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in production
  disable: !isProduction,

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
