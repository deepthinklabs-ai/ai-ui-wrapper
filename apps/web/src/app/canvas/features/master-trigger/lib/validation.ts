/**
 * Master Genesis Bot Trigger - Validation Utilities
 *
 * Validation functions for Master Trigger configuration and inputs.
 */

import type { MasterTriggerNodeConfig } from '@/app/canvas/types';
import type { MasterTriggerInput, TriggerValidationResult } from '../types';

/**
 * Validate Master Trigger node configuration
 */
export function validateTriggerConfig(
  config: Partial<MasterTriggerNodeConfig>
): TriggerValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: display_name
  if (!config.display_name || config.display_name.trim().length === 0) {
    errors.push('Display name is required');
  } else if (config.display_name.length > 100) {
    errors.push('Display name must be 100 characters or less');
  }

  // Optional: description length check
  if (config.description && config.description.length > 500) {
    warnings.push('Description is very long. Consider shortening for better UX.');
  }

  // Required: is_exposed must be explicitly set
  if (typeof config.is_exposed !== 'boolean') {
    errors.push('Exposure status must be set');
  }

  // Required: output_format
  if (!config.output_format) {
    errors.push('Output format is required');
  } else if (!['raw', 'structured'].includes(config.output_format)) {
    errors.push('Output format must be "raw" or "structured"');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate input from Genesis Bot page
 */
export function validateTriggerInput(
  input: Partial<MasterTriggerInput>
): TriggerValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required: message
  if (!input.message || input.message.trim().length === 0) {
    errors.push('Message is required');
  } else if (input.message.length > 10000) {
    errors.push('Message exceeds maximum length of 10,000 characters');
  }

  // Required: userId
  if (!input.userId) {
    errors.push('User ID is required');
  }

  // Required: timestamp
  if (!input.timestamp) {
    errors.push('Timestamp is required');
  }

  // Optional: attachments validation
  if (input.attachments && input.attachments.length > 0) {
    // Check attachment count
    if (input.attachments.length > 10) {
      errors.push('Maximum 10 attachments allowed');
    }

    // Validate each attachment
    input.attachments.forEach((attachment, index) => {
      if (!attachment.name) {
        errors.push(`Attachment ${index + 1}: Name is required`);
      }
      if (!attachment.type) {
        errors.push(`Attachment ${index + 1}: MIME type is required`);
      }
      if (!attachment.content) {
        errors.push(`Attachment ${index + 1}: Content is required`);
      }
      // Check for very large attachments (> 10MB base64)
      if (attachment.content && attachment.content.length > 14000000) {
        warnings.push(`Attachment ${index + 1}: File is very large, may slow down processing`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize input message (remove potential XSS, etc.)
 */
export function sanitizeMessage(message: string): string {
  // Remove script tags
  let sanitized = message.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replace(/\bon\w+\s*=/gi, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Check if a node can be connected to a Master Trigger
 * (Must be a Genesis Bot node)
 */
export function canConnectToTrigger(nodeType: string): boolean {
  return nodeType === 'GENESIS_BOT';
}

/**
 * Default configuration for a new Master Trigger node
 */
export function getDefaultTriggerConfig(): MasterTriggerNodeConfig {
  return {
    display_name: 'New Workflow Trigger',
    description: '',
    is_exposed: false,
    output_format: 'structured',
    allowed_user_ids: undefined,
    last_triggered_at: undefined,
    trigger_count: 0,
  };
}
