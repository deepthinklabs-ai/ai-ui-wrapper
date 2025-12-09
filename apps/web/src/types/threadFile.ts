/**
 * Thread File Format Types
 *
 * Defines the .thread file format for exporting and importing conversation threads.
 * This format allows users to share threads with others.
 */

import type { MessageRole, AttachmentMetadata, ToolCall, ToolResult, Citation } from './chat';

/**
 * Version of the .thread file format
 * Increment when making breaking changes to the format
 */
export const THREAD_FILE_VERSION = '1.0.0';

/**
 * File extension for thread files
 */
export const THREAD_FILE_EXTENSION = '.thread';

/**
 * MIME type for thread files (custom JSON-based format)
 */
export const THREAD_FILE_MIME_TYPE = 'application/json';

/**
 * Message as stored in a .thread file
 * Excludes database-specific fields like id, thread_id
 */
export type ThreadFileMessage = {
  role: MessageRole;
  content: string;
  model: string | null;
  attachments?: AttachmentMetadata[] | null;
  created_at: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  tool_calls?: ToolCall[] | null;
  tool_results?: ToolResult[] | null;
  citations?: Citation[] | null;
};

/**
 * User info for file metadata
 */
export type ThreadFileUserInfo = {
  /** User's display name or email */
  name: string;
  /** User's email (optional, may be hidden for privacy) */
  email?: string;
};

/**
 * Metadata about the thread
 */
export type ThreadFileMetadata = {
  /** Original thread title */
  title: string | null;
  /** When the thread was originally created */
  original_created_at: string;
  /** When the thread was last updated */
  original_updated_at: string | null;
  /** When this file was exported */
  exported_at: string;
  /** Total number of messages in the thread */
  message_count: number;
  /** User who created the original thread */
  created_by?: ThreadFileUserInfo;
  /** User who last modified the thread (sent last message) */
  last_modified_by?: ThreadFileUserInfo;
  /** User who exported this file */
  exported_by?: ThreadFileUserInfo;
};

/**
 * The complete .thread file structure
 */
export type ThreadFile = {
  /** File format version for compatibility checking */
  version: string;
  /** File type identifier */
  type: 'thread';
  /** Thread metadata */
  metadata: ThreadFileMetadata;
  /** All messages in chronological order */
  messages: ThreadFileMessage[];
};

/**
 * Result of validating a thread file
 */
export type ThreadFileValidationResult = {
  valid: boolean;
  error?: string;
  data?: ThreadFile;
};

/**
 * Options for exporting a thread
 */
export type ThreadExportOptions = {
  /** Whether to include token usage data */
  includeTokenUsage?: boolean;
  /** Whether to include tool calls and results */
  includeToolCalls?: boolean;
  /** Whether to include citations */
  includeCitations?: boolean;
  /** Whether to include attachments metadata (not the actual files) */
  includeAttachments?: boolean;
  /** User info for the person exporting the file */
  exportedBy?: ThreadFileUserInfo;
  /** User info for the person who created the thread */
  createdBy?: ThreadFileUserInfo;
};

/**
 * Result of importing a thread
 */
export type ThreadImportResult = {
  success: boolean;
  threadId?: string;
  error?: string;
  messageCount?: number;
};
