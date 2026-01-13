/**
 * Google Drive OAuth Feature Types
 *
 * Type definitions for Google Drive OAuth integration in Genesis Bot nodes.
 * Segmented from main canvas types for feature isolation.
 */

// Drive OAuth connection status
export type DriveConnectionStatus = 'disconnected' | 'connected' | 'expired' | 'error';

// Drive permissions that can be granted to a Genesis Bot
export interface DrivePermissions {
  canRead: boolean;
  canWrite: boolean;
  canSearch: boolean;
  canShare: boolean;
}

// Drive OAuth configuration stored in Genesis Bot node config
export interface DriveOAuthConfig {
  enabled: boolean;
  connectionId?: string; // References oauth_connections table
  permissions: DrivePermissions;
  // Optional restrictions
  allowedFolderIds?: string[]; // Restrict access to specific folders
  allowedMimeTypes?: string[]; // Restrict to specific file types
  maxFileSizeMB?: number; // Max file size for uploads
}

// Default Drive permissions (conservative by default)
export const DEFAULT_DRIVE_PERMISSIONS: DrivePermissions = {
  canRead: true,
  canWrite: false, // Disabled by default for safety
  canSearch: true,
  canShare: false, // Disabled by default for safety
};

// Default Drive OAuth config
export const DEFAULT_DRIVE_CONFIG: DriveOAuthConfig = {
  enabled: false,
  permissions: DEFAULT_DRIVE_PERMISSIONS,
  maxFileSizeMB: 10,
};

// Drive connection info (from oauth_connections table)
export interface DriveConnectionInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  status: DriveConnectionStatus;
  connectedAt: string;
  lastUsedAt?: string;
  scopes: string[];
}

// Drive file structure
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
}

// Drive folder structure
export interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
  createdTime: string;
  modifiedTime: string;
}

// Search parameters
export interface DriveSearchParams {
  query: string;
  maxResults?: number;
  mimeType?: string;
  folderId?: string;
}

// API response types
export interface DriveOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
