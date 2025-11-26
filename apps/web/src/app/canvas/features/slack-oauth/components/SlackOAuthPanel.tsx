/**
 * Slack OAuth Panel Component
 *
 * UI panel for configuring Slack OAuth in Genesis Bot nodes.
 * Displays connection status, permissions toggles, and available tools.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useSlackOAuth } from '../hooks/useSlackOAuth';
import type { SlackOAuthConfig, SlackPermissions } from '../types';
import { DEFAULT_SLACK_CONFIG } from '../types';

interface SlackOAuthPanelProps {
  config: SlackOAuthConfig;
  onConfigChange: (config: SlackOAuthConfig) => void;
  disabled?: boolean;
}

export function SlackOAuthPanel({
  config,
  onConfigChange,
  disabled = false,
}: SlackOAuthPanelProps) {
  const { connection, status, isLoading, error, connect, disconnect } = useSlackOAuth();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Use provided config or defaults
  const currentConfig: SlackOAuthConfig = {
    ...DEFAULT_SLACK_CONFIG,
    ...config,
  };

  const handleToggleEnabled = () => {
    onConfigChange({
      ...currentConfig,
      enabled: !currentConfig.enabled,
    });
  };

  const handlePermissionChange = (permission: keyof SlackPermissions, value: boolean) => {
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
      workspaceName: undefined,
      workspaceId: undefined,
    });
    setIsDisconnecting(false);
  };

  const handleConnect = () => {
    connect();
  };

  // Update config with connection info when connected
  useEffect(() => {
    if (connection?.id && currentConfig.enabled && connection.id !== currentConfig.connectionId) {
      onConfigChange({
        ...currentConfig,
        connectionId: connection.id,
        workspaceName: connection.workspaceName,
        workspaceId: connection.workspaceId,
      });
    }
  }, [connection?.id, currentConfig.enabled, currentConfig.connectionId, onConfigChange]);

  return (
    <div className="space-y-4">
      {/* Header with Enable Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-[#4A154B]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
          </svg>
          <span className="text-sm font-medium text-slate-200">Slack</span>
        </div>
        <button
          type="button"
          onClick={handleToggleEnabled}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            currentConfig.enabled ? 'bg-[#4A154B]' : 'bg-slate-600'
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
                  <div className="w-8 h-8 rounded-lg bg-[#4A154B] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {connection.workspaceName}
                    </p>
                    <p className="text-xs text-slate-400">Slack Workspace</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-xs text-green-400">Connected</span>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-full mt-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                >
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">
                  Connect your Slack workspace to enable messaging capabilities.
                </p>
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <button
                  onClick={handleConnect}
                  className="w-full px-3 py-2 bg-[#4A154B] hover:bg-[#611f69] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" />
                  </svg>
                  Add to Slack
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
                  label="Read Channels"
                  description="List channels and read message history"
                  checked={currentConfig.permissions.canReadChannels}
                  onChange={(v) => handlePermissionChange('canReadChannels', v)}
                  disabled={disabled}
                />
                <PermissionToggle
                  label="Post Messages"
                  description="Send messages and reply to threads"
                  checked={currentConfig.permissions.canPostMessages}
                  onChange={(v) => handlePermissionChange('canPostMessages', v)}
                  disabled={disabled}
                  dangerous
                />
                <PermissionToggle
                  label="Reactions"
                  description="Add and remove emoji reactions"
                  checked={currentConfig.permissions.canReact}
                  onChange={(v) => handlePermissionChange('canReact', v)}
                  disabled={disabled}
                />
                <PermissionToggle
                  label="Read Users"
                  description="Look up user information"
                  checked={currentConfig.permissions.canReadUsers}
                  onChange={(v) => handlePermissionChange('canReadUsers', v)}
                  disabled={disabled}
                />
                <PermissionToggle
                  label="Upload Files"
                  description="Upload files and snippets to channels"
                  checked={currentConfig.permissions.canUploadFiles}
                  onChange={(v) => handlePermissionChange('canUploadFiles', v)}
                  disabled={disabled}
                  dangerous
                />
                <PermissionToggle
                  label="Manage Channels"
                  description="Create new channels"
                  checked={currentConfig.permissions.canManageChannels}
                  onChange={(v) => handlePermissionChange('canManageChannels', v)}
                  disabled={disabled}
                  dangerous
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
                {currentConfig.permissions.canReadChannels && (
                  <>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">slack_list_channels</span>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">slack_get_channel_history</span>
                  </>
                )}
                {currentConfig.permissions.canPostMessages && (
                  <>
                    <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">slack_post_message</span>
                    <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">slack_reply_to_thread</span>
                  </>
                )}
                {currentConfig.permissions.canReact && (
                  <>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">slack_add_reaction</span>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">slack_remove_reaction</span>
                  </>
                )}
                {currentConfig.permissions.canReadUsers && (
                  <>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">slack_get_user_info</span>
                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">slack_list_users</span>
                  </>
                )}
                {currentConfig.permissions.canUploadFiles && (
                  <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">slack_upload_file</span>
                )}
                {currentConfig.permissions.canManageChannels && (
                  <span className="px-2 py-0.5 bg-amber-900/50 rounded text-xs text-amber-300">slack_create_channel</span>
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
              : 'bg-[#4A154B]'
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
