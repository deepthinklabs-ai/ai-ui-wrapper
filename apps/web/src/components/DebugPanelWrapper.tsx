'use client';

import { DebugPanel } from 'vercel-debugpack/browser';

/**
 * DebugPanelWrapper - Shows debug panel on staging/preview environments
 *
 * Just renders the panel - it handles its own visibility internally.
 * Press Ctrl+Shift+; (semicolon) to toggle the debug panel.
 */
export default function DebugPanelWrapper() {
  return (
    <DebugPanel
      config={{
        serverUrl: 'https://amara-nonaristocratical-unadulteratedly.ngrok-free.dev'
      }}
    />
  );
}
