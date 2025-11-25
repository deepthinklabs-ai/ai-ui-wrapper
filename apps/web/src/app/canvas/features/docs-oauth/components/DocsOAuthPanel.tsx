/**
 * Google Docs OAuth Panel Component
 *
 * UI panel for configuring Docs OAuth in Genesis Bot nodes.
 * Displays connection status, permissions toggles, and available tools.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGmailOAuth } from '../../gmail-oauth/hooks/useGmailOAuth'; // Reuse Gmail OAuth - same Google connection
import type { DocsOAuthConfig, DocsPermissions } from '../types';
import { DEFAULT_DOCS_CONFIG } from '../types';

interface DocsOAuthPanelProps {
  config: DocsOAuthConfig;
  onConfigChange: (config: DocsOAuthConfig) => void;
  disabled?: boolean;
}

export function DocsOAuthPanel({
  config,
  onConfigChange,
  disabled = false,
}: DocsOAuthPanelProps) {
  // Reuse Gmail OAuth hook - Docs uses the same Google OAuth connection
  const { connection, status, isLoading, error, connect, disconnect } = useGmailOAuth();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Use provided config or defaults
  const currentConfig: DocsOAuthConfig = {
    ...DEFAULT_DOCS_CONFIG,
    ...config,
  };

  const handleToggleEnabled = () => {
    onConfigChange({
      ...currentConfig,
      enabled: !currentConfig.enabled,
    });
  };

  const handlePermissionChange = (permission: keyof DocsPermissions, value: boolean) => {
    onConfigChange({
      ...currentConfig,
      permissions: {
        ...currentConfig.permissions,
        [permission]: value,
      },
    });
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    await disconnect();
    onConfigChange({
      ...currentConfig,
      enabled: false,
      connectionId: null,
    });
    setIsDisconnecting(false);
  };

  const handleConnect = () => {
    connect();
  };

  // Update config with connection ID when connected
  // Since Gmail, Sheets, and Docs share the same Google OAuth, use the connection ID from Gmail
  useEffect(() => {
    if (connection?.id && currentConfig.enabled && connection.id !== currentConfig.connectionId) {
      // Use functional update pattern to avoid stale closure issues
      const updatedConfig = {
        ...currentConfig,
        connectionId: connection.id,
      };
      onConfigChange(updatedConfig);
    }
  }, [connection?.id, currentConfig.enabled, currentConfig.connectionId, onConfigChange]);

  return (
    <div className="space-y-4">
      {/* Header with Enable Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
          </svg>
          <span className="text-sm font-medium text-slate-200">Google Docs</span>
        </div>
        <button
          type="button"
          onClick={handleToggleEnabled}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            currentConfig.enabled ? 'bg-blue-600' : 'bg-slate-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
            style={{ transform: currentConfig.enabled ? 'translateX(18px)' : 'translateX(4px)' }}
          />
        </button>
      </div>

      {currentConfig.enabled && (
        <>
          {/* Connection Status */}
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
            {isLoading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <div className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full" />
                <span className="text-sm">Checking connection...</span>
              </div>
            ) : status === 'connected' && connection ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {connection.picture && (
                    <img
                      src={connection.picture}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {connection.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{connection.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-xs text-green-400">Connected</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Using Google OAuth connection (shared with Gmail/Sheets)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  Connect your Google account to enable Docs capabilities.
                </p>
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <button
                  onClick={handleConnect}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                  </svg>
                  Connect Google Account
                </button>
              </div>
            )}
          </div>

          {/* Permissions - Only show when connected */}
          {status === 'connected' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Permissions
              </label>
              <div className="space-y-2 bg-slate-800/30 rounded-lg p-3">
                <PermissionToggle
                  label="Read Documents"
                  description="Allow bot to read document content"
                  checked={currentConfig.permissions.canRead}
                  onChange={(v) => handlePermissionChange('canRead', v)}
                  disabled={disabled}
                />
                <PermissionToggle
                  label="Write Documents"
                  description="Allow bot to insert, append, and modify text"
                  checked={currentConfig.permissions.canWrite}
                  onChange={(v) => handlePermissionChange('canWrite', v)}
                  disabled={disabled}
                  dangerous
                />
                <PermissionToggle
                  label="Create Documents"
                  description="Allow bot to create new documents"
                  checked={currentConfig.permissions.canCreate}
                  onChange={(v) => handlePermissionChange('canCreate', v)}
                  disabled={disabled}
                  dangerous
                />
                <PermissionToggle
                  label="Comments"
                  description="Allow bot to add and list comments"
                  checked={currentConfig.permissions.canComment}
                  onChange={(v) => handlePermissionChange('canComment', v)}
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          {/* Available Tools Info */}
          {status === 'connected' && (
            <div className="bg-slate-800/30 rounded-lg p-3">
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Available Tools
              </label>
              <div className="flex flex-wrap gap-1.5">
                {currentConfig.permissions.canRead && (
                  <>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">docs_read</span>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">docs_get_text</span>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">docs_get_metadata</span>
                  </>
                )}
                {currentConfig.permissions.canWrite && (
                  <>
                    <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">docs_insert_text</span>
                    <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">docs_append_text</span>
                    <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">docs_replace_text</span>
                    <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">docs_delete_content</span>
                  </>
                )}
                {currentConfig.permissions.canCreate && (
                  <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">docs_create</span>
                )}
                {currentConfig.permissions.canComment && (
                  <>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">docs_add_comment</span>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">docs_list_comments</span>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Permission Toggle Sub-component
interface PermissionToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  dangerous?: boolean;
}

function PermissionToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  dangerous,
}: PermissionToggleProps) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative mt-0.5 inline-flex h-4 w-7 items-center rounded-full transition-colors ${
          checked
            ? dangerous
              ? 'bg-amber-600'
              : 'bg-blue-600'
            : 'bg-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className="inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(14px)' : 'translateX(3px)' }}
        />
      </button>
      <div className="flex-1">
        <span
          className={`text-sm ${
            dangerous && checked ? 'text-amber-300' : 'text-slate-200'
          }`}
        >
          {label}
        </span>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}
