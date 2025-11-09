/**
 * Message Operations Utility
 *
 * Shared utilities for message-level database operations.
 * Provides consistent error handling and logging across features.
 */

import { supabase } from "@/lib/supabaseClient";
import type { Message } from "@/types/chat";

export type DeleteMessagesResult = {
  success: boolean;
  deletedCount: number;
  error?: string;
};

export type RestoreMessagesResult = {
  success: boolean;
  restoredCount: number;
  error?: string;
};

/**
 * Delete multiple messages by their IDs
 * @param messageIds - Array of message IDs to delete
 * @returns Result object with success status and deleted count
 */
export async function deleteMessages(
  messageIds: string[]
): Promise<DeleteMessagesResult> {
  if (!messageIds || messageIds.length === 0) {
    return {
      success: true,
      deletedCount: 0,
    };
  }

  try {
    const { error } = await supabase
      .from("messages")
      .delete()
      .in("id", messageIds);

    if (error) {
      console.error("Error deleting messages:", error);
      return {
        success: false,
        deletedCount: 0,
        error: error.message,
      };
    }

    console.log(`Successfully deleted ${messageIds.length} message(s)`);
    return {
      success: true,
      deletedCount: messageIds.length,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Unexpected error deleting messages:", err);
    return {
      success: false,
      deletedCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Restore multiple messages to the database
 * Used for undo operations after deleting messages
 * @param messages - Array of message objects to restore
 * @returns Result object with success status and restored count
 */
export async function restoreMessages(
  messages: Omit<Message, "id">[]
): Promise<RestoreMessagesResult> {
  if (!messages || messages.length === 0) {
    return {
      success: true,
      restoredCount: 0,
    };
  }

  try {
    const { error } = await supabase
      .from("messages")
      .insert(messages);

    if (error) {
      console.error("Error restoring messages:", error);
      return {
        success: false,
        restoredCount: 0,
        error: error.message,
      };
    }

    console.log(`Successfully restored ${messages.length} message(s)`);
    return {
      success: true,
      restoredCount: messages.length,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Unexpected error restoring messages:", err);
    return {
      success: false,
      restoredCount: 0,
      error: errorMessage,
    };
  }
}
