/**
 * Slack MCP Integration
 *
 * Dedicated integration layer for Slack MCP server.
 * Provides Slack-specific utilities, formatters, and system prompts.
 */

import type { MCPTool } from "./mcpClient";

/**
 * Slack-specific tool names
 */
export const SLACK_TOOLS = {
  POST_MESSAGE: "slack_post_message",
  REPLY_TO_THREAD: "slack_reply_to_thread",
  ADD_REACTION: "slack_add_reaction",
  LIST_CHANNELS: "slack_list_channels",
  GET_USER_INFO: "slack_get_user_info",
  GET_CHANNEL_HISTORY: "slack_get_channel_history",
} as const;

/**
 * Check if a tool is a Slack tool
 */
export function isSlackTool(toolName: string): boolean {
  return Object.values(SLACK_TOOLS).includes(toolName as any);
}

/**
 * Filter Slack tools from a list of MCP tools
 */
export function getSlackTools(tools: Array<MCPTool & { serverId: string; serverName: string }>) {
  return tools.filter(tool =>
    tool.serverName?.toLowerCase().includes('slack') ||
    isSlackTool(tool.name)
  );
}

/**
 * Generate Slack-specific system prompt
 */
export function generateSlackSystemPrompt(
  slackTools: Array<MCPTool & { serverId: string; serverName: string }>,
  teamId?: string
): string {
  if (slackTools.length === 0) return '';

  const toolsList = slackTools.map(t => `- ${t.name}: ${t.description || 'No description'}`).join('\n');

  return `💬 SLACK MCP INTEGRATION ENABLED

You have access to ${slackTools.length} Slack workspace tools${teamId ? ` for team ${teamId}` : ''}:

${toolsList}

## Slack Best Practices

### Posting Messages
- Use \`slack_post_message\` to send new messages to channels
- Always specify the channel ID (starts with 'C' for public channels, 'G' for private groups, 'D' for DMs)
- Keep messages clear and concise
- Use proper Slack markdown formatting

### Thread Management
- Use \`slack_reply_to_thread\` to reply to existing conversations
- Always provide the message timestamp (ts) to maintain thread context
- Threads keep conversations organized

### Reactions
- Use \`slack_add_reaction\` to add emoji reactions to messages
- Reactions are a quick way to acknowledge or respond
- Use standard emoji names (e.g., 'thumbsup', 'tada', 'eyes')

### Channel Discovery
- Use \`slack_list_channels\` to find available channels
- Check channel membership before posting
- Respect channel topics and purposes

### User Information
- Use \`slack_get_user_info\` to get details about workspace members
- Useful for @mentions and understanding team structure

### Message History
- Use \`slack_get_channel_history\` to retrieve recent messages
- Useful for context and understanding ongoing conversations
- Respect privacy and only access when needed

## Important Notes
- ALWAYS verify channel IDs before posting
- Be mindful of message volume in busy channels
- Use threads to keep channels organized
- Respect workspace etiquette and guidelines
`;
}

/**
 * Format Slack channel for display
 */
export function formatSlackChannel(channel: any): string {
  return `#${channel.name} (${channel.id})${channel.is_private ? ' 🔒' : ''}`;
}

/**
 * Format Slack user for display
 */
export function formatSlackUser(user: any): string {
  const name = user.real_name || user.name || user.id;
  const status = user.profile?.status_emoji ? ` ${user.profile.status_emoji}` : '';
  return `@${name}${status}`;
}

/**
 * Validate Slack Bot Token format
 */
export function isValidSlackBotToken(token: string): boolean {
  return token.startsWith('xoxb-') && token.length > 20;
}

/**
 * Validate Slack Team ID format
 */
export function isValidSlackTeamId(teamId: string): boolean {
  return /^T[A-Z0-9]{8,}$/i.test(teamId);
}

/**
 * Extract Slack configuration from MCP server config
 */
export function extractSlackConfig(serverConfig: any): {
  botToken?: string;
  teamId?: string;
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const botToken = serverConfig.env?.SLACK_BOT_TOKEN;
  const teamId = serverConfig.env?.SLACK_TEAM_ID;

  if (!botToken || botToken === 'xoxb-YOUR_BOT_TOKEN_HERE') {
    errors.push('Slack Bot Token is required');
  } else if (!isValidSlackBotToken(botToken)) {
    errors.push('Invalid Slack Bot Token format (should start with xoxb-)');
  }

  if (!teamId || teamId === 'T01234567') {
    errors.push('Slack Team ID is required');
  } else if (!isValidSlackTeamId(teamId)) {
    errors.push('Invalid Slack Team ID format (should start with T)');
  }

  return {
    botToken,
    teamId,
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Slack tool usage examples for AI guidance
 */
export const SLACK_TOOL_EXAMPLES = {
  post_message: {
    description: "Post a message to a Slack channel",
    example: `{
  "channel": "C01234567",
  "text": "Hello team! Here's an update on the project."
}`,
  },
  reply_to_thread: {
    description: "Reply to a message thread",
    example: `{
  "channel": "C01234567",
  "thread_ts": "1234567890.123456",
  "text": "Thanks for the update!"
}`,
  },
  add_reaction: {
    description: "Add an emoji reaction to a message",
    example: `{
  "channel": "C01234567",
  "timestamp": "1234567890.123456",
  "name": "thumbsup"
}`,
  },
  list_channels: {
    description: "List all channels in the workspace",
    example: `{
  "exclude_archived": true,
  "types": "public_channel,private_channel"
}`,
  },
  get_user_info: {
    description: "Get information about a Slack user",
    example: `{
  "user": "U01234567"
}`,
  },
};
