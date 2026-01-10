/**
 * SlackOAuthCard Component
 *
 * Displays Slack OAuth connection status and allows connect/disconnect.
 * Shows workspace information when connected.
 */

'use client';

import React from 'react';
import { useSlackOAuth } from '@/app/canvas/features/slack-oauth/hooks/useSlackOAuth';
import type { OAuthCardProps } from './types';

export function SlackOAuthCard({ onConnectionChange }: OAuthCardProps) {
  const {
    connection,
    status,
    isLoading,
    error,
    connect,
    disconnect,
  } = useSlackOAuth();

  const isConnected = status === 'connected';

  const handleConnect = () => {
    connect();
    onConnectionChange?.();
  };

  const handleDisconnect = async () => {
    await disconnect();
    onConnectionChange?.();
  };

  return (
    <div className="p-4 border border-white/40 rounded-lg bg-white/40">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Slack Icon */}
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#E01E5A"
                d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
              />
              <path
                fill="#36C5F0"
                d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
              />
              <path
                fill="#2EB67D"
                d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
              />
              <path
                fill="#ECB22E"
                d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-foreground">Slack Workspace</h3>
            {isConnected && connection && (
              <p className="text-sm text-foreground/60">{connection.workspaceName}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-xs text-foreground/50">Loading...</span>
          ) : isConnected ? (
            <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
              Connected
            </span>
          ) : (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
              Not connected
            </span>
          )}
        </div>
      </div>

      {/* Connected State */}
      {isConnected && connection && (
        <>
          {/* Workspace Info */}
          <div className="mb-4">
            <p className="text-xs text-foreground/60 mb-2">Capabilities:</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded-full flex items-center gap-1">
                <span>💬</span>
                Send Messages
              </span>
              <span className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded-full flex items-center gap-1">
                <span>📢</span>
                Post to Channels
              </span>
            </div>
          </div>

          {/* Connection Info */}
          {connection.connectedAt && (
            <div className="text-xs text-foreground/50 mb-4">
              Connected {new Date(connection.connectedAt).toLocaleDateString()}
            </div>
          )}

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="w-full py-2 px-4 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Disconnect Slack Workspace
          </button>
        </>
      )}

      {/* Disconnected State */}
      {!isConnected && !isLoading && (
        <>
          <p className="text-sm text-foreground/60 mb-4">
            Connect your Slack workspace to send messages and notifications
            from your Canvas workflows.
          </p>
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full py-2 px-4 text-sm text-white bg-[#4A154B] rounded-lg hover:bg-[#3e1240] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" />
            </svg>
            Connect Slack Workspace
          </button>
        </>
      )}

      {/* Error State */}
      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

export default SlackOAuthCard;
