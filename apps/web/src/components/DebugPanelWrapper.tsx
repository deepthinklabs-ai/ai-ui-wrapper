'use client';

import { useEffect, useState, useCallback } from 'react';
import { DebugPanel, initDebugCapture, getDebugCapture } from 'vercel-debugpack/browser';

const DEBUG_STORAGE_KEY = 'vercel-debugpack-enabled';

/**
 * DebugPanelWrapper - Shows debug panel on staging/preview environments
 *
 * Toggle debug mode with Ctrl+Shift+L (L for Logs) on staging.
 * This avoids the auth issues caused by adding ?debug=1 to the URL.
 *
 * Debug mode persists in sessionStorage until the tab is closed.
 * No page reload required - capture initializes dynamically.
 */
export default function DebugPanelWrapper() {
  const [debugEnabled, setDebugEnabled] = useState<boolean | null>(null);
  const [captureReady, setCaptureReady] = useState(false);

  // Check if we're on a staging/preview environment
  const isStaging = typeof window !== 'undefined' && (
    (window as any).__NEXT_DATA__?.env?.VERCEL_ENV === 'preview' ||
    window.location.hostname.includes('staging') ||
    window.location.hostname.includes('-git-staging-') ||
    (window.location.hostname.includes('vercel.app') && !window.location.hostname.includes('aiuiw.com'))
  );

  // Initialize debug capture when enabled
  const initializeCapture = useCallback(() => {
    // Initialize capture with custom isEnabled that always returns true
    const api = initDebugCapture({ isEnabled: () => true }) || getDebugCapture();
    if (api) {
      setCaptureReady(true);
      console.log('[DebugPanel] Debug capture initialized - session:', api.getSessionId());
    }
  }, []);

  // Initialize from sessionStorage or URL param
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check URL param first (original behavior)
    const urlParams = new URLSearchParams(window.location.search);
    const hasDebugParam = urlParams.get('debug') === '1';

    // Check sessionStorage for toggle state
    const storedValue = sessionStorage.getItem(DEBUG_STORAGE_KEY);

    // Enable if URL param OR stored toggle
    const shouldEnable = hasDebugParam || storedValue === 'true';
    setDebugEnabled(shouldEnable);

    // If enabled, initialize capture immediately
    if (shouldEnable) {
      initializeCapture();
    }

    // If enabled via URL, also store in sessionStorage so it persists
    if (hasDebugParam && storedValue !== 'true') {
      sessionStorage.setItem(DEBUG_STORAGE_KEY, 'true');
    }
  }, [initializeCapture]);

  // Keyboard shortcut: Ctrl+Shift+L to toggle debug mode on staging
  useEffect(() => {
    if (!isStaging) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+L (L for Logs)
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setDebugEnabled(prev => {
          const newValue = !prev;
          if (newValue) {
            sessionStorage.setItem(DEBUG_STORAGE_KEY, 'true');
            // Initialize capture immediately without reload
            initializeCapture();
            console.log('[DebugPanel] Debug mode ENABLED - capturing logs');
          } else {
            sessionStorage.removeItem(DEBUG_STORAGE_KEY);
            setCaptureReady(false);
            console.log('[DebugPanel] Debug mode DISABLED - reload page to fully stop capture');
          }
          return newValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStaging, initializeCapture]);

  // Don't render until we've checked storage
  if (debugEnabled === null) return null;

  // Only render if debug is enabled
  if (!debugEnabled) return null;

  return (
    <DebugPanel
      config={{
        isEnabled: () => true, // Already initialized above
      }}
    />
  );
}
