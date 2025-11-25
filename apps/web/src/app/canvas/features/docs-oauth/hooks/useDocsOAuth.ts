/**
 * useDocsOAuth Hook
 *
 * Hook for managing Google Docs OAuth connection.
 * Reuses Gmail OAuth since they share the same Google OAuth connection.
 */

import { useGmailOAuth } from '../../gmail-oauth/hooks/useGmailOAuth';

/**
 * Hook for Docs OAuth - delegates to Gmail OAuth
 * Since Gmail, Sheets, and Docs all use the same Google OAuth connection,
 * we reuse the Gmail OAuth hook.
 */
export function useDocsOAuth() {
  return useGmailOAuth();
}
