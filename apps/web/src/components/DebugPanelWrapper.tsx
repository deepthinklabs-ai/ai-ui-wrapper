'use client';

import { DebugPanel } from 'vercel-debugpack/browser';

/**
 * DebugPanelWrapper - Shows debug panel on staging/preview environments
 *
 * Activation: Keyboard shortcut Ctrl+Shift+L (or Cmd+Shift+L on Mac)
 *
 * Only renders on Vercel preview deployments.
 */
export default function DebugPanelWrapper() {
  return (
    <DebugPanel
      config={{
        isEnabled: () => {
          if (typeof window === 'undefined') return false;
          const hostname = window.location.hostname;
          // Enable on Vercel preview deployments (contains 'vercel.app' but not production)
          const isVercelPreview = hostname.includes('vercel.app') && !hostname.startsWith('www.');
          // Enable on localhost for local testing
          const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
          return isVercelPreview || isLocalhost;
        },
      }}
    />
  );
}
