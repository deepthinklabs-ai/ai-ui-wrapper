/**
 * SSM Rules Engine
 *
 * Pure pattern-matching engine that processes events against rules.
 * NO LLM calls - runs at $0 cost.
 *
 * Features:
 * - Keyword matching (case-sensitive/insensitive)
 * - Regex pattern matching
 * - Field-based condition evaluation
 * - Response template interpolation
 */

import RE2 from 're2';
import type {
  SSMRulesConfig,
  SSMKeywordRule,
  SSMPatternRule,
  SSMConditionRule,
  SSMResponseTemplate,
  SSMEvent,
  SSMMatchResult,
  SSMAlert,
  SSMAlertSeverity,
} from '../../../types/ssm';

// ============================================================================
// MAIN MATCHING FUNCTION
// ============================================================================

/**
 * Match an event against all rules
 *
 * Supports two logic modes:
 * - 'any' (OR): Alert if ANY rule matches (default)
 * - 'all' (AND): Alert only if ALL enabled rules match
 */
export function matchEvent(
  event: SSMEvent,
  rules: SSMRulesConfig
): SSMMatchResult {
  const matchedRules: SSMMatchResult['matched_rules'] = [];
  let highestSeverity: SSMAlertSeverity | null = null;

  const severityOrder: Record<SSMAlertSeverity, number> = {
    info: 1,
    warning: 2,
    critical: 3,
  };

  // Count total enabled rules for AND logic
  const enabledKeywords = rules.keywords.filter(r => r.enabled);
  const enabledPatterns = rules.patterns.filter(r => r.enabled);
  const enabledConditions = rules.conditions.filter(r => r.enabled);
  const totalEnabledRules = enabledKeywords.length + enabledPatterns.length + enabledConditions.length;

  // Check keyword rules
  for (const rule of enabledKeywords) {
    if (matchKeyword(event.content, rule)) {
      matchedRules.push({
        type: 'keyword',
        rule_id: rule.id,
        rule_name: rule.keyword,
      });

      if (!highestSeverity || severityOrder[rule.severity] > severityOrder[highestSeverity]) {
        highestSeverity = rule.severity;
      }
    }
  }

  // Check pattern rules
  for (const rule of enabledPatterns) {
    if (matchPattern(event.content, rule)) {
      matchedRules.push({
        type: 'pattern',
        rule_id: rule.id,
        rule_name: rule.name,
      });

      if (!highestSeverity || severityOrder[rule.severity] > severityOrder[highestSeverity]) {
        highestSeverity = rule.severity;
      }
    }
  }

  // Check condition rules
  for (const rule of enabledConditions) {
    if (matchCondition(event, rule)) {
      matchedRules.push({
        type: 'condition',
        rule_id: rule.id,
        rule_name: `${rule.field} ${rule.operator} ${rule.value}`,
      });

      if (!highestSeverity || severityOrder[rule.severity] > severityOrder[highestSeverity]) {
        highestSeverity = rule.severity;
      }
    }
  }

  // Determine if matched based on logic mode
  const logicMode = rules.logic || 'any';
  let isMatched: boolean;

  if (logicMode === 'all') {
    // AND logic: ALL enabled rules must match
    isMatched = totalEnabledRules > 0 && matchedRules.length === totalEnabledRules;
  } else {
    // OR logic (default): ANY rule match is sufficient
    isMatched = matchedRules.length > 0;
  }

  return {
    matched: isMatched,
    severity: isMatched ? highestSeverity : null,
    matched_rules: matchedRules,
  };
}

// ============================================================================
// INDIVIDUAL MATCHERS
// ============================================================================

/**
 * Match content against a keyword rule
 */
function matchKeyword(content: string, rule: SSMKeywordRule): boolean {
  if (rule.caseSensitive) {
    return content.includes(rule.keyword);
  }
  return content.toLowerCase().includes(rule.keyword.toLowerCase());
}

/**
 * Create a safe regex using RE2 (immune to ReDoS attacks)
 * RE2 uses a linear-time matching algorithm
 */
function createSafeRegex(pattern: string): RE2 | null {
  // Limit pattern length for safety
  if (pattern.length > 500) {
    console.error('[SSM Rules] Pattern rejected: too long');
    return null;
  }

  try {
    // RE2 is immune to ReDoS - uses linear-time matching
    return new RE2(pattern, 'i');
  } catch (error) {
    console.error('[SSM Rules] Invalid regex pattern', { error });
    return null;
  }
}

/**
 * Match content against a pattern rule (regex)
 * Uses RE2 for safe regex matching (immune to ReDoS)
 */
function matchPattern(content: string, rule: SSMPatternRule): boolean {
  const regex = createSafeRegex(rule.pattern);
  if (!regex) {
    return false;
  }
  return regex.test(content);
}

/**
 * Extract email address from RFC 5322 format
 * e.g., '"Display Name" <email@example.com>' -> 'email@example.com'
 */
