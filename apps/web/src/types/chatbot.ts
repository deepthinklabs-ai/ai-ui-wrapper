/**
 * Chatbot Types
 *
 * Type definitions for chatbot configurations stored in the database.
 * Supports folder organization and thread associations.
 */

import type { ChatbotFileConfig } from './chatbotFile';

/**
 * Chatbot configuration stored in database
 */
export interface Chatbot {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  folder_id: string | null;
  position: number;
  config: ChatbotFileConfig;
  created_at: string;
  updated_at: string | null;
}

/**
 * Chatbot folder for organization
 */
export interface ChatbotFolder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  is_collapsed: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
}

/**
 * Chatbot folder with nested children for tree rendering
 */
export interface ChatbotFolderWithChildren extends ChatbotFolder {
  children: ChatbotFolderWithChildren[];
  chatbots: Chatbot[];
}

/**
 * Input for creating a new chatbot
 */
export interface CreateChatbotInput {
  name: string;
  description?: string;
  folder_id?: string | null;
  config: ChatbotFileConfig;
}

/**
 * Updates allowed on a chatbot
 */
export interface UpdateChatbotInput {
  name?: string;
  description?: string | null;
  folder_id?: string | null;
  position?: number;
  config?: ChatbotFileConfig;
}

/**
 * Input for creating a new chatbot folder
 */
export interface CreateChatbotFolderInput {
  name: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
}

/**
 * Updates allowed on a chatbot folder
 */
export interface UpdateChatbotFolderInput {
  name?: string;
  color?: string | null;
  icon?: string | null;
  is_collapsed?: boolean;
}
