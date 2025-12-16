/**
 * Chatbot File Utilities
 *
 * Functions for serializing, deserializing, and validating .chatbot files.
 */

import type { Chatbot } from "@/types/chatbot";
import type {
  ChatbotFile,
  ChatbotFileConfig,
  ChatbotFileValidationResult,
  ChatbotExportOptions,
  CHATBOT_FILE_VERSION,
  CHATBOT_FILE_EXTENSION,
} from "@/types/chatbotFile";

export const CURRENT_CHATBOT_FILE_VERSION = "1.0.0";
export const CHATBOT_FILE_EXT = ".chatbot";
export const CHATBOT_FILE_MIME = "application/json";

/**
 * Serialize a Chatbot to a ChatbotFile format for export
 */
export function serializeChatbot(
  chatbot: Chatbot,
  options: ChatbotExportOptions = {}
): ChatbotFile {
  const now = new Date().toISOString();

  const config: ChatbotFileConfig = {
    model: chatbot.config.model,
    system_prompt: chatbot.config.system_prompt,
    features: chatbot.config.features,
    step_by_step_with_explanation: chatbot.config.step_by_step_with_explanation,
    step_by_step_no_explanation: chatbot.config.step_by_step_no_explanation,
  };

  // Include optional fields based on options
  if (options.includeOAuthRequirements !== false && chatbot.config.oauth_requirements) {
    config.oauth_requirements = chatbot.config.oauth_requirements;
  }

  if (options.includeAllowedTools !== false && chatbot.config.allowed_tools) {
    config.allowed_tools = chatbot.config.allowed_tools;
  }

  if (options.includeVoiceId !== false && chatbot.config.voice_id) {
    config.voice_id = chatbot.config.voice_id;
  }

  return {
    version: CURRENT_CHATBOT_FILE_VERSION,
    type: "chatbot",
    metadata: {
      name: chatbot.name,
      description: chatbot.description || undefined,
      created_at: chatbot.created_at,
      exported_at: now,
      created_by: options.createdBy,
    },
    config,
  };
}

/**
 * Validate a ChatbotFile structure
 */
export function validateChatbotFile(data: unknown): ChatbotFileValidationResult {
  // Check if it's an object
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      error: "Invalid file format: expected JSON object",
    };
  }

  const file = data as Record<string, unknown>;

  // Check version
  if (typeof file.version !== "string") {
    return {
      valid: false,
      error: "Invalid file format: missing version",
    };
  }

  // Check type
  if (file.type !== "chatbot") {
    return {
      valid: false,
      error: `Invalid file type: expected "chatbot", got "${file.type}"`,
    };
  }

  // Check metadata
  if (!file.metadata || typeof file.metadata !== "object") {
    return {
      valid: false,
      error: "Invalid file format: missing metadata",
    };
  }

  const metadata = file.metadata as Record<string, unknown>;
  if (typeof metadata.name !== "string" || !metadata.name) {
    return {
      valid: false,
      error: "Invalid file format: missing chatbot name",
    };
  }

  // Check config
  if (!file.config || typeof file.config !== "object") {
    return {
      valid: false,
      error: "Invalid file format: missing config",
    };
  }

  const config = file.config as Record<string, unknown>;

  // Check model
  if (!config.model || typeof config.model !== "object") {
    return {
      valid: false,
      error: "Invalid file format: missing model configuration",
    };
  }

  const model = config.model as Record<string, unknown>;
  if (typeof model.provider !== "string") {
    return {
      valid: false,
      error: "Invalid file format: missing model provider",
    };
  }

  if (typeof model.model_name !== "string") {
    return {
      valid: false,
      error: "Invalid file format: missing model name",
    };
  }

  // Check system_prompt
  if (typeof config.system_prompt !== "string") {
    return {
      valid: false,
      error: "Invalid file format: missing system prompt",
    };
  }

  // All validations passed
  return {
    valid: true,
    data: data as ChatbotFile,
  };
}

/**
 * Parse a JSON string and validate it as a ChatbotFile
 */
export function parseChatbotFile(jsonString: string): ChatbotFileValidationResult {
  try {
    const parsed = JSON.parse(jsonString);
    return validateChatbotFile(parsed);
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to parse JSON: ${err.message}`,
    };
  }
}

/**
 * Generate a filename for exporting a chatbot
 */
export function generateChatbotFilename(chatbotName: string): string {
  // Sanitize the name for use in filename
  const sanitized = chatbotName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  return `${sanitized || "chatbot"}${CHATBOT_FILE_EXT}`;
}

/**
 * Convert a ChatbotFile to JSON string for export
 */
export function stringifyChatbotFile(file: ChatbotFile): string {
  return JSON.stringify(file, null, 2);
}

/**
 * Create a download blob from a ChatbotFile
 */
export function createChatbotFileBlob(file: ChatbotFile): Blob {
  const jsonString = stringifyChatbotFile(file);
  return new Blob([jsonString], { type: CHATBOT_FILE_MIME });
}

/**
 * Trigger a download of a ChatbotFile
 */
export function downloadChatbotFile(file: ChatbotFile, filename?: string): void {
  const blob = createChatbotFileBlob(file);
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename || generateChatbotFilename(file.metadata.name);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Create default chatbot config with sensible defaults
 */
export function createDefaultChatbotConfig(): ChatbotFileConfig {
  return {
    model: {
      provider: "openai",
      model_name: "gpt-4o",
      temperature: 0.7,
      streaming_enabled: true,
      web_search_enabled: false,
    },
    system_prompt: "You are a helpful AI assistant.",
    features: {},
    oauth_requirements: {},
    step_by_step_with_explanation: false,
    step_by_step_no_explanation: false,
  };
}

/**
 * Merge imported config with defaults to ensure all fields are present
 */
export function mergeWithDefaults(importedConfig: Partial<ChatbotFileConfig>): ChatbotFileConfig {
  const defaults = createDefaultChatbotConfig();

  return {
    model: {
      ...defaults.model,
      ...importedConfig.model,
    },
    system_prompt: importedConfig.system_prompt ?? defaults.system_prompt,
    features: importedConfig.features ?? defaults.features,
    oauth_requirements: importedConfig.oauth_requirements ?? defaults.oauth_requirements,
    allowed_tools: importedConfig.allowed_tools,
    voice_id: importedConfig.voice_id,
    step_by_step_with_explanation: importedConfig.step_by_step_with_explanation ?? defaults.step_by_step_with_explanation,
    step_by_step_no_explanation: importedConfig.step_by_step_no_explanation ?? defaults.step_by_step_no_explanation,
  };
}
