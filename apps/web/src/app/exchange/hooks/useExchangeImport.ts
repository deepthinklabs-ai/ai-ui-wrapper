/**
 * useExchangeImport Hook
 *
 * Provides functionality for importing files from Exchange posts
 * directly into the user's account.
 */

import { useState, useCallback } from 'react';
import { useCSRF } from '@/hooks/useCSRF';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportResult {
  success: boolean;
  thread_id?: string;
  title?: string;
  message_count?: number;
  error?: string;
}

interface UseExchangeImportOptions {
  /** User ID for authentication */
  userId: string | undefined;
  /** Callback when import completes successfully */
  onImportComplete?: (result: ImportResult) => void;
  /** Callback when import fails */
  onImportError?: (error: string) => void;
}

interface UseExchangeImportReturn {
  /** Import a thread from an Exchange post */
  importThread: (postId: string, folderId?: string | null) => Promise<ImportResult>;
  /** Whether an import is in progress */
  isImporting: boolean;
  /** Error message if import failed */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
  /** Last successful import result */
  lastResult: ImportResult | null;
  /** Clear the last result */
  clearResult: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for importing files from Exchange posts into user's account
 */
export function useExchangeImport(options: UseExchangeImportOptions): UseExchangeImportReturn {
  const { userId, onImportComplete, onImportError } = options;
  const { csrfFetch } = useCSRF();

  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear last result
   */
  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  /**
   * Import a thread from an Exchange post into user's account
   */
  const importThread = useCallback(async (
    postId: string,
    folderId?: string | null
  ): Promise<ImportResult> => {
    console.log('[ExchangeImport] Starting import for post:', postId);

    // Validate user is authenticated
    if (!userId) {
      const errorMsg = 'You must be logged in to import threads';
      setError(errorMsg);
      onImportError?.(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsImporting(true);
    setError(null);
    setLastResult(null);

    try {
      // Call the import API
      const response = await csrfFetch(`/api/exchange/posts/${postId}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          folder_id: folderId || null,
        }),
      });

      const data = await response.json();
      console.log('[ExchangeImport] API response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      const result: ImportResult = {
        success: true,
        thread_id: data.thread_id,
        title: data.title,
        message_count: data.message_count,
      };

      setLastResult(result);
      console.log('[ExchangeImport] Import successful:', result);
      onImportComplete?.(result);

      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to import thread';
      console.error('[ExchangeImport] Import failed:', err);
      setError(errorMsg);
      onImportError?.(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsImporting(false);
    }
  }, [userId, csrfFetch, onImportComplete, onImportError]);

  return {
    importThread,
    isImporting,
    error,
    clearError,
    lastResult,
    clearResult,
  };
}