function extractEmailAddress(value: string): string {
  // Try to extract email from angle brackets: "Name" <email@example.com>
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch) {
    return angleMatch[1].toLowerCase();
  }
  // If no angle brackets, return as-is (might already be just the email)
  return value.toLowerCase().trim();
}

/**
 * Match event against a condition rule
 */
function matchCondition(event: SSMEvent, rule: SSMConditionRule): boolean {
  // Get the field value from event
  let fieldValue: string | number | undefined;

  // Check standard fields
  if (rule.field === 'content') {
    fieldValue = event.content;
  } else if (rule.field === 'source') {
    fieldValue = event.source;
  } else if (rule.field === 'type') {
    fieldValue = event.type;
  } else if (event.metadata && rule.field in event.metadata) {
    fieldValue = String(event.metadata[rule.field]);
  }

  if (fieldValue === undefined) {
    return false;
  }

  let strValue = String(fieldValue);
  const ruleValue = rule.value;

  // For email-related fields, extract the actual email address
  if (rule.field === 'from' || rule.field === 'to' || rule.field === 'sender') {
    strValue = extractEmailAddress(strValue);
  }

  switch (rule.operator) {
    case 'equals':
    case '==':
    case '===':
      return strValue.toLowerCase() === ruleValue.toLowerCase();

    case 'contains':
    case 'includes':
      return strValue.toLowerCase().includes(ruleValue.toLowerCase());

    case 'startsWith':
      return strValue.toLowerCase().startsWith(ruleValue.toLowerCase());

    case 'endsWith':
      return strValue.toLowerCase().endsWith(ruleValue.toLowerCase());

    case 'greaterThan':
      return parseFloat(strValue) > parseFloat(ruleValue);

    case 'lessThan':
      return parseFloat(strValue) < parseFloat(ruleValue);

    case 'matches': {
      // Use RE2 for safe regex matching (immune to ReDoS)
      const regex = createSafeRegex(ruleValue);
      if (!regex) {
        return false;
      }
      return regex.test(strValue);
    }

    default:
      return false;
  }
}

// ============================================================================
// ALERT GENERATION
// ============================================================================

/**
 * Generate an alert from a match result using response templates
 */
export function generateAlert(
  event: SSMEvent,
  matchResult: SSMMatchResult,
  templates: SSMResponseTemplate[],
  nodeId: string
): SSMAlert | null {
  if (!matchResult.matched || !matchResult.severity) {
    return null;
  }

  // Find the template for this severity
  const template = templates.find(t => t.severity === matchResult.severity);
  if (!template) {
    return null;
  }

  // Build context for template interpolation
  const context: Record<string, string> = {
    sender: event.metadata?.sender as string || event.source || 'Unknown',
    subject: event.metadata?.subject as string || event.type || 'No subject',
    content_preview: event.content.substring(0, 100) + (event.content.length > 100 ? '...' : ''),
    matched_rule: matchResult.matched_rules[0]?.rule_name || 'Unknown rule',
    matched_keywords: matchResult.matched_rules.map(r => r.rule_name).join(', '),
    timestamp: event.timestamp,
  };

  // Interpolate templates
  const title = interpolateTemplate(template.title, context);
  const message = interpolateTemplate(template.message, context);

  return {
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    severity: matchResult.severity,
    title,
    message,
    event_id: event.id,
    matched_rules: matchResult.matched_rules.map(r => r.rule_id),
    timestamp: new Date().toISOString(),
    acknowledged: false,
    source_node_id: nodeId,
    forwarded_to_ai: template.action === 'forward_to_ai',
  };
}

/**
 * Interpolate template placeholders with actual values
 */
function interpolateTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return context[key] || match;
  });
}

// ============================================================================
// RULE VALIDATION
// ============================================================================

/**
 * Validate a regex pattern
 */
export function validateRegexPattern(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid regex pattern',
    };
  }
}

/**
 * Test rules against sample content
 */
export function testRules(
  content: string,
  rules: SSMRulesConfig
): SSMMatchResult {
  const testEvent: SSMEvent = {
    id: 'test_event',
    timestamp: new Date().toISOString(),
    source: 'test',
    type: 'test',
    content,
  };

  return matchEvent(testEvent, rules);
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get rule statistics
 */
export function getRuleStats(rules: SSMRulesConfig): {
  total: number;
  enabled: number;
  bySeverity: Record<SSMAlertSeverity, number>;
} {
  const allRules = [
    ...rules.keywords,
    ...rules.patterns,
    ...rules.conditions,
  ];

  const enabled = allRules.filter(r => r.enabled).length;

  const bySeverity: Record<SSMAlertSeverity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
  };

  for (const rule of allRules) {
    if (rule.enabled) {
      bySeverity[rule.severity]++;
    }
  }

  return {
    total: allRules.length,
    enabled,
    bySeverity,
  };
}
