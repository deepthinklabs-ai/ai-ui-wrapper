/**
 * Feature Toggle System Types
 *
 * Defines all available features that users can enable/disable in their chatbot.
 */

export type FeatureId =
  // Message Actions
  | 'revert'
  | 'revert_with_draft'
  | 'fork_thread'

  // Thread Operations
  | 'summarize_thread'
  | 'summarize_and_continue'

  // Context Panel
  | 'context_panel'

  // Text Selection
  | 'text_selection_popup'

  // Text Conversion
  | 'convert_to_markdown'
  | 'convert_to_json'

  // Step by Step
  | 'step_by_step_mode'

  // Voice Input
  | 'voice_input'
  | 'auto_voice_detection'

  // File Attachments
  | 'file_attachments'

  // Model Selection
  | 'model_selection'

  // Context Window Indicator
  | 'context_window_indicator';

export type FeatureCategory =
  | 'message_actions'
  | 'thread_operations'
  | 'input_enhancements'
  | 'ai_controls'
  | 'advanced_features';

export interface FeatureDefinition {
  id: FeatureId;
  name: string;
  description: string;
  category: FeatureCategory;
  defaultEnabled: boolean;
  icon?: string;
  requiresPro?: boolean;
}

export interface UserFeaturePreferences {
  userId: string;
  features: Record<FeatureId, boolean>;
  updatedAt: string;
}

/**
 * All available features with their metadata
 */
export const FEATURE_DEFINITIONS: Record<FeatureId, FeatureDefinition> = {
  // Message Actions
  revert: {
    id: 'revert',
    name: 'Revert to Point',
    description: 'Delete messages from a specific point forward with undo capability',
    category: 'message_actions',
    defaultEnabled: true,
    icon: '↩️',
  },
  revert_with_draft: {
    id: 'revert_with_draft',
    name: 'Revert with Draft',
    description: 'Revert and pre-populate composer with the deleted message',
    category: 'message_actions',
    defaultEnabled: true,
    icon: '✏️',
  },
  fork_thread: {
    id: 'fork_thread',
    name: 'Fork Thread',
    description: 'Create a new thread from any message point',
    category: 'thread_operations',
    defaultEnabled: true,
    icon: '🔱',
  },

  // Thread Operations
  summarize_thread: {
    id: 'summarize_thread',
    name: 'Summarize Thread',
    description: 'Generate a summary of the entire conversation',
    category: 'thread_operations',
    defaultEnabled: true,
    icon: '📝',
  },
  summarize_and_continue: {
    id: 'summarize_and_continue',
    name: 'Summarize & Continue',
    description: 'Create new thread with summary as context',
    category: 'thread_operations',
    defaultEnabled: true,
    icon: '🔄',
  },

  // Context Panel
  context_panel: {
    id: 'context_panel',
    name: 'Context Panel',
    description: 'Side panel for asking questions about selected text',
    category: 'advanced_features',
    defaultEnabled: true,
    icon: '📋',
  },

  // Text Selection
  text_selection_popup: {
    id: 'text_selection_popup',
    name: 'Text Selection Actions',
    description: 'Show action popup when selecting text in messages',
    category: 'advanced_features',
    defaultEnabled: true,
    icon: '🔍',
  },

  // Text Conversion
  convert_to_markdown: {
    id: 'convert_to_markdown',
    name: 'Convert to Markdown',
    description: 'Convert selected text to Markdown format',
    category: 'advanced_features',
    defaultEnabled: true,
    icon: '📄',
  },
  convert_to_json: {
    id: 'convert_to_json',
    name: 'Convert to JSON',
    description: 'Convert selected text to JSON format',
    category: 'advanced_features',
    defaultEnabled: true,
    icon: '{ }',
  },

  // Step by Step
  step_by_step_mode: {
    id: 'step_by_step_mode',
    name: 'Step-by-Step Mode',
    description: 'AI responds one step at a time with explanations',
    category: 'ai_controls',
    defaultEnabled: true,
    icon: '👣',
  },

  // Voice Input
  voice_input: {
    id: 'voice_input',
    name: 'Voice Input',
    description: 'Use microphone for voice-to-text input',
    category: 'input_enhancements',
    defaultEnabled: true,
    icon: '🎤',
  },
  auto_voice_detection: {
    id: 'auto_voice_detection',
    name: 'Auto Voice Detection',
    description: 'Automatically activate microphone when you start speaking. Say "send" to submit.',
    category: 'input_enhancements',
    defaultEnabled: false,
    icon: '🔊',
  },

  // File Attachments
  file_attachments: {
    id: 'file_attachments',
    name: 'File Attachments',
    description: 'Upload files and images to messages',
    category: 'input_enhancements',
    defaultEnabled: true,
    icon: '📎',
  },

  // Model Selection
  model_selection: {
    id: 'model_selection',
    name: 'Model Selection',
    description: 'Choose which AI model to use for responses',
    category: 'ai_controls',
    defaultEnabled: true,
    icon: '🤖',
  },

  // Context Window Indicator
  context_window_indicator: {
    id: 'context_window_indicator',
    name: 'Context Window Indicator',
    description: 'Show token usage and context window statistics',
    category: 'ai_controls',
    defaultEnabled: true,
    icon: '📊',
  },
};

export const FEATURE_CATEGORIES: Record<FeatureCategory, { name: string; description: string }> = {
  message_actions: {
    name: 'Message Actions',
    description: 'Actions you can perform on individual messages',
  },
  thread_operations: {
    name: 'Thread Operations',
    description: 'Operations that affect the entire conversation thread',
  },
  input_enhancements: {
    name: 'Input Enhancements',
    description: 'Features that enhance how you input messages',
  },
  ai_controls: {
    name: 'AI Controls',
    description: 'Controls for customizing AI behavior and display',
  },
  advanced_features: {
    name: 'Advanced Features',
    description: 'Advanced functionality for power users',
  },
};
