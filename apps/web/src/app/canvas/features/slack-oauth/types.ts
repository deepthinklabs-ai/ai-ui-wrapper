/**
 * Slack OAuth Feature Types
 *
 * Type definitions for Slack integration in Genesis Bot nodes.
 */

/**
 * Slack permissions that can be granted to a bot
 */
export interface SlackPermissions {
  canReadChannels: boolean;    // List channels, read history
  canPostMessages: boolean;    // Send messages, reply to threads
  canReact: boolean;           // Add/remove reactions
  canReadUsers: boolean;       // Get user info
  canUploadFiles: boolean;     // Upload files to channels
  canManageChannels: boolean;  // Create/archive channels (dangerous)
}

/**
 * Default Slack permissions (conservative)
 */
export const DEFAULT_SLACK_PERMISSIONS: SlackPermissions = {
  canReadChannels: true,
  canPostMessages: false,
  canReact: false,
  canReadUsers: true,
  canUploadFiles: false,
  canManageChannels: false,
};

/**
 * Slack OAuth configuration for a Genesis Bot node
 */
export interface SlackOAuthConfig {
  enabled: boolean;
  connectionId: string | null;
  permissions: SlackPermissions;
  workspaceName?: string;
  workspaceId?: string;
}

/**
 * Default Slack OAuth configuration
 */
export const DEFAULT_SLACK_CONFIG: SlackOAuthConfig = {
  enabled: false,
  connectionId: null,
  permissions: DEFAULT_SLACK_PERMISSIONS,
};

/**
 * Slack connection status
 */
export type SlackConnectionStatus = 'disconnected' | 'connected' | 'expired' | 'error';

/**
 * Slack connection info for UI display
 */
export interface SlackConnectionInfo {
  id: string;
  workspaceId: string;
  workspaceName: string;
  botUserId?: string;
  status: SlackConnectionStatus;
  connectedAt: string;
}

/**
 * Parameters for listing channels
 */
export interface SlackListChannelsParams {
  types?: string; // 'public_channel,private_channel'
  limit?: number;
  cursor?: string;
}

/**
 * Parameters for getting channel history
 */
export interface SlackGetHistoryParams {
  channel: string;
  limit?: number;
  oldest?: string;
  latest?: string;
}

/**
 * Parameters for posting a message
 */
export interface SlackPostMessageParams {
  channel: string;
  text: string;
  thread_ts?: string;
  blocks?: any[];
}

/**
 * Parameters for replying to a thread
 */
export interface SlackReplyParams {
  channel: string;
  thread_ts: string;
  text: string;
}

/**
 * Parameters for adding/removing a reaction
 */
export interface SlackReactionParams {
  channel: string;
  timestamp: string;
  name: string; // emoji name without colons
}

/**
 * Parameters for getting user info
 */
export interface SlackGetUserParams {
  user: string; // user ID
}

/**
 * Parameters for listing users
 */
export interface SlackListUsersParams {
  limit?: number;
  cursor?: string;
}

/**
 * Parameters for uploading a file
 */
export interface SlackUploadFileParams {
  channels: string; // comma-separated channel IDs
  content?: string;
  filename?: string;
  title?: string;
  initial_comment?: string;
}

/**
 * Parameters for creating a channel
 */
export interface SlackCreateChannelParams {
  name: string;
  is_private?: boolean;
}

/**
 * Slack channel info
 */
export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
  num_members?: number;
  topic?: { value: string };
  purpose?: { value: string };
}

/**
 * Slack message
 */
export interface SlackMessage {
  type: string;
  user?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
}

/**
 * Slack user info
 */
export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    display_name?: string;
    email?: string;
    image_72?: string;
  };
  is_bot: boolean;
}

/**
 * Result of a Slack operation
 */
export interface SlackOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Tool definition for Claude
 */
export interface SlackTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  requiredPermission: keyof SlackPermissions;
}
