/**
 * GmailOAuthPanel Component
 *
 * UI panel for configuring Gmail OAuth in Genesis Bot nodes.
 * Displays connection status, permissions toggles, and safety settings.
 */

'use client';

import React, { useState } from 'react';
import { useGmailOAuth } from '../hooks/useGmailOAuth';
import type { GmailOAuthConfig, GmailPermissions } from '../types';
import { DEFAULT_GMAIL_CONFIG } from '../types';

interface GmailOAuthPanelProps {
  config: GmailOAuthConfig;
  onConfigChange: (config: GmailOAuthConfig) => void;
  disabled?: boolean;
}

export function GmailOAuthPanel({
  config,
  onConfigChange,
  disabled = false,
}: GmailOAuthPanelProps) {
  const { connection, status, isLoading, error, connect, disconnect } = useGmailOAuth();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Use provided config or defaults
  const currentConfig: GmailOAuthConfig = {
    ...DEFAULT_GMAIL_CONFIG,
    ...config,
  };

  const handleToggleEnabled = () => {
    onConfigChange({
      ...currentConfig,
      enabled: !currentConfig.enabled,
    });
  };

  const handlePermissionChange = (permission: keyof GmailPermissions, value: boolean) => {
    onConfigChange({
      ...currentConfig,
      permissions: {
        ...currentConfig.permissions,
        [permission]: value,
      },
    });
  };

  const handleSettingChange = (
    setting: 'requireConfirmation' | 'maxEmailsPerHour',
    value: boolean | number
  ) => {
    onConfigChange({
      ...currentConfig,
      [setting]: value,
    });
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    await disconnect();
    onConfigChange({
      ...currentConfig,
      enabled: false,
      connectionId: undefined,
    });
    setIsDisconnecting(false);
  };

  const handleConnect = () => {
    connect();
  };

  // Update config with connection ID when connected
  // Also auto-enable Gmail when a connection is detected
  React.useEffect(() => {
    if (connection?.id && connection.id !== currentConfig.connectionId) {
      console.log('[GmailOAuthPanel] Connection detected, saving connectionId and enabling Gmail');
      onConfigChange({
        ...currentConfig,
        enabled: true,  // Auto-enable when connected
        connectionId: connection.id,
      });
    }
  }, [connection?.id]);

  return (
    <div className="space-y-4">
      {/* Header with Enable Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-red-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
          </svg>
          <span className="text-sm font-medium text-slate-200">Gmail</span>
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
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              currentConfig.enabled ? 'translate-x-4.5' : 'translate-x-1'
            }`}
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
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-full px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect Gmail'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  Connect your Gmail account to enable email capabilities.
                </p>
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <button
                  onClick={handleConnect}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                  </svg>
                  Connect Gmail Account
                </button>
              </div>
            )}
          </div>

          {/* Permissions - Only show when connected */}
          {status === 'connected' && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Permissions
                </label>
                <div className="space-y-2 bg-slate-800/30 rounded-lg p-3">
                  <PermissionToggle
                    label="Read Emails"
                    description="Allow bot to read email content"
                    checked={currentConfig.permissions.canRead}
                    onChange={(v) => handlePermissionChange('canRead', v)}
                    disabled={disabled}
                  />
                  <PermissionToggle
                    label="Search Emails"
                    description="Allow bot to search through emails"
                    checked={currentConfig.permissions.canSearch}
                    onChange={(v) => handlePermissionChange('canSearch', v)}
                    disabled={disabled}
                  />
                  <PermissionToggle
                    label="Send Emails"
                    description="Allow bot to send emails on your behalf"
                    checked={currentConfig.permissions.canSend}
                    onChange={(v) => handlePermissionChange('canSend', v)}
                    disabled={disabled}
                    dangerous
                  />
                  <PermissionToggle
                    label="Manage Drafts"
                    description="Allow bot to create and edit drafts"
                    checked={currentConfig.permissions.canManageDrafts}
                    onChange={(v) => handlePermissionChange('canManageDrafts', v)}
                    disabled={disabled}
                  />
                  <PermissionToggle
                    label="Manage Labels"
                    description="Allow bot to add/remove labels"
                    checked={currentConfig.permissions.canManageLabels}
                    onChange={(v) => handlePermissionChange('canManageLabels', v)}
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Safety Settings - Only show if Send is enabled */}
              {currentConfig.permissions.canSend && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Safety Settings
                  </label>
                  <div className="space-y-3 bg-amber-900/20 border border-amber-700/50 rounded-lg p-3">
                    <PermissionToggle
                      label="Require Confirmation"
                      description="Ask for confirmation before sending emails"
                      checked={currentConfig.requireConfirmation ?? true}
                      onChange={(v) => handleSettingChange('requireConfirmation', v)}
                      disabled={disabled}
                    />
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">
                        Max Emails Per Hour
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={currentConfig.maxEmailsPerHour ?? 10}
                        onChange={(e) =>
                          handleSettingChange('maxEmailsPerHour', parseInt(e.target.value) || 10)
                        }
                        disabled={disabled}
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
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
