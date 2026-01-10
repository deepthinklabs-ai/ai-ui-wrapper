/**
 * OAuthConnectionsSettings Component
 *
 * Main container for OAuth connection management in Settings.
 * Displays all available OAuth providers and their connection status.
 */

'use client';

import React from 'react';
import { GoogleOAuthCard } from './GoogleOAuthCard';
import { SlackOAuthCard } from './SlackOAuthCard';

export function OAuthConnectionsSettings() {
  return (
    <section className="rounded-xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <span>🔗</span>
          Connected Services
        </h2>
        <p className="text-sm text-foreground/60 mt-1">
          Connect external services to use in your Canvas workflows.
          These connections are shared across all your nodes.
        </p>
      </div>

      {/* OAuth Cards */}
      <div className="space-y-4">
        {/* Google OAuth */}
        <GoogleOAuthCard />

        {/* Slack OAuth */}
        <SlackOAuthCard />
      </div>

      {/* Info Note */}
      <div className="mt-6 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> When you connect a service here, it becomes available
          in all Canvas nodes. You can configure which permissions each node uses
          in the node settings.
        </p>
      </div>
    </section>
  );
}

export default OAuthConnectionsSettings;
