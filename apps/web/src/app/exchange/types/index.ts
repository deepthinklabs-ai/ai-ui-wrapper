/**
 * Exchange Feature - Type Definitions
 *
 * Types for the Exchange marketplace feature where users can post,
 * test, and download chatbots.
 */

import type { ChatbotFile } from '@/types/chatbotFile';
import type { CanvasFile } from '@/types/canvasFile';
import type { ThreadFile } from '@/types/threadFile';

// ============================================================================
// IDs
// ============================================================================

export type ExchangePostId = string;
export type ExchangeCategoryId = string;
export type ExchangeTagId = string;
export type ExchangeSandboxSessionId = string;

// ============================================================================
// CATEGORIES
// ============================================================================

export interface ExchangeCategory {
  id: ExchangeCategoryId;
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  created_at: string;
}

// ============================================================================
// TAGS
// ============================================================================

export interface ExchangeTag {
  id: ExchangeTagId;
  name: string;
  use_count: number;
  created_at: string;
}

// ============================================================================
// POSTS
// ============================================================================

export interface ExchangePost {
  id: ExchangePostId;
  user_id: string;
  title: string;
  description?: string;

  // Files (stored as JSONB)
  chatbot_file?: ChatbotFile;
  canvas_file?: CanvasFile;
  thread_file?: ThreadFile;

  // Stats
  download_count: number;
  test_count: number;

  // Visibility
  is_published: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Post with related data (categories and tags)
 */
export interface ExchangePostWithRelations extends ExchangePost {
  categories: ExchangeCategory[];
  tags: ExchangeTag[];
  author?: {
    name: string;
    email?: string;
  };
}

/**
 * Post preview for grid display (lighter weight)
 */
export interface ExchangePostPreview {
  id: ExchangePostId;
  user_id: string;
  title: string;
  description?: string;
  download_count: number;
  test_count: number;
  has_chatbot: boolean;
  has_canvas: boolean;
  has_thread: boolean;
  categories: string[]; // Just category names for display
  tags: string[]; // Just tag names for display
  created_at: string;
  author_name?: string;
}

/**
 * Full post details for modal view
 */
export interface ExchangePostDetail extends ExchangePostWithRelations {
  // Derived fields for display
  provider?: string;
  model_name?: string;
  has_oauth_requirements?: boolean;
  oauth_requirements?: {
    gmail?: boolean;
    calendar?: boolean;
    sheets?: boolean;
    docs?: boolean;
    slack?: boolean;
  };
}

// ============================================================================
// SANDBOX SESSIONS
// ============================================================================

export interface SandboxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  created_at: string;
  tokens_used?: number;
}

export interface ExchangeSandboxSession {
  id: ExchangeSandboxSessionId;
  post_id: ExchangePostId;
  user_id: string;
  messages: SandboxMessage[];
  last_query_at?: string;
  created_at: string;
  expires_at: string;
}

// ============================================================================
// BOT-TO-BOT QUERIES
// ============================================================================

export interface ExchangeBotQuery {
  id: string;
  source_user_id: string;
  target_post_id: ExchangePostId;
  query: string;
  response?: string;
  tokens_used: number;
  created_at: string;
}

// ============================================================================
// DOWNLOADS
// ============================================================================

export type DownloadFileType = 'chatbot' | 'canvas' | 'thread' | 'bundle';

export interface ExchangeDownload {
  id: string;
  post_id: ExchangePostId;
  user_id: string;
  file_type: DownloadFileType;
  created_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Create post request
 */
export interface CreateExchangePostRequest {
  title: string;
  description?: string;
  chatbot_file?: ChatbotFile;
  canvas_file?: CanvasFile;
  thread_file?: ThreadFile;
  category_ids: ExchangeCategoryId[];
  tag_names: string[]; // Tags will be created if they don't exist
}

/**
 * Update post request (only description and categories/tags can be updated)
 */
export interface UpdateExchangePostRequest {
  description?: string;
  category_ids?: ExchangeCategoryId[];
  tag_names?: string[];
}

/**
 * List posts filter options
 */
export interface ListExchangePostsFilter {
  category_ids?: ExchangeCategoryId[];
  tag_names?: string[];
  search?: string; // Search in title and description
  user_id?: string; // Filter by author
  sort_by?: 'created_at' | 'download_count' | 'test_count';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Sandbox chat request
 */
export interface SandboxChatRequest {
  session_id: ExchangeSandboxSessionId;
  message: string;
  // User's API keys are retrieved server-side, not passed in request
}

/**
 * Sandbox chat response
 */
export interface SandboxChatResponse {
  success: boolean;
  message?: SandboxMessage;
  error?: string;
  rate_limited?: boolean;
  rate_limit_reset_at?: string;
}

/**
 * Bot-to-bot query request
 */
export interface BotQueryRequest {
  target_post_id: ExchangePostId;
  query: string;
  // Optional context from user's thread
  context?: string;
}

/**
 * Bot-to-bot query response
 */
export interface BotQueryResponse {
  success: boolean;
  response?: string;
  tokens_used?: number;
  error?: string;
}

// ============================================================================
// BUNDLE FORMAT
// ============================================================================

/**
 * Bundle file format for downloading all files together
 */
export interface ExchangeBundle {
  version: '1.0.0';
  type: 'bundle';
  post_id: ExchangePostId;
  title: string;
  description?: string;
  exported_at: string;
  files: {
    chatbot?: ChatbotFile;
    canvas?: CanvasFile;
    thread?: ThreadFile;
  };
}

export const BUNDLE_FILE_VERSION = '1.0.0';
export const BUNDLE_FILE_EXTENSION = '.aiuiw';
export const BUNDLE_FILE_MIME_TYPE = 'application/json';
