/**
 * Chatbot File Utilities
 *
 * Functions for exporting and importing .chatbot files.
 * Handles serialization, validation, and file operations.
 */

import type {
  ChatbotFile,
  ChatbotFileMetadata,
  ChatbotFileConfig,
  ChatbotFileModelConfig,
  ChatbotFileOAuthRequirements,
  ChatbotFileCanvasReference,
  ChatbotFileValidationResult,
  ChatbotExportOptions,
  ChatbotFileUserInfo,
} from '@/types/chatbotFile';
import {
  CHATBOT_FILE_VERSION,
  CHATBOT_FILE_EXTENSION,
} from '@/types/chatbotFile';
import type { AIModel } from '@/lib/apiKeyStorage';
import {
  validateImportFileExtension,
  validateImportFileSize,
  preParseJsonCheck,
  sanitizeImportData,
} from '@/lib/importFileSecurity';

/**
 * Default export options
 */
const DEFAULT_EXPORT_OPTIONS: ChatbotExportOptions = {
  includeOAuthRequirements: true,
  includeAllowedTools: true,
  includeVoiceId: true,
};

/**
 * Determine the provider from the model name
 */
export function getProviderFromModel(model: AIModel): 'openai' | 'claude' | 'grok' | 'gemini' {
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
    return 'openai';
  }
  if (model.startsWith('claude-')) {
    return 'claude';
  }
  if (model.startsWith('grok-')) {
    return 'grok';
  }
  if (model.startsWith('gemini-')) {
    return 'gemini';
  }
  // Default to openai if unknown
  return 'openai';
}

/**
 * Create a ChatbotFile from chatbot configuration
 */
export function createChatbotFile(
  name: string,
  config: {
    model: AIModel;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    streamingEnabled?: boolean;
    webSearchEnabled?: boolean;
    stepByStepWithExplanation?: boolean;
    stepByStepNoExplanation?: boolean;
    allowedTools?: string[];
    voiceId?: string;
    oauthRequirements?: ChatbotFileOAuthRequirements;
  },
  canvasReference?: ChatbotFileCanvasReference,
  options: ChatbotExportOptions = DEFAULT_EXPORT_OPTIONS
): ChatbotFile {
  const metadata: ChatbotFileMetadata = {
    name,
    created_at: new Date().toISOString(),
    exported_at: new Date().toISOString(),
  };

  // Add user info if provided
  if (options.createdBy) {
    metadata.created_by = options.createdBy;
  }

  const modelConfig: ChatbotFileModelConfig = {
    provider: getProviderFromModel(config.model),
    model_name: config.model,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    streaming_enabled: config.streamingEnabled,
    web_search_enabled: config.webSearchEnabled,
  };

  const chatbotConfig: ChatbotFileConfig = {
    model: modelConfig,
    system_prompt: config.systemPrompt,
    step_by_step_with_explanation: config.stepByStepWithExplanation,
    step_by_step_no_explanation: config.stepByStepNoExplanation,
  };

  // Conditionally include optional fields
  if (options.includeOAuthRequirements && config.oauthRequirements) {
    chatbotConfig.oauth_requirements = config.oauthRequirements;
  }

  if (options.includeAllowedTools && config.allowedTools) {
    chatbotConfig.allowed_tools = config.allowedTools;
  }

  if (options.includeVoiceId && config.voiceId) {
    chatbotConfig.voice_id = config.voiceId;
  }

  const chatbotFile: ChatbotFile = {
    version: CHATBOT_FILE_VERSION,
    type: 'chatbot',
    metadata,
    config: chatbotConfig,
  };

  // Add canvas reference if provided
  if (canvasReference) {
    chatbotFile.canvas_reference = canvasReference;
  }

  return chatbotFile;
}

/**
 * Serialize a ChatbotFile to JSON string
 */
export function serializeChatbotFile(chatbotFile: ChatbotFile): string {
  return JSON.stringify(chatbotFile, null, 2);
}

/**
 * Generate a filename for the chatbot export
 */
export function generateChatbotFilename(name: string): string {
  // Sanitize the name for use as a filename
  const sanitized = name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_')         // Replace spaces with underscores
    .substring(0, 50);             // Limit length

  // Add timestamp for uniqueness
  const timestamp = new Date().toISOString().split('T')[0];

  return `${sanitized}_${timestamp}${CHATBOT_FILE_EXTENSION}`;
}

