/**
 * DriveOAuthPanel Component
 *
 * UI panel for configuring Google Drive permissions in Canvas nodes.
 * Connection is managed in Settings - this only shows status and permission toggles.
 */

'use client';

import React from 'react';
import { useDriveOAuth } from '../hooks/useDriveOAuth';
import type { DriveOAuthConfig, DrivePermissions } from '../types';
import { DEFAULT_DRIVE_CONFIG } from '../types';
import { SafeImage } from '@/lib/sanitizeUrl';

interface DriveOAuthPanelProps {
  config: DriveOAuthConfig;
  onConfigChange: (config: DriveOAuthConfig) => void;
  disabled?: boolean;
}

export function DriveOAuthPanel({
  config,
  onConfigChange,
  disabled = false,
}: DriveOAuthPanelProps) {
  const { connection, status, isLoading } = useDriveOAuth();

  // Use provided config or defaults
  const currentConfig: DriveOAuthConfig = {
    ...DEFAULT_DRIVE_CONFIG,
    ...config,
    permissions: {
      ...DEFAULT_DRIVE_CONFIG.permissions,
      ...config.permissions,
    },
  };

  const handleToggleEnabled = () => {
    if (!connection && !currentConfig.enabled) return;
    onConfigChange({
      ...currentConfig,
      enabled: !currentConfig.enabled,
    });
  };

  const handlePermissionChange = (permission: keyof DrivePermissions, value: boolean) => {
    onConfigChange({
      ...currentConfig,
      permissions: {
        ...currentConfig.permissions,
        [permission]: value,
      },
    });
  };

  const handleSettingChange = (
    setting: 'maxFileSizeMB',
    value: number
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
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7.71 3.5L1.15 15l3.43 6h12.84l3.43-6L14.29 3.5H7.71zm-.33 2h5.24l4.92 8.5H3.46l4.92-8.5zM5.5 19l-2-3.5h3.97L5.5 19zm13 0l-1.97-3.5H20.5l-2 3.5zM12 16.5l2-3.5h-4l2 3.5z"/>
          </svg>
          <span className="text-sm font-medium text-foreground/80">Google Drive</span>
        </div>
        <button
          type="button"
          onClick={handleToggleEnabled}
          disabled={disabled || !isConnected}
          title={!isConnected ? 'Connect Google in Settings first' : ''}
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
            <SafeImage src={connection.picture} alt="" className="w-8 h-8 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{connection.name}</p>
              <p className="text-xs text-foreground/60 truncate">{connection.email}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-green-600">Connected</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-foreground/60 mb-2">Google not connected</p>
            <a href="/settings" className="text-xs text-sky hover:text-sky/80 underline">
              Go to Settings to connect Google
            </a>
          </div>
        )}
      </div>

      {/* Permissions - Only show when connected and enabled */}
      {isConnected && currentConfig.enabled && (
        <>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-foreground/80">Permissions</label>
            <div className="space-y-2 bg-foreground/5 rounded-lg p-3">
              <PermissionToggle
                label="Read Files"
                description="Allow viewing and downloading files"
                checked={currentConfig.permissions.canRead}
                onChange={(v) => handlePermissionChange('canRead', v)}
                disabled={disabled}
              />
              <PermissionToggle
                label="Write Files"
                description="Allow creating and uploading files"
                checked={currentConfig.permissions.canWrite}
                onChange={(v) => handlePermissionChange('canWrite', v)}
                disabled={disabled}
                dangerous
              />
              <PermissionToggle
                label="Search Files"
                description="Allow searching across Drive"
                checked={currentConfig.permissions.canSearch}
                onChange={(v) => handlePermissionChange('canSearch', v)}
                disabled={disabled}
              />
              <PermissionToggle
                label="Share Files"
                description="Allow sharing files with others"
                checked={currentConfig.permissions.canShare}
                onChange={(v) => handlePermissionChange('canShare', v)}
                disabled={disabled}
                dangerous
              />
            </div>
          </div>

          {/* Safety Settings */}
          {currentConfig.permissions.canWrite && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground/80">Safety Settings</label>
              <div className="space-y-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div>
                  <label className="block text-xs text-foreground/80 mb-1">Max File Size (MB)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={currentConfig.maxFileSizeMB ?? 10}
                    onChange={(e) => handleSettingChange('maxFileSizeMB', parseInt(e.target.value) || 10)}
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

function PermissionToggle({ label, description, checked, onChange, disabled, dangerous }: PermissionToggleProps) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative mt-0.5 inline-flex h-4 w-7 items-center rounded-full transition-colors ${
          checked ? (dangerous ? 'bg-amber-500' : 'bg-sky') : 'bg-foreground/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className="inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform"
          style={{ transform: checked ? 'translateX(14px)' : 'translateX(3px)' }}
        />
      </button>
      <div className="flex-1">
        <span className={`text-sm ${dangerous && checked ? 'text-amber-600' : 'text-foreground/80'}`}>{label}</span>
        <p className="text-xs text-foreground/60">{description}</p>
      </div>
    </div>
  );
}
