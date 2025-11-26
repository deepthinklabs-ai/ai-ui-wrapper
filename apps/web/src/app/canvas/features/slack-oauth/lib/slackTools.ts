/**
 * Slack Tools Definition
 *
 * Defines the tools available for Slack integration.
 * Each tool includes name, description, parameters, and required permission.
 */

import type { SlackTool, SlackPermissions } from '../types';

/**
 * All available Slack tools
 */
export const SLACK_TOOLS: SlackTool[] = [
  // Channel Read Tools
  {
    name: 'slack_list_channels',
    description: 'List all channels in the Slack workspace that the bot has access to',
    input_schema: {
      type: 'object',
      properties: {
        types: {
          type: 'string',
          description: 'Comma-separated list of channel types: public_channel, private_channel (default: public_channel)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of channels to return (default: 100, max: 1000)',
        },
      },
      required: [],
    },
    requiredPermission: 'canReadChannels',
  },
  {
    name: 'slack_get_channel_history',
    description: 'Get message history from a Slack channel',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'The channel ID to get history from',
        },
        limit: {
          type: 'number',
          description: 'Number of messages to return (default: 20, max: 100)',
        },
      },
      required: ['channel'],
    },
    requiredPermission: 'canReadChannels',
  },

  // Message Tools
  {
    name: 'slack_post_message',
    description: 'Post a message to a Slack channel',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'The channel ID or name (e.g., #general) to post to',
        },
        text: {
          type: 'string',
          description: 'The message text to post',
        },
      },
      required: ['channel', 'text'],
    },
    requiredPermission: 'canPostMessages',
  },
  {
    name: 'slack_reply_to_thread',
    description: 'Reply to a specific message in a thread',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'The channel ID where the thread is',
        },
        thread_ts: {
          type: 'string',
          description: 'The timestamp of the parent message to reply to',
        },
        text: {
          type: 'string',
          description: 'The reply text',
        },
      },
      required: ['channel', 'thread_ts', 'text'],
    },
    requiredPermission: 'canPostMessages',
  },

  // Reaction Tools
  {
    name: 'slack_add_reaction',
    description: 'Add an emoji reaction to a message',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'The channel ID where the message is',
        },
        timestamp: {
          type: 'string',
          description: 'The timestamp of the message to react to',
        },
        name: {
          type: 'string',
          description: 'The emoji name without colons (e.g., thumbsup, heart)',
        },
      },
      required: ['channel', 'timestamp', 'name'],
    },
    requiredPermission: 'canReact',
  },
  {
    name: 'slack_remove_reaction',
    description: 'Remove an emoji reaction from a message',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'The channel ID where the message is',
        },
        timestamp: {
          type: 'string',
          description: 'The timestamp of the message',
        },
        name: {
          type: 'string',
          description: 'The emoji name to remove (without colons)',
        },
      },
      required: ['channel', 'timestamp', 'name'],
    },
    requiredPermission: 'canReact',
  },

  // User Tools
  {
    name: 'slack_get_user_info',
    description: 'Get information about a Slack user',
    input_schema: {
      type: 'object',
      properties: {
        user: {
          type: 'string',
          description: 'The user ID to get info for',
        },
      },
      required: ['user'],
    },
    requiredPermission: 'canReadUsers',
  },
  {
    name: 'slack_list_users',
    description: 'List all users in the Slack workspace',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of users to return (default: 100)',
        },
      },
      required: [],
    },
    requiredPermission: 'canReadUsers',
  },

  // File Tools
  {
    name: 'slack_upload_file',
    description: 'Upload a file or text snippet to a Slack channel',
    input_schema: {
      type: 'object',
      properties: {
        channels: {
          type: 'string',
          description: 'Comma-separated channel IDs to share the file to',
        },
        content: {
          type: 'string',
          description: 'The text content to upload as a file',
        },
        filename: {
          type: 'string',
          description: 'The filename (e.g., snippet.txt)',
        },
        title: {
          type: 'string',
          description: 'Title of the file',
        },
        initial_comment: {
          type: 'string',
          description: 'Message to post along with the file',
        },
      },
      required: ['channels', 'content'],
    },
    requiredPermission: 'canUploadFiles',
  },

  // Channel Management Tools
  {
    name: 'slack_create_channel',
    description: 'Create a new Slack channel',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the channel (lowercase, no spaces, max 80 chars)',
        },
        is_private: {
          type: 'boolean',
          description: 'Whether to create a private channel (default: false)',
        },
      },
      required: ['name'],
    },
    requiredPermission: 'canManageChannels',
  },
];

/**
 * Get tools that are enabled based on permissions
 */
export function getEnabledSlackTools(permissions: SlackPermissions): SlackTool[] {
  return SLACK_TOOLS.filter((tool) => permissions[tool.requiredPermission]);
}

/**
 * Convert tools to Claude tool format
 */
export function toClaudeToolFormat(tools: SlackTool[]): any[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}

/**
 * Generate system prompt section for Slack capabilities
 */
export function generateSlackSystemPrompt(config: { permissions: SlackPermissions; workspaceName?: string }): string {
  const enabledTools = getEnabledSlackTools(config.permissions);

  if (enabledTools.length === 0) {
    return '';
  }

  const capabilities: string[] = [];

  if (config.permissions.canReadChannels) {
    capabilities.push('- List and read messages from Slack channels');
  }

  if (config.permissions.canPostMessages) {
    capabilities.push('- Post messages and reply to threads in Slack');
  }

  if (config.permissions.canReact) {
    capabilities.push('- Add and remove emoji reactions to messages');
  }

  if (config.permissions.canReadUsers) {
    capabilities.push('- Look up Slack user information');
  }

  if (config.permissions.canUploadFiles) {
    capabilities.push('- Upload files and snippets to channels');
  }

  if (config.permissions.canManageChannels) {
    capabilities.push('- Create new Slack channels');
  }

  const workspaceInfo = config.workspaceName ? ` (${config.workspaceName})` : '';

  return `
SLACK CAPABILITIES${workspaceInfo}:
You have access to Slack integration. You can:
${capabilities.join('\n')}

When working with Slack:
- Channel IDs typically start with C (public) or G (private)
- User IDs start with U
- Message timestamps (ts) are unique identifiers for messages
- Use channel names with # prefix when posting (e.g., #general)
- Always confirm successful operations with the user

CRITICAL: You MUST call the slack_post_message tool to send ANY Slack message. NEVER claim you sent a message without actually calling the tool. If asked to send a message, ALWAYS use the tool - do not rely on conversation history. Each message request requires a NEW tool call.
`.trim();
}
