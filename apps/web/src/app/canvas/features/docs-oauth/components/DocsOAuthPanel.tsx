/**
 * DocsOAuthPanel Component
 *
 * UI panel for configuring Google Docs permissions in Canvas nodes.
 * Connection is managed in Settings - this only shows status and permission toggles.
 */

'use client';

import React from 'react';
import { useGmailOAuth } from '../../gmail-oauth/hooks/useGmailOAuth';
import type { DocsOAuthConfig, DocsPermissions } from '../types';
import { DEFAULT_DOCS_CONFIG } from '../types';
import { SafeImage } from '@/lib/sanitizeUrl';

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
  const { connection, status, isLoading } = useGmailOAuth();

  // Use provided config or defaults
  const currentConfig: DocsOAuthConfig = {
    ...DEFAULT_DOCS_CONFIG,
    ...config,
    permissions: {
      ...DEFAULT_DOCS_CONFIG.permissions,
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

  const handlePermissionChange = (permission: keyof DocsPermissions, value: boolean) => {
    onConfigChange({
      ...currentConfig,
      permissions: {
        ...currentConfig.permissions,
        [permission]: value,
      },
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
          <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
          </svg>
          <span className="text-sm font-medium text-foreground/80">Google Docs</span>
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
                label="Read Documents"
                description="Allow reading document content"
                checked={currentConfig.permissions.canRead}
                onChange={(v) => handlePermissionChange('canRead', v)}
                disabled={disabled}
              />
              <PermissionToggle
                label="Write Documents"
                description="Allow inserting, appending, and modifying text"
                checked={currentConfig.permissions.canWrite}
                onChange={(v) => handlePermissionChange('canWrite', v)}
                disabled={disabled}
                dangerous
              />
              <PermissionToggle
                label="Create Documents"
                description="Allow creating new documents"
                checked={currentConfig.permissions.canCreate}
                onChange={(v) => handlePermissionChange('canCreate', v)}
                disabled={disabled}
                dangerous
              />
              <PermissionToggle
                label="Comments"
                description="Allow adding and listing comments"
                checked={currentConfig.permissions.canComment}
                onChange={(v) => handlePermissionChange('canComment', v)}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Available Tools Info */}
          <div className="bg-foreground/5 rounded-lg p-3">
            <label className="block text-xs font-medium text-foreground/80 mb-2">
              Available Tools
            </label>
            <div className="flex flex-wrap gap-1.5">
              {currentConfig.permissions.canRead && (
                <>
                  <span className="px-2 py-0.5 bg-foreground/10 rounded text-xs text-foreground/70">docs_read</span>
                  <span className="px-2 py-0.5 bg-foreground/10 rounded text-xs text-foreground/70">docs_get_text</span>
                  <span className="px-2 py-0.5 bg-foreground/10 rounded text-xs text-foreground/70">docs_get_metadata</span>
                </>
              )}
              {currentConfig.permissions.canWrite && (
                <>
                  <span className="px-2 py-0.5 bg-amber-500/20 rounded text-xs text-amber-600">docs_insert_text</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 rounded text-xs text-amber-600">docs_append_text</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 rounded text-xs text-amber-600">docs_replace_text</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 rounded text-xs text-amber-600">docs_delete_content</span>
                </>
              )}
              {currentConfig.permissions.canCreate && (
                <span className="px-2 py-0.5 bg-amber-500/20 rounded text-xs text-amber-600">docs_create</span>
              )}
              {currentConfig.permissions.canComment && (
                <>
                  <span className="px-2 py-0.5 bg-foreground/10 rounded text-xs text-foreground/70">docs_add_comment</span>
                  <span className="px-2 py-0.5 bg-foreground/10 rounded text-xs text-foreground/70">docs_list_comments</span>
                </>
              )}
            </div>
          </div>
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
