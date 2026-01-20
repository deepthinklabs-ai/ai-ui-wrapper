'use client';

import { DebugPanel } from 'vercel-debugpack/browser';

/**
 * DebugPanelWrapper - Shows debug panel on staging/preview environments
 *
 * Modified to enable automatically on staging without requiring ?debug=1
 * This avoids the issue where adding ?debug=1 to the URL causes auth problems.
 */
export default function DebugPanelWrapper() {
  return (
    <DebugPanel
      config={{
        // Enable on staging/preview without requiring ?debug=1 in URL
        isEnabled: () => {
          if (typeof window === 'undefined') return false;

          // Check if we're on Vercel preview/staging
          const vercelEnv = (window as any).__NEXT_DATA__?.env?.VERCEL_ENV;
          const isPreview = vercelEnv === 'preview';

          // Also check hostname for staging deployments
          const hostname = window.location.hostname;
          const isStaging = hostname.includes('staging') ||
                           hostname.includes('-git-staging-') ||
                           hostname.includes('vercel.app');

          // Enable if either: on preview/staging OR has ?debug=1
          const urlParams = new URLSearchParams(window.location.search);
          const hasDebugParam = urlParams.get('debug') === '1';

          return isPreview || isStaging || hasDebugParam;
        },
      }}
    />
  );
}
