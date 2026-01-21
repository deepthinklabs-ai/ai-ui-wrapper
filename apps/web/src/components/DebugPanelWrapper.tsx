'use client';

import { DebugPanel } from 'vercel-debugpack/browser';

/**
 * DebugPanelWrapper - Shows debug panel on staging/preview environments
 *
 * Activation methods (built into vercel-debugpack):
 * - URL parameter: ?debug=1
 * - Keyboard shortcut: Ctrl+Shift+L (or Cmd+Shift+L on Mac)
 *
 * Only renders on Vercel preview deployments.
 */
export default function DebugPanelWrapper() {
  return <DebugPanel />;
}
