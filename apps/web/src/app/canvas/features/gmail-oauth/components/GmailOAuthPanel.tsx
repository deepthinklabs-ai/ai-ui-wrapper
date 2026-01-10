/**
 * GmailOAuthPanel Component
 *
 * UI panel for configuring Gmail permissions in Canvas nodes.
 * Connection is managed in Settings - this only shows status and permission toggles.
 */

'use client';

import React from 'react';
import { useGmailOAuth } from '../hooks/useGmailOAuth';
import type { GmailOAuthConfig, GmailPermissions } from '../types';
import { DEFAULT_GMAIL_CONFIG } from '../types';
import { SafeImage } from '@/lib/sanitizeUrl';

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
  const { connection, status, isLoading } = useGmailOAuth();

  // Use provided config or defaults - deep merge permissions
  const currentConfig: GmailOAuthConfig = {
    ...DEFAULT_GMAIL_CONFIG,
    ...config,
    permissions: {
      ...DEFAULT_GMAIL_CONFIG.permissions,
      ...config.permissions,
    },
  };

  const handleToggleEnabled = () => {
    // Only allow enabling if connected
    if (!connection && !currentConfig.enabled) return;
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

  // Update config with connection ID when connected
  React.useEffect(() => {
    if (connection?.id && connection.id !== currentConfig.connectionId) {
      onConfigChange({
        ...currentConfig,
        connectionId: connection.id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id, currentConfig.connectionId]);

  const isConnected = status === 'connected' && connection;

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
          <span className="text-sm font-medium text-foreground/80">Gmail</span>
        </div>
        <button
          type="button"
          onClick={handleToggleEnabled}
          disabled={disabled || !isConnected}
          title={!isConnected ? 'Connect Gmail in Settings first' : ''}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            currentConfig.enabled ? 'bg-sky' : 'bg-foreground/30'
          } ${disabled || !isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
            style={{ transform: currentConfig.enabled ? 'translateX(18px)' : 'translateX(4px)' }}
          />
        </button>
      </div>

      {/* Connection Status */}
      <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-white/30">
        {isLoading ? (
          <div className="flex items-center gap-2 text-foreground/60">
            <div className="animate-spin h-4 w-4 border-2 border-foreground/40 border-t-transparent rounded-full" />
            <span className="text-sm">Checking connection...</span>
          </div>
        ) : isConnected ? (
          <div className="flex items-center gap-3">
            <SafeImage
              src={connection.picture}
              alt=""
              className="w-8 h-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {connection.name}
              </p>
              <p className="text-xs text-foreground/60 truncate">{connection.email}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-green-600">Connected</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-foreground/60 mb-2">
              Gmail not connected
            </p>
            <a
              href="/settings"
              className="text-xs text-sky hover:text-sky/80 underline"
            >
              Go to Settings to connect Gmail
            </a>
          </div>
        )}
      </div>

      {/* Permissions - Only show when connected and enabled */}
      {isConnected && currentConfig.enabled && (
        <>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-foreground/80">
              Permissions
            </label>
            <div className="space-y-2 bg-foreground/5 rounded-lg p-3">
              <PermissionToggle
                label="Read Emails"
                description="Allow reading email content"
                checked={currentConfig.permissions.canRead}
                onChange={(v) => handlePermissionChange('canRead', v)}
                disabled={disabled}
              />
              <PermissionToggle
                label="Search Emails"
                description="Allow searching through emails"
                checked={currentConfig.permissions.canSearch}
                onChange={(v) => handlePermissionChange('canSearch', v)}
                disabled={disabled}
              />
              <PermissionToggle
                label="Send Emails"
                description="Allow sending emails"
                checked={currentConfig.permissions.canSend}
                onChange={(v) => handlePermissionChange('canSend', v)}
                disabled={disabled}
                dangerous
              />
              <PermissionToggle
                label="Manage Drafts"
                description="Allow creating and editing drafts"
                checked={currentConfig.permissions.canManageDrafts}
                onChange={(v) => handlePermissionChange('canManageDrafts', v)}
                disabled={disabled}
              />
              <PermissionToggle
                label="Manage Labels"
                description="Allow adding/removing labels"
                checked={currentConfig.permissions.canManageLabels}
                onChange={(v) => handlePermissionChange('canManageLabels', v)}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Safety Settings - Only show if Send is enabled */}
          {currentConfig.permissions.canSend && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground/80">
                Safety Settings
              </label>
              <div className="space-y-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <PermissionToggle
                  label="Require Confirmation"
                  description="Ask for confirmation before sending emails"
                  checked={currentConfig.requireConfirmation ?? true}
                  onChange={(v) => handleSettingChange('requireConfirmation', v)}
                  disabled={disabled}
                />
                <div>
                  <label className="block text-xs text-foreground/80 mb-1">
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
                    className="w-full px-2 py-1 bg-white/60 border border-white/40 rounded text-sm text-foreground focus:outline-none focus:border-sky"
                  />
                </div>
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
              ? 'bg-amber-500'
              : 'bg-sky'
            : 'bg-foreground/30'
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
            dangerous && checked ? 'text-amber-600' : 'text-foreground/80'
          }`}
        >
          {label}
        </span>
        <p className="text-xs text-foreground/60">{description}</p>
      </div>
    </div>
  );
}
