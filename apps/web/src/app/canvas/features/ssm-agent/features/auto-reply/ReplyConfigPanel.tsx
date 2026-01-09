'use client';

/**
 * SSM Auto-Reply Configuration Panel
 *
 * UI component for configuring automatic email replies.
 * Allows users to set up reply templates, conditions, and rate limits.
 */

import React, { useState, useCallback } from 'react';
import type { SSMAutoReplyConfig } from './types';
import {
  DEFAULT_AUTO_REPLY_CONFIG,
  REPLY_TEMPLATE_EXAMPLES,
} from './defaults';
import { REPLY_PLACEHOLDERS } from './types';

interface ReplyConfigPanelProps {
  config: SSMAutoReplyConfig | undefined;
  onUpdate: (config: SSMAutoReplyConfig) => Promise<void>;
  gmailConnected: boolean;
  gmailCanSend: boolean;
}

export function ReplyConfigPanel({
  config,
  onUpdate,
  gmailConnected,
  gmailCanSend,
}: ReplyConfigPanelProps) {
  const currentConfig = config || DEFAULT_AUTO_REPLY_CONFIG;
  const [isExpanded, setIsExpanded] = useState(currentConfig.enabled);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  const handleToggleEnabled = useCallback(async () => {
    await onUpdate({
      ...currentConfig,
      enabled: !currentConfig.enabled,
    });
  }, [currentConfig, onUpdate]);

  const handleTemplateChange = useCallback(
    async (field: 'subject' | 'body' | 'signature', value: string) => {
      await onUpdate({
        ...currentConfig,
        template: {
          ...currentConfig.template,
          [field]: value,
        },
      });
    },
    [currentConfig, onUpdate]
  );

  const handleIncludeOriginalChange = useCallback(
    async (checked: boolean) => {
      await onUpdate({
        ...currentConfig,
        template: {
          ...currentConfig.template,
          includeOriginal: checked,
        },
      });
    },
    [currentConfig, onUpdate]
  );

  const handleSeverityToggle = useCallback(
    async (severity: 'info' | 'warning' | 'critical') => {
      const currentSeverities = currentConfig.conditions.severities;
      const newSeverities = currentSeverities.includes(severity)
        ? currentSeverities.filter((s) => s !== severity)
        : [...currentSeverities, severity];

      await onUpdate({
        ...currentConfig,
        conditions: {
          ...currentConfig.conditions,
          severities: newSeverities,
        },
      });
    },
    [currentConfig, onUpdate]
  );

  const handleExcludeSendersChange = useCallback(
    async (value: string) => {
      const senders = value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await onUpdate({
        ...currentConfig,
        conditions: {
          ...currentConfig.conditions,
          excludeSenders: senders,
        },
      });
    },
    [currentConfig, onUpdate]
  );

  const handleRateLimitChange = useCallback(
    async (field: 'maxRepliesPerSender' | 'windowMinutes', value: number) => {
      await onUpdate({
        ...currentConfig,
        rateLimit: {
          ...currentConfig.rateLimit,
          [field]: value,
        },
      });
    },
    [currentConfig, onUpdate]
  );

  const handleApplyTemplate = useCallback(
    async (templateIndex: number) => {
      const template = REPLY_TEMPLATE_EXAMPLES[templateIndex];
      if (template) {
        await onUpdate({
          ...currentConfig,
          template: template.template,
        });
      }
    },
    [currentConfig, onUpdate]
  );

  // Check if Gmail is properly connected with send permissions
  const canEnable = gmailConnected && gmailCanSend;

  return (
    <section className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✉️</span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Auto-Reply</h3>
            <p className="text-xs text-foreground/60">
              Automatically reply to matched emails
            </p>
          </div>
        </div>

        {/* Enable Toggle */}
        <button
          onClick={handleToggleEnabled}
          disabled={!canEnable}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${!canEnable ? 'bg-gray-200 cursor-not-allowed opacity-50' : currentConfig.enabled ? 'bg-purple-500' : 'bg-gray-300 hover:bg-gray-400'}
          `}
          title={
            !gmailConnected
              ? 'Connect Gmail first'
              : !gmailCanSend
              ? 'Enable Gmail send permission'
              : currentConfig.enabled
              ? 'Disable auto-reply'
              : 'Enable auto-reply'
          }
        >
          <span
            className={`
              inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
              ${currentConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'}
            `}
          />
        </button>
      </div>

      {/* Warning if Gmail not ready */}
      {!canEnable && (
        <div className="mb-3 p-2 bg-amber-100 border border-amber-300 rounded-lg">
          <p className="text-xs text-amber-800">
            {!gmailConnected
              ? '⚠️ Connect Gmail to enable auto-reply'
              : '⚠️ Enable "Send emails" permission in Gmail settings above'}
          </p>
        </div>
      )}

      {/* Expand/Collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-xs text-purple-600 hover:text-purple-800 mb-2"
      >
        <span>{isExpanded ? 'Hide configuration' : 'Show configuration'}</span>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-purple-200">
          {/* Template Selection */}
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1">
              Quick Templates
            </label>
            <div className="flex flex-wrap gap-2">
              {REPLY_TEMPLATE_EXAMPLES.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyTemplate(idx)}
                  className="px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors"
                  title={template.description}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Template */}
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1">
              Subject Line
            </label>
            <input
              type="text"
              value={currentConfig.template.subject}
              onChange={(e) => handleTemplateChange('subject', e.target.value)}
              placeholder="Re: {subject}"
              className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Body Template */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-foreground/80">
                Reply Body
              </label>
              <button
                onClick={() => setShowPlaceholders(!showPlaceholders)}
                className="text-xs text-purple-600 hover:text-purple-800"
              >
                {showPlaceholders ? 'Hide placeholders' : 'Show placeholders'}
              </button>
            </div>

            {showPlaceholders && (
              <div className="mb-2 p-2 bg-purple-100 rounded-lg">
                <p className="text-xs text-purple-800 mb-1 font-medium">
                  Available Placeholders:
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {REPLY_PLACEHOLDERS.map((p) => (
                    <div key={p.placeholder} className="text-xs">
                      <code className="text-purple-700">{p.placeholder}</code>
                      <span className="text-purple-600 ml-1">- {p.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={currentConfig.template.body}
              onChange={(e) => handleTemplateChange('body', e.target.value)}
              placeholder="Enter your auto-reply message..."
              rows={5}
              className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Signature */}
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1">
              Signature (optional)
            </label>
            <input
              type="text"
              value={currentConfig.template.signature || ''}
              onChange={(e) => handleTemplateChange('signature', e.target.value)}
              placeholder="Best regards, Your Team"
              className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Include Original */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeOriginal"
              checked={currentConfig.template.includeOriginal}
              onChange={(e) => handleIncludeOriginalChange(e.target.checked)}
              className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="includeOriginal" className="text-xs text-foreground/80">
              Include original message in reply
            </label>
          </div>

          {/* Severity Conditions */}
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-2">
              Reply only for these severities:
            </label>
            <div className="flex gap-3">
              {(['info', 'warning', 'critical'] as const).map((severity) => (
                <label key={severity} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={currentConfig.conditions.severities.includes(severity)}
                    onChange={() => handleSeverityToggle(severity)}
                    className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      severity === 'info'
                        ? 'bg-blue-100 text-blue-700'
                        : severity === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {severity}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Exclude Senders */}
          <div>
            <label className="block text-xs font-medium text-foreground/80 mb-1">
              Exclude senders (comma-separated)
            </label>
            <input
              type="text"
              value={currentConfig.conditions.excludeSenders.join(', ')}
              onChange={(e) => handleExcludeSendersChange(e.target.value)}
              placeholder="noreply@, automated@, newsletter@"
              className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-foreground/50 mt-1">
              Emails from these senders won't trigger auto-reply
            </p>
          </div>

          {/* Rate Limiting */}
          <div className="p-3 bg-purple-100/50 rounded-lg">
            <label className="block text-xs font-medium text-foreground/80 mb-2">
              Rate Limiting (prevent spam)
            </label>
            <div className="flex items-center gap-2 text-xs">
              <span>Max</span>
              <input
                type="number"
                min={1}
                max={10}
                value={currentConfig.rateLimit.maxRepliesPerSender}
                onChange={(e) =>
                  handleRateLimitChange('maxRepliesPerSender', parseInt(e.target.value) || 1)
                }
                className="w-14 px-2 py-1 border border-purple-200 rounded text-center"
              />
              <span>reply per sender every</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={currentConfig.rateLimit.windowMinutes}
                onChange={(e) =>
                  handleRateLimitChange('windowMinutes', parseInt(e.target.value) || 60)
                }
                className="w-16 px-2 py-1 border border-purple-200 rounded text-center"
              />
              <span>minutes</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
