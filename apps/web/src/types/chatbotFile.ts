/**
 * Chatbot File Format Types
 *
 * Defines the .chatbot file format for exporting and importing chatbot configurations.
 * This format captures the complete chatbot settings including model, system prompt,
 * canvas connections, and OAuth requirements.
 */

import type { AIModel } from '@/lib/apiKeyStorage';

/**
 * Version of the .chatbot file format
 * Increment when making breaking changes to the format
 */
export const CHATBOT_FILE_VERSION = '1.0.0';

/**
 * File extension for chatbot files
 */
export const CHATBOT_FILE_EXTENSION = '.chatbot';

/**
 * MIME type for chatbot files (custom JSON-based format)
 */
export const CHATBOT_FILE_MIME_TYPE = 'application/json';

/**
 * Supported AI model providers
 */
export type ChatbotFileProvider = 'openai' | 'claude' | 'grok' | 'gemini';

/**
 * Model configuration in a .chatbot file
 */
export type ChatbotFileModelConfig = {
  /** AI provider */
  provider: ChatbotFileProvider;
  /** Specific model name */
  model_name: AIModel;
  /** Temperature setting (0-1) */
  temperature?: number;
  /** Maximum tokens for response */
  max_tokens?: number;
  /** Whether streaming is enabled */
  streaming_enabled?: boolean;
  /** Whether web search is enabled */
  web_search_enabled?: boolean;
};

/**
 * OAuth requirements for the chatbot
 * Indicates which OAuth connections are needed for the canvas workflows
 */
export type ChatbotFileOAuthRequirements = {
  gmail?: boolean;
  calendar?: boolean;
  sheets?: boolean;
  docs?: boolean;
  slack?: boolean;
};

/**
 * User info for file metadata
 */
export type ChatbotFileUserInfo = {
  /** User's display name or email */
  name: string;
  /** User's email (optional, may be hidden for privacy) */
  email?: string;
};

/**
 * Metadata about the chatbot
 */
export type ChatbotFileMetadata = {
  /** Chatbot name */
  name: string;
  /** Description of the chatbot */
  description?: string;
  /** When this chatbot was originally created */
  created_at: string;
  /** When this file was exported */
  exported_at: string;
  /** User who created the chatbot */
  created_by?: ChatbotFileUserInfo;
};

/**
 * Canvas reference - indicates if a canvas is linked
 */
export type ChatbotFileCanvasReference = {
  /** Original canvas ID (for reference, may not exist in importing user's account) */
  canvas_id?: string;
  /** Name of the linked canvas */
  canvas_name?: string;
  /** Whether the canvas file is included in a bundle */
  included_canvas?: boolean;
};

/**
 * The chatbot configuration
 */
export type ChatbotFileConfig = {
  /** Model settings */
  model: ChatbotFileModelConfig;
  /** System prompt that defines the chatbot's behavior */
  system_prompt: string;
  /** OAuth requirements for canvas workflows */
  oauth_requirements?: ChatbotFileOAuthRequirements;
  /** Allowed MCP tools */
  allowed_tools?: string[];
  /** Voice ID for TTS (if using voice output) */
  voice_id?: string;
  /** Step-by-step mode settings */
  step_by_step_with_explanation?: boolean;
  step_by_step_no_explanation?: boolean;
};

/**
 * The complete .chatbot file structure
 */
export type ChatbotFile = {
  /** File format version for compatibility checking */
  version: string;
  /** File type identifier */
  type: 'chatbot';
  /** Chatbot metadata */
  metadata: ChatbotFileMetadata;
  /** Chatbot configuration */
  config: ChatbotFileConfig;
  /** Reference to linked canvas (if any) */
  canvas_reference?: ChatbotFileCanvasReference;
};

/**
 * Result of validating a chatbot file
 */
export type ChatbotFileValidationResult = {
  valid: boolean;
  error?: string;
  data?: ChatbotFile;
};

/**
 * Options for exporting a chatbot
 */
export type ChatbotExportOptions = {
  /** Whether to include OAuth requirements */
  includeOAuthRequirements?: boolean;
  /** Whether to include allowed tools list */
  includeAllowedTools?: boolean;
  /** Whether to include voice ID */
  includeVoiceId?: boolean;
  /** User info for the person exporting the file */
  exportedBy?: ChatbotFileUserInfo;
  /** User info for the person who created the chatbot */
  createdBy?: ChatbotFileUserInfo;
};

/**
 * Result of importing a chatbot
 */
export type ChatbotImportResult = {
  success: boolean;
  error?: string;
  /** Whether OAuth connections are required */
  requiresOAuth?: boolean;
  /** List of required OAuth providers */
  requiredOAuthProviders?: string[];
};
