/**
 * GoogleOAuthCard Component
 *
 * Displays Google OAuth connection status and allows connect/disconnect.
 * Shows which Google services are available (Gmail, Calendar, etc.).
 */

'use client';

import React from 'react';
import { useGoogleOAuth } from '@/hooks/useGoogleOAuth';
import type { OAuthCardProps } from './types';

/**
 * Google service scope mappings
 */
const GOOGLE_SERVICES = [
  { id: 'gmail', name: 'Gmail', scope: 'gmail', icon: '📧' },
  { id: 'calendar', name: 'Calendar', scope: 'calendar', icon: '📅' },
  { id: 'sheets', name: 'Sheets', scope: 'spreadsheets', icon: '📊' },
  { id: 'docs', name: 'Docs', scope: 'documents', icon: '📄' },
  { id: 'drive', name: 'Drive', scope: 'drive', icon: '💾' },
] as const;

/**
 * Check if a scope is granted
 */
function hasScope(scopes: string[], serviceScope: string): boolean {
  return scopes.some(s => s.toLowerCase().includes(serviceScope.toLowerCase()));
}

export function GoogleOAuthCard({ onConnectionChange }: OAuthCardProps) {
  const {
    status,
    connection,
    isConnected,
    isLoading,
    connect,
    disconnect,
    error,
  } = useGoogleOAuth();

  const handleConnect = async () => {
    await connect();
    onConnectionChange?.();
  };

  const handleDisconnect = async () => {
    await disconnect();
    onConnectionChange?.();
  };

  // Determine which services are available based on scopes
  const availableServices = connection?.scopes
    ? GOOGLE_SERVICES.filter(service => hasScope(connection.scopes, service.scope))
    : [];

  return (
    <div className="p-4 border border-white/40 rounded-lg bg-white/40">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Google Icon */}
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-foreground">Google Account</h3>
            {isConnected && connection && (
              <p className="text-sm text-foreground/60">{connection.provider_email}</p>
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
          {/* Available Services */}
          <div className="mb-4">
            <p className="text-xs text-foreground/60 mb-2">Available services:</p>
            <div className="flex flex-wrap gap-2">
              {availableServices.length > 0 ? (
                availableServices.map(service => (
                  <span
                    key={service.id}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full flex items-center gap-1"
                  >
                    <span>{service.icon}</span>
                    {service.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-foreground/50">No services detected</span>
              )}
            </div>
          </div>

          {/* Connection Info */}
          <div className="text-xs text-foreground/50 mb-4">
            Connected {new Date(connection.created_at).toLocaleDateString()}
            {connection.last_used_at && (
              <> · Last used {new Date(connection.last_used_at).toLocaleDateString()}</>
            )}
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="w-full py-2 px-4 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Disconnect Google Account
          </button>
        </>
      )}

      {/* Disconnected State */}
      {!isConnected && !isLoading && (
        <>
          <p className="text-sm text-foreground/60 mb-4">
            Connect your Google account to enable Gmail, Calendar, Sheets, and Docs integrations
            in your Canvas workflows.
          </p>
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full py-2 px-4 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
            </svg>
            Connect Google Account
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

export default GoogleOAuthCard;
