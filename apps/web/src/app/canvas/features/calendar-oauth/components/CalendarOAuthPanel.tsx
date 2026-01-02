/**
 * CalendarOAuthPanel Component
 *
 * UI panel for configuring Google Calendar OAuth in Genesis Bot nodes.
 * Displays connection status, permissions toggles, and safety settings.
 */

'use client';

import React, { useState } from 'react';
import { useCalendarOAuth } from '../hooks/useCalendarOAuth';
import type { CalendarOAuthConfig, CalendarPermissions } from '../types';
import { DEFAULT_CALENDAR_CONFIG } from '../types';
import { SafeImage } from '@/lib/sanitizeUrl';

interface CalendarOAuthPanelProps {
  config: CalendarOAuthConfig;
  onConfigChange: (config: CalendarOAuthConfig) => void;
  disabled?: boolean;
}

export function CalendarOAuthPanel({
  config,
  onConfigChange,
  disabled = false,
}: CalendarOAuthPanelProps) {
  const { connection, status, isLoading, error, connect, disconnect } = useCalendarOAuth();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Use provided config or defaults - deep merge permissions
  const currentConfig: CalendarOAuthConfig = {
    ...DEFAULT_CALENDAR_CONFIG,
    ...config,
    // Deep merge permissions to ensure all permission keys exist
    permissions: {
      ...DEFAULT_CALENDAR_CONFIG.permissions,
      ...config.permissions,
    },
  };

  const handleToggleEnabled = () => {
    onConfigChange({
      ...currentConfig,
      enabled: !currentConfig.enabled,
    });
  };

  const handlePermissionChange = (permission: keyof CalendarPermissions, value: boolean) => {
    onConfigChange({
      ...currentConfig,
      permissions: {
        ...currentConfig.permissions,
        [permission]: value,
      },
    });
  };

  const handleSettingChange = (
    setting: 'requireConfirmation' | 'maxEventsPerDay',
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
  // Also auto-enable Calendar when a connection is detected
  React.useEffect(() => {
    if (connection?.id && connection.id !== currentConfig.connectionId) {
      console.log('[CalendarOAuthPanel] Connection detected, saving connectionId and enabling Calendar');
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
            className="w-5 h-5 text-blue-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
          </svg>
          <span className="text-sm font-medium text-foreground/80">Calendar</span>
        </div>
        <button
          type="button"
          onClick={handleToggleEnabled}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            currentConfig.enabled ? 'bg-sky' : 'bg-foreground/30'
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
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-white/30">
            {isLoading ? (
              <div className="flex items-center gap-2 text-foreground/60">
                <div className="animate-spin h-4 w-4 border-2 border-foreground/40 border-t-transparent rounded-full" />
                <span className="text-sm">Checking connection...</span>
              </div>
            ) : status === 'connected' && connection ? (
              <div className="space-y-2">
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
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-full px-3 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect Google Account'}
                </button>
                <p className="text-xs text-foreground/50 text-center">
                  Note: Disconnecting affects all Google services (Gmail, Calendar, etc.)
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-foreground/60">
                  Connect your Google account to enable calendar capabilities.
                </p>
                {error && (
                  <p className="text-xs text-red-500">{error}</p>
                )}
                <button
                  onClick={handleConnect}
                  className="w-full px-3 py-2 bg-sky hover:bg-sky/80 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
                  </svg>
                  Connect Google Calendar
                </button>
              </div>
            )}
          </div>

          {/* Permissions - Only show when connected */}
          {status === 'connected' && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-foreground/80">
                  Permissions
                </label>
                <div className="space-y-2 bg-foreground/5 rounded-lg p-3">
                  <PermissionToggle
                    label="Read Calendar"
                    description="Allow bot to view events and availability"
                    checked={currentConfig.permissions.canRead}
                    onChange={(v) => handlePermissionChange('canRead', v)}
                    disabled={disabled}
                  />
                  <PermissionToggle
                    label="Create Events"
                    description="Allow bot to create new calendar events"
                    checked={currentConfig.permissions.canCreate}
                    onChange={(v) => handlePermissionChange('canCreate', v)}
                    disabled={disabled}
                    dangerous
                  />
                  <PermissionToggle
                    label="Update Events"
                    description="Allow bot to modify existing events"
                    checked={currentConfig.permissions.canUpdate}
                    onChange={(v) => handlePermissionChange('canUpdate', v)}
                    disabled={disabled}
                    dangerous
                  />
                  <PermissionToggle
                    label="Delete Events"
                    description="Allow bot to delete calendar events"
                    checked={currentConfig.permissions.canDelete}
                    onChange={(v) => handlePermissionChange('canDelete', v)}
                    disabled={disabled}
                    dangerous
                  />
                  <PermissionToggle
                    label="Manage Reminders"
                    description="Allow bot to set event reminders"
                    checked={currentConfig.permissions.canManageReminders}
                    onChange={(v) => handlePermissionChange('canManageReminders', v)}
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Safety Settings - Only show if Create/Update/Delete is enabled */}
              {(currentConfig.permissions.canCreate || currentConfig.permissions.canUpdate || currentConfig.permissions.canDelete) && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-foreground/80">
                    Safety Settings
                  </label>
                  <div className="space-y-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <PermissionToggle
                      label="Require Confirmation"
                      description="Ask for confirmation before modifying calendar"
                      checked={currentConfig.requireConfirmation ?? true}
                      onChange={(v) => handleSettingChange('requireConfirmation', v)}
                      disabled={disabled}
                    />
                    <div>
                      <label className="block text-xs text-foreground/80 mb-1">
                        Max Events Per Day
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={currentConfig.maxEventsPerDay ?? 20}
                        onChange={(e) =>
                          handleSettingChange('maxEventsPerDay', parseInt(e.target.value) || 20)
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
