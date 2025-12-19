/**
 * Canvas File Format Types
 *
 * Defines the .canvas file format for exporting and importing canvas workflows.
 * This format captures the complete canvas configuration including nodes and edges.
 * IMPORTANT: OAuth tokens and credentials are NEVER included in exports.
 */

import type { CanvasMode, CanvasNodeType } from '@/app/canvas/types';

/**
 * Version of the .canvas file format
 * Increment when making breaking changes to the format
 */
export const CANVAS_FILE_VERSION = '1.0.0';

/**
 * File extension for canvas files
 */
export const CANVAS_FILE_EXTENSION = '.canvas';

/**
 * MIME type for canvas files (custom JSON-based format)
 */
export const CANVAS_FILE_MIME_TYPE = 'application/json';

/**
 * User info for file metadata
 */
export type CanvasFileUserInfo = {
  /** User's display name or email */
  name: string;
  /** User's email (optional, may be hidden for privacy) */
  email?: string;
};

/**
 * Metadata about the canvas
 */
export type CanvasFileMetadata = {
  /** Canvas name */
  name: string;
  /** Canvas description */
  description?: string;
  /** Canvas mode */
  mode: CanvasMode;
  /** When this canvas was originally created */
  created_at: string;
  /** When this file was exported */
  exported_at: string;
  /** Number of nodes in the canvas */
  node_count: number;
  /** Number of edges in the canvas */
  edge_count: number;
  /** User who created the canvas */
  created_by?: CanvasFileUserInfo;
};

/**
 * Node as stored in a .canvas file
 * Config is sanitized to remove OAuth tokens and sensitive data
 */
export type CanvasFileNode = {
  /** Node type */
  type: CanvasNodeType;
  /** Position on canvas */
  position: { x: number; y: number };
  /** Node label/name */
  label: string;
  /** Sanitized configuration (NO OAuth tokens!) */
  config: Record<string, any>;
  /** Original node ID (for edge mapping during import) */
  original_id: string;
};

/**
 * Edge as stored in a .canvas file
 */
export type CanvasFileEdge = {
  /** Source node original_id */
  from_node_ref: string;
  /** Target node original_id */
  to_node_ref: string;
  /** Source port name */
  from_port?: string;
  /** Target port name */
  to_port?: string;
  /** Edge label */
  label?: string;
  /** Whether the edge is animated */
  animated?: boolean;
  /** Condition expression for conditional routing */
  condition?: string;
  /** Data transformation expression */
  transform?: string;
};

/**
 * OAuth requirements derived from canvas nodes
 */
export type CanvasFileOAuthRequirements = {
  gmail?: boolean;
  calendar?: boolean;
  sheets?: boolean;
  docs?: boolean;
  slack?: boolean;
};

/**
 * The complete .canvas file structure
 */
export type CanvasFile = {
  /** File format version for compatibility checking */
  version: string;
  /** File type identifier */
  type: 'canvas';
  /** Canvas metadata */
  metadata: CanvasFileMetadata;
  /** All nodes in the canvas */
  nodes: CanvasFileNode[];
  /** All edges connecting nodes */
  edges: CanvasFileEdge[];
  /** OAuth requirements for this canvas (derived from nodes) */
  oauth_requirements?: CanvasFileOAuthRequirements;
};

/**
 * Result of validating a canvas file
 */
export type CanvasFileValidationResult = {
  valid: boolean;
  error?: string;
  data?: CanvasFile;
};

/**
 * Options for exporting a canvas
 */
export type CanvasExportOptions = {
  /** User info for the person exporting the file */
  exportedBy?: CanvasFileUserInfo;
  /** User info for the person who created the canvas */
  createdBy?: CanvasFileUserInfo;
};

/**
 * Result of importing a canvas
 */
export type CanvasImportResult = {
  success: boolean;
  canvasId?: string;
  error?: string;
  nodeCount?: number;
  edgeCount?: number;
  /** Whether OAuth connections are required */
  requiresOAuth?: boolean;
  /** List of required OAuth providers */
  requiredOAuthProviders?: string[];
};

/**
 * Fields that should be stripped from node configs during export
 * These contain sensitive data like OAuth tokens
 */
export const SENSITIVE_CONFIG_FIELDS = [
  // OAuth tokens
  'access_token',
  'refresh_token',
  'token_expiry',
  'oauth_tokens',
  // Gmail OAuth
  'gmail',
  'gmail_config',
  // Calendar OAuth
  'calendar',
  'calendar_config',
  // Sheets OAuth
  'sheets',
  'sheets_config',
  // Docs OAuth
  'docs',
  'docs_config',
  // Slack OAuth
  'slack',
  'slack_config',
  // Generic sensitive fields
  'credentials',
  'api_key',
  'secret',
  'password',
  'private_key',
];

/**
 * Fields that indicate OAuth requirements when present in config
 */
export const OAUTH_REQUIREMENT_FIELDS: Record<string, keyof CanvasFileOAuthRequirements> = {
  'gmail_enabled': 'gmail',
  'gmail_required': 'gmail',
  'calendar_enabled': 'calendar',
  'calendar_required': 'calendar',
  'sheets_enabled': 'sheets',
  'sheets_required': 'sheets',
  'docs_enabled': 'docs',
  'docs_required': 'docs',
  'slack_enabled': 'slack',
  'slack_required': 'slack',
};
