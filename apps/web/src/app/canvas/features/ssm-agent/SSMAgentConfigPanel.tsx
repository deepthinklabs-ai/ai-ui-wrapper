/**
 * SSMAgentConfigPanel Component
 *
 * Configuration interface for SSM (State-Space Model) nodes.
 *
 * New Architecture:
 * - LLM used ONLY at setup to generate rules
 * - Runtime uses pure pattern matching ($0 cost)
 * - Pre-defined response templates
 * - OAuth integrations for data source access
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type {
  SSMAgentNodeConfig,
  SSMRulesConfig,
  SSMKeywordRule,
  SSMPatternRule,
} from '../../types/ssm';
import {
  DEFAULT_SSM_CONFIG,
  EVENT_SOURCE_OPTIONS,
  POLLING_SOURCE_OPTIONS,
  AI_PROVIDER_OPTIONS,
  MONITORING_EXAMPLES,
  hasRulesConfigured,
  countEnabledRules,
  generateRuleId,
} from './lib/ssmDefaults';
import { testRules, getRuleStats } from './lib/ssmRulesEngine';

// OAuth Integration Panels
import { GmailOAuthPanel } from '../../features/gmail-oauth/components/GmailOAuthPanel';
import { DEFAULT_GMAIL_CONFIG, type GmailOAuthConfig } from '../../features/gmail-oauth/types';
import { CalendarOAuthPanel } from '../../features/calendar-oauth/components/CalendarOAuthPanel';
import { DEFAULT_CALENDAR_CONFIG, type CalendarOAuthConfig } from '../../features/calendar-oauth/types';
import { SheetsOAuthPanel } from '../../features/sheets-oauth/components/SheetsOAuthPanel';
import { DEFAULT_SHEETS_CONFIG, type SheetsOAuthConfig } from '../../features/sheets-oauth/types';
import { DocsOAuthPanel } from '../../features/docs-oauth/components/DocsOAuthPanel';
import { DEFAULT_DOCS_CONFIG, type DocsOAuthConfig } from '../../features/docs-oauth/types';
import { SlackOAuthPanel } from '../../features/slack-oauth/components/SlackOAuthPanel';
import { DEFAULT_SLACK_CONFIG, type SlackOAuthConfig } from '../../features/slack-oauth/types';

// ============================================================================
// TYPES
// ============================================================================

interface SSMAgentConfigPanelProps {
  nodeId: string;
  canvasId: string;
  userId: string;
  config: SSMAgentNodeConfig;
  onUpdate: (updates: Partial<SSMAgentNodeConfig>) => Promise<boolean>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SSMAgentConfigPanel({
  nodeId,
  canvasId,
  userId,
  config,
  onUpdate,
}: SSMAgentConfigPanelProps) {
  // Local state for form data (needed for OAuth panels)
  const [formData, setFormData] = useState<SSMAgentNodeConfig>({ ...DEFAULT_SSM_CONFIG, ...config });

  // Sync with prop changes
  useEffect(() => {
    setFormData({ ...DEFAULT_SSM_CONFIG, ...config });
  }, [config]);

  // Merge with defaults (for display)
  const currentConfig = formData;

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'claude' | 'openai'>('claude');
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState<{ matched: boolean; rules: string[] } | null>(null);

  // Check if rules are configured
  const rulesConfigured = hasRulesConfigured(currentConfig.rules);
  const enabledRuleCount = countEnabledRules(currentConfig.rules);
  const ruleStats = getRuleStats(currentConfig.rules);

  /**
   * Generate rules from description using AI
   */
  const handleGenerateRules = useCallback(async () => {
    if (!currentConfig.monitoring_description?.trim()) {
      setGenerateError('Please enter a description of what you want to monitor');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const response = await fetch('/api/canvas/ssm/generate-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: currentConfig.monitoring_description,
          provider: selectedProvider,
        }),
      });

      const result = await response.json();

      if (result.success && result.rules) {
        await onUpdate({
          rules: result.rules,
          response_templates: result.response_templates || currentConfig.response_templates,
          rules_generated_at: new Date().toISOString(),
          rules_generated_by: selectedProvider,
        });
      } else {
        setGenerateError(result.error || 'Failed to generate rules');
      }
    } catch (error) {
      setGenerateError('Failed to connect to AI service');
    } finally {
      setIsGenerating(false);
    }
  }, [currentConfig.monitoring_description, currentConfig.response_templates, selectedProvider, onUpdate]);

  /**
   * Test rules against sample content
   */
  const handleTestRules = useCallback(() => {
    if (!testContent.trim()) return;

    const result = testRules(testContent, currentConfig.rules);
    setTestResult({
      matched: result.matched,
      rules: result.matched_rules.map(r => r.rule_name),
    });
  }, [testContent, currentConfig.rules]);

  /**
   * Add a manual keyword rule
   */
  const handleAddKeyword = useCallback(async (keyword: string, severity: 'info' | 'warning' | 'critical') => {
    const newRule: SSMKeywordRule = {
      id: generateRuleId('kw'),
      keyword,
      caseSensitive: false,
      severity,
      enabled: true,
    };

    await onUpdate({
      rules: {
        ...currentConfig.rules,
        keywords: [...currentConfig.rules.keywords, newRule],
      },
    });
  }, [currentConfig.rules, onUpdate]);

  /**
   * Toggle a rule's enabled state
   */
  const handleToggleRule = useCallback(async (
    type: 'keywords' | 'patterns' | 'conditions',
    ruleId: string
  ) => {
    const updatedRules = {
      ...currentConfig.rules,
      [type]: currentConfig.rules[type].map((rule: any) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      ),
    };
    await onUpdate({ rules: updatedRules });
  }, [currentConfig.rules, onUpdate]);

  /**
   * Delete a rule
   */
  const handleDeleteRule = useCallback(async (
    type: 'keywords' | 'patterns' | 'conditions',
    ruleId: string
  ) => {
    const updatedRules = {
      ...currentConfig.rules,
      [type]: currentConfig.rules[type].filter((rule: any) => rule.id !== ruleId),
    };
    await onUpdate({ rules: updatedRules });
  }, [currentConfig.rules, onUpdate]);

  return (
    <div className="space-y-6 p-4">
      {/* Header Info */}
      <div className="p-3 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-xl">📊</span>
          <div>
            <p className="text-xs text-teal-700 font-medium">Smart Stream Monitor</p>
            <p className="text-xs text-teal-600 mt-1">
              Rules-based monitoring. AI generates rules at setup, runtime is free.
            </p>
          </div>
        </div>
      </div>

      {/* Section: Identity */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>📋</span> Identity
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Name</label>
            <input
              type="text"
              value={currentConfig.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </section>

      {/* Section: What to Monitor */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>🎯</span> What to Monitor
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-1">
              Describe what you want to monitor for:
            </label>
            <textarea
              value={currentConfig.monitoring_description}
              onChange={(e) => onUpdate({ monitoring_description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="e.g., Detect phishing attempts, suspicious links, and urgent money transfer requests..."
            />
          </div>

          {/* Example prompts */}
          <div>
            <p className="text-xs text-foreground/50 mb-2">Quick examples:</p>
            <div className="flex flex-wrap gap-2">
              {MONITORING_EXAMPLES.map((example) => (
                <button
                  key={example.title}
                  type="button"
                  onClick={() => onUpdate({ monitoring_description: example.description })}
                  className="text-xs px-2 py-1 bg-foreground/5 hover:bg-foreground/10 rounded-full text-foreground/70 transition-colors"
                >
                  {example.title}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Rules Button */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-foreground/60">Generate with:</label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as 'claude' | 'openai')}
                className="text-xs px-2 py-1 border border-foreground/20 rounded bg-white"
              >
                {AI_PROVIDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleGenerateRules}
              disabled={isGenerating || !currentConfig.monitoring_description?.trim()}
              className={`
                w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors
                flex items-center justify-center gap-2
                ${isGenerating || !currentConfig.monitoring_description?.trim()
                  ? 'bg-foreground/10 text-foreground/50 cursor-not-allowed'
                  : 'bg-teal-500 text-white hover:bg-teal-600'
                }
              `}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating Rules...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Generate Rules (~$0.01)
                </>
              )}
            </button>
            {generateError && (
              <p className="text-xs text-red-500 mt-2">{generateError}</p>
            )}
          </div>
        </div>
      </section>

      {/* Section: Generated Rules */}
      {rulesConfigured && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>📜</span> Rules ({enabledRuleCount} active)
          </h3>

          {/* Rule Stats */}
          <div className="flex gap-2 mb-3">
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              {ruleStats.bySeverity.info} Info
            </span>
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
              {ruleStats.bySeverity.warning} Warning
            </span>
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
              {ruleStats.bySeverity.critical} Critical
            </span>
          </div>

          {/* Keywords */}
          {currentConfig.rules.keywords.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-foreground/60 mb-2">Keywords:</p>
              <div className="space-y-1">
                {currentConfig.rules.keywords.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-2 p-2 rounded border ${
                      rule.enabled ? 'bg-white border-foreground/20' : 'bg-foreground/5 border-foreground/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule('keywords', rule.id)}
                      className="w-4 h-4 rounded text-teal-500"
                    />
                    <span className={`text-xs flex-1 ${rule.enabled ? '' : 'text-foreground/50'}`}>
                      {rule.keyword}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      rule.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      rule.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {rule.severity}
                    </span>
                    <button
                      onClick={() => handleDeleteRule('keywords', rule.id)}
                      className="text-foreground/40 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Patterns */}
          {currentConfig.rules.patterns.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-foreground/60 mb-2">Patterns:</p>
              <div className="space-y-1">
                {currentConfig.rules.patterns.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-2 p-2 rounded border ${
                      rule.enabled ? 'bg-white border-foreground/20' : 'bg-foreground/5 border-foreground/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule('patterns', rule.id)}
                      className="w-4 h-4 rounded text-teal-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs block ${rule.enabled ? '' : 'text-foreground/50'}`}>
                        {rule.name}
                      </span>
                      <span className="text-xs text-foreground/40 block truncate">
                        {rule.description}
                      </span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      rule.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      rule.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {rule.severity}
                    </span>
                    <button
                      onClick={() => handleDeleteRule('patterns', rule.id)}
                      className="text-foreground/40 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conditions */}
          {currentConfig.rules.conditions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-foreground/60 mb-2">Conditions:</p>
              <div className="space-y-1">
                {currentConfig.rules.conditions.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-2 p-2 rounded border ${
                      rule.enabled ? 'bg-white border-foreground/20' : 'bg-foreground/5 border-foreground/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule('conditions', rule.id)}
                      className="w-4 h-4 rounded text-teal-500"
                    />
                    <span className={`text-xs flex-1 ${rule.enabled ? '' : 'text-foreground/50'}`}>
                      {rule.field} {rule.operator} "{rule.value}"
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      rule.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      rule.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {rule.severity}
                    </span>
                    <button
                      onClick={() => handleDeleteRule('conditions', rule.id)}
                      className="text-foreground/40 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generation Info */}
          {currentConfig.rules_generated_at && (
            <p className="text-xs text-foreground/40">
              Generated {new Date(currentConfig.rules_generated_at).toLocaleDateString()} via {currentConfig.rules_generated_by}
            </p>
          )}
        </section>
      )}

      {/* Section: Test Rules */}
      {rulesConfigured && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>🧪</span> Test Rules
          </h3>
          <div className="space-y-3">
            <textarea
              value={testContent}
              onChange={(e) => setTestContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none font-mono text-xs"
              placeholder="Enter test content to see which rules match..."
            />
            <button
              type="button"
              onClick={handleTestRules}
              disabled={!testContent.trim()}
              className={`
                w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors
                ${!testContent.trim()
                  ? 'bg-foreground/10 text-foreground/50 cursor-not-allowed'
                  : 'bg-foreground/10 text-foreground hover:bg-foreground/20'
                }
              `}
            >
              Test Rules (Free)
            </button>

            {testResult && (
              <div className={`p-3 rounded-lg border ${
                testResult.matched ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
              }`}>
                {testResult.matched ? (
                  <>
                    <p className="text-sm font-medium text-amber-700">⚠️ Matched!</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Triggered: {testResult.rules.join(', ')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-green-700">✓ No matches</p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section: Event Source */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>📡</span> Event Source
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_SOURCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onUpdate({ event_source_type: option.value })}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left
                ${currentConfig.event_source_type === option.value
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-foreground/20 hover:border-foreground/30 bg-white'
                }
              `}
            >
              <span>{option.icon}</span>
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Runtime Stats */}
      {(currentConfig.events_processed || 0) > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>📈</span> Statistics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-foreground/5 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{currentConfig.events_processed}</p>
              <p className="text-xs text-foreground/60">Events Processed</p>
            </div>
            <div className="p-3 bg-foreground/5 rounded-lg">
              <p className="text-2xl font-bold text-foreground">{currentConfig.alerts_triggered}</p>
              <p className="text-xs text-foreground/60">Alerts Triggered</p>
            </div>
          </div>
        </section>
      )}

      {/* Section: Integrations */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>🔗</span> Data Source Integrations
        </h3>
        <p className="text-xs text-foreground/60 mb-4">
          Connect to external services to monitor their data streams.
        </p>

        {/* Gmail OAuth Panel */}
        <GmailOAuthPanel
          config={formData.gmail || DEFAULT_GMAIL_CONFIG}
          onConfigChange={(gmailConfig: GmailOAuthConfig) => {
            setFormData(prev => ({ ...prev, gmail: gmailConfig }));
            onUpdate({ gmail: gmailConfig });
          }}
        />

        <div className="my-4 border-t border-foreground/10" />

        {/* Calendar OAuth Panel */}
        <CalendarOAuthPanel
          config={formData.calendar || DEFAULT_CALENDAR_CONFIG}
          onConfigChange={(calendarConfig: CalendarOAuthConfig) => {
            setFormData(prev => ({ ...prev, calendar: calendarConfig }));
            onUpdate({ calendar: calendarConfig });
          }}
        />

        <div className="my-4 border-t border-foreground/10" />

        {/* Sheets OAuth Panel */}
        <SheetsOAuthPanel
          config={formData.sheets || DEFAULT_SHEETS_CONFIG}
          onConfigChange={(sheetsConfig: SheetsOAuthConfig) => {
            setFormData(prev => ({ ...prev, sheets: sheetsConfig }));
            onUpdate({ sheets: sheetsConfig });
          }}
        />

        <div className="my-4 border-t border-foreground/10" />

        {/* Docs OAuth Panel */}
        <DocsOAuthPanel
          config={formData.docs || DEFAULT_DOCS_CONFIG}
          onConfigChange={(docsConfig: DocsOAuthConfig) => {
            setFormData(prev => ({ ...prev, docs: docsConfig }));
            onUpdate({ docs: docsConfig });
          }}
        />

        <div className="my-4 border-t border-foreground/10" />

        {/* Slack OAuth Panel */}
        <SlackOAuthPanel
          config={formData.slack || DEFAULT_SLACK_CONFIG}
          onConfigChange={(slackConfig: SlackOAuthConfig) => {
            setFormData(prev => ({ ...prev, slack: slackConfig }));
            onUpdate({ slack: slackConfig });
          }}
        />
      </section>

      {/* Cost Info */}
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-green-600">💰</span>
          <div>
            <p className="text-xs text-green-700 font-medium">Zero Runtime Cost</p>
            <p className="text-xs text-green-600 mt-1">
              Rules run locally without AI calls. Only rule generation uses AI (~$0.01 one-time).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