/**
 * Trigger a file download in the browser
 */
export function downloadChatbotFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Validate a parsed chatbot file
 */
export function validateChatbotFile(data: unknown): ChatbotFileValidationResult {
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file format: not a valid JSON object' };
  }

  const file = data as Record<string, unknown>;

  // Check required fields
  if (file.type !== 'chatbot') {
    return { valid: false, error: 'Invalid file type: expected "chatbot"' };
  }

  if (typeof file.version !== 'string') {
    return { valid: false, error: 'Missing or invalid version field' };
  }

  // Check version compatibility
  const [major] = file.version.split('.');
  const [currentMajor] = CHATBOT_FILE_VERSION.split('.');
  if (major !== currentMajor) {
    return {
      valid: false,
      error: `Incompatible file version: ${file.version}. Expected major version ${currentMajor}`
    };
  }

  // Check metadata
  if (!file.metadata || typeof file.metadata !== 'object') {
    return { valid: false, error: 'Missing or invalid metadata' };
  }

  const metadata = file.metadata as Record<string, unknown>;
  if (typeof metadata.name !== 'string') {
    return { valid: false, error: 'Missing or invalid metadata.name' };
  }

  // Check config
  if (!file.config || typeof file.config !== 'object') {
    return { valid: false, error: 'Missing or invalid config' };
  }

  const config = file.config as Record<string, unknown>;

  // Check model config
  if (!config.model || typeof config.model !== 'object') {
    return { valid: false, error: 'Missing or invalid config.model' };
  }

  const modelConfig = config.model as Record<string, unknown>;
  if (typeof modelConfig.provider !== 'string') {
    return { valid: false, error: 'Missing or invalid config.model.provider' };
  }

  if (typeof modelConfig.model_name !== 'string') {
    return { valid: false, error: 'Missing or invalid config.model.model_name' };
  }

  // Check system prompt
  if (typeof config.system_prompt !== 'string') {
    return { valid: false, error: 'Missing or invalid config.system_prompt' };
  }

  return { valid: true, data: file as unknown as ChatbotFile };
}

/**
 * Parse and validate a chatbot file from a string
 * Includes pre-parse security checks and content sanitization
 */
export function parseChatbotFile(content: string): ChatbotFileValidationResult {
  try {
    // Pre-parse security check
    const preParseResult = preParseJsonCheck(content);
    if (!preParseResult.valid) {
      return { valid: false, error: preParseResult.error };
    }

    // Parse JSON
    const data = JSON.parse(content);

    // Validate structure first
    const validationResult = validateChatbotFile(data);
    if (!validationResult.valid) {
      return validationResult;
    }

    // Sanitize content to remove potential XSS
    const { sanitized } = sanitizeImportData(data);

    return { valid: true, data: sanitized as unknown as ChatbotFile };
  } catch (err) {
    return { valid: false, error: 'Invalid JSON format' };
  }
}

/**
 * Read a File object and parse it as a chatbot file
 * Includes security validation for extension and size
 */
export async function readChatbotFile(file: File): Promise<ChatbotFileValidationResult> {
  // Security validation: Check file extension
  const extCheck = validateImportFileExtension(file.name, 'chatbot');
  if (!extCheck.valid) {
    return { valid: false, error: extCheck.error };
  }

  // Security validation: Check file size
  const sizeCheck = validateImportFileSize(file);
  if (!sizeCheck.valid) {
    return { valid: false, error: sizeCheck.error };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') {
        resolve({ valid: false, error: 'Failed to read file content' });
        return;
      }
      resolve(parseChatbotFile(content));
    };

    reader.onerror = () => {
      resolve({ valid: false, error: 'Failed to read file' });
    };

    reader.readAsText(file);
  });
}

/**
 * Extract OAuth requirements from a chatbot file
 */
export function getOAuthRequirements(chatbotFile: ChatbotFile): string[] {
  const requirements: string[] = [];
  const oauthReqs = chatbotFile.config.oauth_requirements;

  if (oauthReqs) {
    if (oauthReqs.gmail) requirements.push('gmail');
    if (oauthReqs.calendar) requirements.push('calendar');
    if (oauthReqs.sheets) requirements.push('sheets');
    if (oauthReqs.docs) requirements.push('docs');
    if (oauthReqs.slack) requirements.push('slack');
  }

  return requirements;
}
