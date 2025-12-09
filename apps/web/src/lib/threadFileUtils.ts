/**
 * Thread File Utilities
 *
 * Functions for exporting and importing .thread files.
 * Handles serialization, validation, and file operations.
 */

import type { Thread, Message } from '@/types/chat';
import type {
  ThreadFile,
  ThreadFileMessage,
  ThreadFileMetadata,
  ThreadFileValidationResult,
  ThreadExportOptions,
} from '@/types/threadFile';
import {
  THREAD_FILE_VERSION,
  THREAD_FILE_EXTENSION,
} from '@/types/threadFile';

/**
 * Default export options
 */
const DEFAULT_EXPORT_OPTIONS: ThreadExportOptions = {
  includeTokenUsage: true,
  includeToolCalls: true,
  includeCitations: true,
  includeAttachments: true,
};

/**
 * Convert a database Message to a ThreadFileMessage
 */
export function messageToThreadFileMessage(
  message: Message,
  options: ThreadExportOptions = DEFAULT_EXPORT_OPTIONS
): ThreadFileMessage {
  const fileMessage: ThreadFileMessage = {
    role: message.role,
    content: message.content,
    model: message.model,
    created_at: message.created_at,
  };

  // Conditionally include optional fields
  if (options.includeTokenUsage) {
    if (message.input_tokens != null) fileMessage.input_tokens = message.input_tokens;
    if (message.output_tokens != null) fileMessage.output_tokens = message.output_tokens;
    if (message.total_tokens != null) fileMessage.total_tokens = message.total_tokens;
  }

  if (options.includeToolCalls) {
    if (message.tool_calls) fileMessage.tool_calls = message.tool_calls;
    if (message.tool_results) fileMessage.tool_results = message.tool_results;
  }

  if (options.includeCitations && message.citations) {
    fileMessage.citations = message.citations;
  }

  if (options.includeAttachments && message.attachments) {
    fileMessage.attachments = message.attachments;
  }

  return fileMessage;
}

/**
 * Create a ThreadFile from thread data and messages
 */
export function createThreadFile(
  thread: Thread,
  messages: Message[],
  options: ThreadExportOptions = DEFAULT_EXPORT_OPTIONS
): ThreadFile {
  const metadata: ThreadFileMetadata = {
    title: thread.title,
    original_created_at: thread.created_at,
    original_updated_at: thread.updated_at,
    exported_at: new Date().toISOString(),
    message_count: messages.length,
  };

  // Add user info if provided
  if (options.exportedBy) {
    metadata.exported_by = options.exportedBy;
  }
  if (options.createdBy) {
    metadata.created_by = options.createdBy;
    // Default last_modified_by to created_by if not set separately
    metadata.last_modified_by = options.createdBy;
  }

  const fileMessages = messages.map(msg => messageToThreadFileMessage(msg, options));

  return {
    version: THREAD_FILE_VERSION,
    type: 'thread',
    metadata,
    messages: fileMessages,
  };
}

/**
 * Serialize a ThreadFile to JSON string
 */
export function serializeThreadFile(threadFile: ThreadFile): string {
  return JSON.stringify(threadFile, null, 2);
}

/**
 * Generate a filename for the thread export
 */
export function generateThreadFilename(thread: Thread): string {
  // Use thread title or fallback to "Untitled Thread"
  const title = thread.title || 'Untitled Thread';

  // Sanitize the title for use as a filename
  const sanitized = title
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .replace(/\s+/g, '_')         // Replace spaces with underscores
    .substring(0, 50);             // Limit length

  // Add timestamp for uniqueness
  const timestamp = new Date().toISOString().split('T')[0];

  return `${sanitized}_${timestamp}${THREAD_FILE_EXTENSION}`;
}

/**
 * Trigger a file download in the browser
 */
export function downloadThreadFile(content: string, filename: string): void {
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
 * Validate a parsed thread file
 */
export function validateThreadFile(data: unknown): ThreadFileValidationResult {
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file format: not a valid JSON object' };
  }

  const file = data as Record<string, unknown>;

  // Check required fields
  if (file.type !== 'thread') {
    return { valid: false, error: 'Invalid file type: expected "thread"' };
  }

  if (typeof file.version !== 'string') {
    return { valid: false, error: 'Missing or invalid version field' };
  }

  // Check version compatibility
  const [major] = file.version.split('.');
  const [currentMajor] = THREAD_FILE_VERSION.split('.');
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

  // Check messages array
  if (!Array.isArray(file.messages)) {
    return { valid: false, error: 'Missing or invalid messages array' };
  }

  // Validate each message has required fields
  for (let i = 0; i < file.messages.length; i++) {
    const msg = file.messages[i] as Record<string, unknown>;

    if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role as string)) {
      return { valid: false, error: `Invalid message role at index ${i}` };
    }

    if (typeof msg.content !== 'string') {
      return { valid: false, error: `Invalid message content at index ${i}` };
    }

    if (typeof msg.created_at !== 'string') {
      return { valid: false, error: `Invalid message created_at at index ${i}` };
    }
  }

  return { valid: true, data: file as unknown as ThreadFile };
}

/**
 * Parse and validate a thread file from a string
 */
export function parseThreadFile(content: string): ThreadFileValidationResult {
  try {
    const data = JSON.parse(content);
    return validateThreadFile(data);
  } catch (err) {
    return { valid: false, error: 'Invalid JSON format' };
  }
}

/**
 * Read a File object and parse it as a thread file
 */
export async function readThreadFile(file: File): Promise<ThreadFileValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') {
        resolve({ valid: false, error: 'Failed to read file content' });
        return;
      }
      resolve(parseThreadFile(content));
    };

    reader.onerror = () => {
      resolve({ valid: false, error: 'Failed to read file' });
    };

    reader.readAsText(file);
  });
}
