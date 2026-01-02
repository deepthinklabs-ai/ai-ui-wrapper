'use client';

/**
 * Genesis Bot Configuration Panel
 *
 * Full configuration UI for Genesis Bot nodes in the Canvas.
 * Allows editing model, system prompt, temperature, and other settings.
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { GenesisBotNodeConfig } from '../../types';
import { AVAILABLE_MODELS, type AIModel } from '@/lib/apiKeyStorage';
import { GmailOAuthPanel } from '../../features/gmail-oauth/components/GmailOAuthPanel';
import { DEFAULT_GMAIL_CONFIG, type GmailOAuthConfig, type GmailPermissions } from '../../features/gmail-oauth/types';
import { CalendarOAuthPanel } from '../../features/calendar-oauth/components/CalendarOAuthPanel';
import { DEFAULT_CALENDAR_CONFIG, type CalendarOAuthConfig, type CalendarPermissions } from '../../features/calendar-oauth/types';
import { SheetsOAuthPanel } from '../../features/sheets-oauth/components/SheetsOAuthPanel';
import { DEFAULT_SHEETS_CONFIG, type SheetsOAuthConfig, type SheetsPermissions } from '../../features/sheets-oauth/types';
import { DocsOAuthPanel } from '../../features/docs-oauth/components/DocsOAuthPanel';
import { DEFAULT_DOCS_CONFIG, type DocsOAuthConfig, type DocsPermissions } from '../../features/docs-oauth/types';
import { SlackOAuthPanel } from '../../features/slack-oauth/components/SlackOAuthPanel';
import { DEFAULT_SLACK_CONFIG, type SlackOAuthConfig, type SlackPermissions } from '../../features/slack-oauth/types';

// ============================================================================
// Integration System Prompt Generators (Hard-coded for UI display)
// ============================================================================

function generateGmailPrompt(permissions: GmailPermissions): string {
  const capabilities: string[] = [];

  if (permissions.canSearch) {
    capabilities.push('• Search emails using Gmail search syntax');
  }
  if (permissions.canRead) {
    capabilities.push('• Read email content and threads');
    capabilities.push('• Get unread count');
    capabilities.push('• List labels/folders');
  }
  if (permissions.canSend) {
    capabilities.push('• Send emails - USE WITH CAUTION');
  }
  if (permissions.canManageDrafts) {
    capabilities.push('• Create email drafts');
  }
  if (permissions.canManageLabels) {
    capabilities.push('• Add/remove labels');
  }

  if (capabilities.length === 0) return '';

  return `📧 GMAIL INTEGRATION
You have access to the user's Gmail account:

${capabilities.join('\n')}

When asked about emails, use these tools proactively. For search, use Gmail search syntax like:
• "from:user@example.com" - emails from a specific sender
• "subject:meeting" - emails with subject containing "meeting"
• "is:unread" - unread emails
• "after:2024/01/01" - emails after a date
• "has:attachment" - emails with attachments

Always be careful with email operations.`;
}

function generateCalendarPrompt(permissions: CalendarPermissions): string {
  const capabilities: string[] = [];

  if (permissions.canRead) {
    capabilities.push('• View calendar events and check availability');
    capabilities.push('• Search for events');
    capabilities.push('• List all calendars');
    capabilities.push('• Find free time slots');
  }
  if (permissions.canCreate) {
    capabilities.push('• Create new calendar events');
    capabilities.push('• Schedule meetings with attendees');
    capabilities.push('• Use natural language to quickly add events');
  }
  if (permissions.canUpdate) {
    capabilities.push('• Update existing events (time, location, attendees)');
  }
  if (permissions.canDelete) {
    capabilities.push('• Delete calendar events');
  }
  if (permissions.canManageReminders) {
    capabilities.push('• Set and manage event reminders');
  }

  if (capabilities.length === 0) return '';

  return `📅 CALENDAR INTEGRATION
You have access to Google Calendar:

${capabilities.join('\n')}

When scheduling events, confirm the time zone and check for conflicts first.`;
}

function generateSheetsPrompt(permissions: SheetsPermissions): string {
  const capabilities: string[] = [];

  if (permissions.canRead) {
    capabilities.push('• Read spreadsheet data');
    capabilities.push('• Batch read multiple ranges');
    capabilities.push('• Get spreadsheet metadata');
  }
  if (permissions.canWrite) {
    capabilities.push('• Write data to cells');
    capabilities.push('• Append rows to sheets');
    capabilities.push('• Clear cell ranges');
    capabilities.push('• Add new sheets');
  }
  if (permissions.canCreate) {
    capabilities.push('• Create new spreadsheets');
  }

  if (capabilities.length === 0) return '';

  return `📊 SHEETS INTEGRATION
You have access to Google Sheets:

${capabilities.join('\n')}

Use A1 notation for cell ranges (e.g., "Sheet1!A1:C10").`;
}

function generateDocsPrompt(permissions: DocsPermissions): string {
  const capabilities: string[] = [];

  if (permissions.canRead) {
    capabilities.push('• Read document content');
    capabilities.push('• Get document text');
    capabilities.push('• Get document metadata');
  }
  if (permissions.canWrite) {
    capabilities.push('• Insert text into documents');
    capabilities.push('• Append text to documents');
    capabilities.push('• Replace text in documents');
    capabilities.push('• Delete content from documents');
  }
  if (permissions.canCreate) {
    capabilities.push('• Create new documents');
  }
  if (permissions.canComment) {
    capabilities.push('• Add comments to documents');
    capabilities.push('• List document comments');
  }

  if (capabilities.length === 0) return '';

  return `📄 DOCS INTEGRATION
You have access to Google Docs:

${capabilities.join('\n')}

Handle document content carefully and preserve formatting when possible.`;
}

function generateSlackPrompt(permissions: SlackPermissions): string {
  const capabilities: string[] = [];

  if (permissions.canReadChannels) {
    capabilities.push('• List channels');
    capabilities.push('• Read channel message history');
  }
  if (permissions.canPostMessages) {
    capabilities.push('• Post messages to channels');
    capabilities.push('• Reply to message threads');
  }
  if (permissions.canReact) {
    capabilities.push('• Add emoji reactions');
    capabilities.push('• Remove emoji reactions');
  }
  if (permissions.canReadUsers) {
    capabilities.push('• Look up user information');
    capabilities.push('• List workspace users');
  }
  if (permissions.canUploadFiles) {
    capabilities.push('• Upload files to channels');
  }
  if (permissions.canManageChannels) {
    capabilities.push('• Create new channels');
  }

  if (capabilities.length === 0) return '';

  return `💬 SLACK INTEGRATION
You have access to Slack:

${capabilities.join('\n')}

Be mindful of channel audiences when posting messages.`;
}

interface GenesisBotConfigPanelProps {
  config: GenesisBotNodeConfig;
  onUpdate: (updates: Partial<GenesisBotNodeConfig>) => void;
}

export default function GenesisBotConfigPanel({
  config,
  onUpdate,
}: GenesisBotConfigPanelProps) {
  // Local state for form fields
  const [formData, setFormData] = useState<GenesisBotNodeConfig>(config);

  // Sync with prop changes
  useEffect(() => {
    setFormData(config);
  }, [config]);

  // Handle field changes
  const handleChange = (field: keyof GenesisBotNodeConfig, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
  };

  // Handle blur (save)
  const handleBlur = (field: keyof GenesisBotNodeConfig) => {
    if (formData[field] !== config[field]) {
      onUpdate({ [field]: formData[field] });
    }
  };

  // Get models for the selected provider
  const availableModelsForProvider = AVAILABLE_MODELS.filter(
    (m) => m.provider === formData.model_provider
  );

  // Generate integration system prompts based on enabled integrations
  const integrationPrompts = useMemo(() => {
    const prompts: { name: string; icon: string; prompt: string; color: string }[] = [];

    // Gmail
    const gmailConfig = formData.gmail || DEFAULT_GMAIL_CONFIG;
    if (gmailConfig.enabled && gmailConfig.permissions) {
      const prompt = generateGmailPrompt(gmailConfig.permissions);
      if (prompt) {
        prompts.push({ name: 'Gmail', icon: '📧', prompt, color: 'red' });
      }
    }

    // Calendar
    const calendarConfig = formData.calendar || DEFAULT_CALENDAR_CONFIG;
    if (calendarConfig.enabled && calendarConfig.permissions) {
      const prompt = generateCalendarPrompt(calendarConfig.permissions);
      if (prompt) {
        prompts.push({ name: 'Calendar', icon: '📅', prompt, color: 'blue' });
      }
    }

    // Sheets
    const sheetsConfig = formData.sheets || DEFAULT_SHEETS_CONFIG;
    if (sheetsConfig.enabled && sheetsConfig.permissions) {
      const prompt = generateSheetsPrompt(sheetsConfig.permissions);
      if (prompt) {
        prompts.push({ name: 'Sheets', icon: '📊', prompt, color: 'green' });
      }
    }

    // Docs
    const docsConfig = formData.docs || DEFAULT_DOCS_CONFIG;
    if (docsConfig.enabled && docsConfig.permissions) {
      const prompt = generateDocsPrompt(docsConfig.permissions);
      if (prompt) {
        prompts.push({ name: 'Docs', icon: '📄', prompt, color: 'blue' });
      }
    }

    // Slack
    const slackConfig = formData.slack || DEFAULT_SLACK_CONFIG;
    if (slackConfig.enabled && slackConfig.permissions) {
      const prompt = generateSlackPrompt(slackConfig.permissions);
      if (prompt) {
        prompts.push({ name: 'Slack', icon: '💬', prompt, color: 'purple' });
      }
    }

    return prompts;
  }, [formData.gmail, formData.calendar, formData.sheets, formData.docs, formData.slack]);

  return (
    <div className="space-y-4">
      {/* Model Configuration */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
          AI Model
        </h5>

        {/* Model Provider */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-foreground/80 mb-2">
            Provider
          </label>
          <select
            value={formData.model_provider}
            onChange={(e) => {
              const provider = e.target.value as 'openai' | 'claude' | 'grok';

              // Auto-select first model of new provider
              const firstModel = AVAILABLE_MODELS.find((m) => m.provider === provider);

              // Update both provider and model immediately
              if (firstModel) {
                onUpdate({
                  model_provider: provider,
                  model_name: firstModel.value,
                });
              } else {
                onUpdate({ model_provider: provider });
              }
            }}
            className="w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm text-foreground focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/50"
          >
            <option value="openai">OpenAI</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="grok">Grok (xAI)</option>
          </select>
        </div>

        {/* Model Name */}
        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-2">
            Model
          </label>
          <select
            value={formData.model_name}
            onChange={(e) => handleChange('model_name', e.target.value as AIModel)}
            onBlur={() => handleBlur('model_name')}
            className="w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm text-foreground focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/50"
          >
            {availableModelsForProvider.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-foreground/50">
            {availableModelsForProvider.find((m) => m.value === formData.model_name)
              ?.description}
          </p>
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Behavior
        </h5>

        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-2">
            System Prompt
          </label>
          <textarea
            value={formData.system_prompt}
            onChange={(e) => handleChange('system_prompt', e.target.value)}
            onBlur={() => handleBlur('system_prompt')}
            rows={8}
            className="w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/50 font-mono"
            placeholder="You are a helpful AI assistant..."
          />
          <p className="mt-1 text-xs text-foreground/50">
            Define the bot's personality, expertise, and behavior
          </p>
        </div>

        {/* Integration System Prompts (Auto-generated, read-only) */}
        {integrationPrompts.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-foreground/20" />
              <span className="text-xs font-medium text-foreground/50 uppercase tracking-wider">
                Integration Prompts (Auto-injected)
              </span>
              <div className="h-px flex-1 bg-foreground/20" />
            </div>

            {integrationPrompts.map((integration, index) => (
              <div
                key={integration.name}
                className="rounded-lg border border-white/30 bg-foreground/5 overflow-hidden"
              >
                {/* Integration Header */}
                <div className={`px-3 py-2 border-b border-white/20 flex items-center gap-2 ${
                  integration.color === 'red' ? 'bg-red-500/10' :
                  integration.color === 'blue' ? 'bg-blue-500/10' :
                  integration.color === 'green' ? 'bg-green-500/10' :
                  integration.color === 'purple' ? 'bg-purple-500/10' :
                  'bg-foreground/5'
                }`}>
                  <span className="text-base">{integration.icon}</span>
                  <span className={`text-xs font-semibold ${
                    integration.color === 'red' ? 'text-red-600' :
                    integration.color === 'blue' ? 'text-blue-600' :
                    integration.color === 'green' ? 'text-green-600' :
                    integration.color === 'purple' ? 'text-purple-600' :
                    'text-foreground/80'
                  }`}>
                    {integration.name}
                  </span>
                  <span className="ml-auto text-xs text-foreground/50 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Read-only
                  </span>
                </div>

                {/* Integration Prompt Content */}
                <div className="px-3 py-2">
                  <pre className="text-xs text-foreground/60 whitespace-pre-wrap font-mono leading-relaxed">
                    {integration.prompt}
                  </pre>
                </div>
              </div>
            ))}

            <p className="text-xs text-foreground/50 italic">
              These prompts are automatically added when integrations are enabled.
              They instruct the AI how to use each integration's tools.
            </p>
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Advanced Settings
        </h5>

        {/* Temperature */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-foreground/80 mb-2">
            Temperature: {formData.temperature?.toFixed(2) || '0.70'}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={formData.temperature || 0.7}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            onMouseUp={() => handleBlur('temperature')}
            className="w-full accent-sky"
          />
          <div className="flex justify-between text-xs text-foreground/50 mt-1">
            <span>More Focused</span>
            <span>More Creative</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-2">
            Max Tokens (Optional)
          </label>
          <input
            type="number"
            min="1"
            max="100000"
            value={formData.max_tokens || ''}
            onChange={(e) =>
              handleChange('max_tokens', e.target.value ? parseInt(e.target.value) : undefined)
            }
            onBlur={() => handleBlur('max_tokens')}
            className="w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/50"
            placeholder="Auto"
          />
          <p className="mt-1 text-xs text-foreground/50">
            Maximum response length (leave empty for model default)
          </p>
        </div>
      </div>

      {/* Description */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Documentation
        </h5>

        <div>
          <label className="block text-xs font-medium text-foreground/80 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value || undefined)}
            onBlur={() => handleBlur('description')}
            rows={3}
            className="w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/50"
            placeholder="Describe what this bot does..."
          />
        </div>
      </div>

      {/* Feature Toggles */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Features
        </h5>

        <div className="space-y-2">
          {/* Streaming */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.streaming_enabled !== false}
              onChange={(e) => handleChange('streaming_enabled', e.target.checked)}
              onBlur={() => handleBlur('streaming_enabled')}
              className="rounded border-white/40 bg-white/60 text-sky focus:ring-2 focus:ring-sky/50"
            />
            <span className="text-sm text-foreground/80">Enable Streaming Responses</span>
          </label>

          {/* Show Thinking */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.show_thinking || false}
              onChange={(e) => handleChange('show_thinking', e.target.checked)}
              onBlur={() => handleBlur('show_thinking')}
              className="rounded border-white/40 bg-white/60 text-sky focus:ring-2 focus:ring-sky/50"
            />
            <span className="text-sm text-foreground/80">Show Thinking Process</span>
          </label>

          {/* Memory */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.memory_enabled || false}
              onChange={(e) => handleChange('memory_enabled', e.target.checked)}
              onBlur={() => handleBlur('memory_enabled')}
              className="rounded border-white/40 bg-white/60 text-sky focus:ring-2 focus:ring-sky/50"
            />
            <span className="text-sm text-foreground/80">Enable Memory (Context Retention)</span>
          </label>

          {/* Web Search */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.web_search_enabled !== false}
              onChange={(e) => handleChange('web_search_enabled', e.target.checked)}
              onBlur={() => handleBlur('web_search_enabled')}
              className="rounded border-white/40 bg-white/60 text-sky focus:ring-2 focus:ring-sky/50"
            />
            <span className="text-sm text-foreground/80">Enable Web Search (Real-time Information)</span>
          </label>
        </div>
      </div>

      {/* Integrations Section */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Integrations
        </h5>

        {/* Gmail OAuth Panel */}
        <GmailOAuthPanel
          config={formData.gmail || DEFAULT_GMAIL_CONFIG}
          onConfigChange={(gmailConfig: GmailOAuthConfig) => {
            handleChange('gmail', gmailConfig);
            // Save immediately when Gmail config changes
            onUpdate({ gmail: gmailConfig });
          }}
        />

        {/* Divider */}
        <div className="my-4 border-t border-white/10" />

        {/* Calendar OAuth Panel */}
        <CalendarOAuthPanel
          config={formData.calendar || DEFAULT_CALENDAR_CONFIG}
          onConfigChange={(calendarConfig: CalendarOAuthConfig) => {
            handleChange('calendar', calendarConfig);
            // Save immediately when Calendar config changes
            onUpdate({ calendar: calendarConfig });
          }}
        />

        {/* Divider */}
        <div className="my-4 border-t border-white/10" />

        {/* Sheets OAuth Panel */}
        <SheetsOAuthPanel
          config={formData.sheets || DEFAULT_SHEETS_CONFIG}
          onConfigChange={(sheetsConfig: SheetsOAuthConfig) => {
            handleChange('sheets', sheetsConfig);
            // Save immediately when Sheets config changes
            onUpdate({ sheets: sheetsConfig });
          }}
        />

        {/* Divider */}
        <div className="my-4 border-t border-white/10" />

        {/* Docs OAuth Panel */}
        <DocsOAuthPanel
          config={formData.docs || DEFAULT_DOCS_CONFIG}
          onConfigChange={(docsConfig: DocsOAuthConfig) => {
            handleChange('docs', docsConfig);
            // Save immediately when Docs config changes
            onUpdate({ docs: docsConfig });
          }}
        />

        {/* Divider */}
        <div className="my-4 border-t border-white/10" />

        {/* Slack OAuth Panel */}
        <SlackOAuthPanel
          config={formData.slack || DEFAULT_SLACK_CONFIG}
          onConfigChange={(slackConfig: SlackOAuthConfig) => {
            handleChange('slack', slackConfig);
            // Save immediately when Slack config changes
            onUpdate({ slack: slackConfig });
          }}
        />
      </div>
    </div>
  );
}
