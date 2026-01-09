/**
 * Gmail OAuth Feature Types
 *
 * Type definitions for Gmail OAuth integration in Genesis Bot nodes.
 * Segmented from main canvas types for feature isolation.
 */

// Gmail OAuth connection status
export type GmailConnectionStatus = 'disconnected' | 'connected' | 'expired' | 'error';

// Gmail permissions that can be granted to a Genesis Bot
export interface GmailPermissions {
  canRead: boolean;
  canSend: boolean;
  canSearch: boolean;
  canManageLabels: boolean;
  canManageDrafts: boolean;
}

// Gmail OAuth configuration stored in Genesis Bot node config
export interface GmailOAuthConfig {
  enabled: boolean;
  connectionId?: string; // References oauth_connections table
  permissions: GmailPermissions;
  // Optional restrictions
  allowedRecipientDomains?: string[]; // e.g., ['company.com'] - restrict who bot can email
  maxEmailsPerHour?: number; // Rate limiting
  requireConfirmation?: boolean; // Require user confirmation before sending
  // SSM Monitoring filters
  filter_from?: string; // Filter emails from specific sender (e.g., 'john@example.com')
  filter_subject?: string; // Filter emails with specific subject keywords
  filter_label?: string; // Filter emails with specific label
}

// Default Gmail permissions (conservative by default)
export const DEFAULT_GMAIL_PERMISSIONS: GmailPermissions = {
  canRead: true,
  canSend: false, // Disabled by default for safety
  canSearch: true,
  canManageLabels: false,
  canManageDrafts: true,
};

// Default Gmail OAuth config
export const DEFAULT_GMAIL_CONFIG: GmailOAuthConfig = {
  enabled: false,
  permissions: DEFAULT_GMAIL_PERMISSIONS,
  requireConfirmation: true,
  maxEmailsPerHour: 10,
};

// Gmail connection info (from oauth_connections table)
export interface GmailConnectionInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  status: GmailConnectionStatus;
  connectedAt: string;
  lastUsedAt?: string;
  scopes: string[];
}

// Gmail tool definitions for AI
export interface GmailToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredPermission: keyof GmailPermissions;
}

// Email message structure
export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: string;
  labels: string[];
  isRead: boolean;
  hasAttachments: boolean;
  snippet: string;
}

// Email draft structure
export interface EmailDraft {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

// Search parameters
export interface GmailSearchParams {
  query: string;
  maxResults?: number;
  includeSpam?: boolean;
  labelIds?: string[];
}

// API response types
export interface GmailOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationId?: string;
}

// Pending email confirmation (for requireConfirmation feature)
export interface PendingEmailConfirmation {
  id: string;
  nodeId: string;
  draft: EmailDraft;
  createdAt: string;
  expiresAt: string;
}
