# Slack MCP Server Integration

Complete guide for setting up and using the Slack Model Context Protocol (MCP) server integration.

## Overview

The Slack MCP integration allows your AI assistant to interact with your Slack workspace through standardized tools. The integration is fully segmented from other MCP servers for maintainability and clarity.

## Architecture

### File Structure
```
src/
├── lib/
│   ├── mcpStorage.ts                 # Slack preset configuration
│   └── slackMCPIntegration.ts       # Slack-specific utilities (NEW)
├── components/settings/
│   └── SlackMCPConfig.tsx           # Slack configuration UI (NEW)
└── hooks/
    └── useMessages.ts                # Slack system prompt injection
```

### Dedicated Slack Files

#### 1. `slackMCPIntegration.ts`
**Purpose**: Slack-specific business logic and utilities

**Features**:
- Tool name constants (`SLACK_TOOLS`)
- Tool filtering and detection
- System prompt generation
- Configuration validation
- Format helpers for channels and users
- Tool usage examples

#### 2. `SlackMCPConfig.tsx`
**Purpose**: Dedicated UI component for Slack configuration

**Features**:
- Step-by-step setup instructions
- Token and Team ID validation
- Real-time feedback
- Helpful links to Slack API docs
- Visual validation indicators

## Setup Instructions

### Step 1: Create a Slack App

1. Visit [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Name your app (e.g., "AI Assistant")
4. Select your workspace
5. Click **"Create App"**

### Step 2: Configure Bot Token Scopes

1. In your app settings, navigate to **"OAuth & Permissions"**
2. Scroll down to **"Scopes"** → **"Bot Token Scopes"**
3. Add the following scopes:

| Scope | Purpose |
|-------|---------|
| `channels:history` | Read public channel message history |
| `channels:read` | View basic channel information |
| `chat:write` | Send messages as the bot |
| `reactions:write` | Add emoji reactions to messages |
| `users:read` | View user profile information |
| `groups:history` | Read private channel history |
| `im:history` | Read direct message history |
| `mpim:history` | Read group DM history |

### Step 3: Install App to Workspace

1. Still in **"OAuth & Permissions"**, click **"Install to Workspace"**
2. Review the requested permissions
3. Click **"Allow"** to authorize the app
4. **Copy the "Bot User OAuth Token"** (starts with `xoxb-`)
   - Keep this token secure!
   - Store it in a password manager

### Step 4: Get Your Team ID

**Method 1: From Slack URL**
1. In Slack, click your workspace name (top left)
2. Go to **"Settings & administration"** → **"Workspace settings"**
3. Your browser URL will look like: `https://app.slack.com/client/T01234567/...`
4. The Team ID is the part starting with `T` (e.g., `T01234567`)

**Method 2: From API**
```bash
curl -H "Authorization: Bearer xoxb-your-token-here" \
  https://slack.com/api/auth.test
```
Look for the `team_id` field in the response.

### Step 5: Configure in Settings

1. Open your app and go to **Settings**
2. Scroll to **"MCP Server Settings"**
3. Enable MCP if not already enabled
4. Click **"Show Presets"**
5. Find **"Slack"** and click **"Add"**
6. Paste your **Bot Token** (starts with `xoxb-`)
7. Paste your **Team ID** (starts with `T`)
8. Click **"Save"**
9. Enable the Slack server

## Available Tools

Once configured, the AI assistant has access to these Slack tools:

### 1. `slack_post_message`
Post a new message to a channel, group, or DM.

**Parameters**:
- `channel` (required): Channel ID (e.g., `C01234567`)
- `text` (required): Message text
- `thread_ts` (optional): Thread timestamp to reply to

**Example**:
```json
{
  "channel": "C01234567",
  "text": "Hello team! Here's an update on the project."
}
```

### 2. `slack_reply_to_thread`
Reply to a specific message thread.

**Parameters**:
- `channel` (required): Channel ID
- `thread_ts` (required): Parent message timestamp
- `text` (required): Reply text

**Example**:
```json
{
  "channel": "C01234567",
  "thread_ts": "1234567890.123456",
  "text": "Thanks for the update!"
}
```

### 3. `slack_add_reaction`
Add an emoji reaction to a message.

**Parameters**:
- `channel` (required): Channel ID
- `timestamp` (required): Message timestamp
- `name` (required): Emoji name (without colons)

**Example**:
```json
{
  "channel": "C01234567",
  "timestamp": "1234567890.123456",
  "name": "thumbsup"
}
```

### 4. `slack_list_channels`
List all channels in the workspace.

**Parameters**:
- `exclude_archived` (optional): Exclude archived channels (default: true)
- `types` (optional): Channel types to include

**Example**:
```json
{
  "exclude_archived": true,
  "types": "public_channel,private_channel"
}
```

### 5. `slack_get_user_info`
Get detailed information about a Slack user.

**Parameters**:
- `user` (required): User ID (e.g., `U01234567`)

**Example**:
```json
{
  "user": "U01234567"
}
```

### 6. `slack_get_channel_history`
Retrieve recent messages from a channel.

**Parameters**:
- `channel` (required): Channel ID
- `limit` (optional): Number of messages to retrieve

**Example**:
```json
{
  "channel": "C01234567",
  "limit": 10
}
```

## Usage Examples

### Posting a Message
```
User: "Post a message to the #general channel saying 'Meeting at 3pm today'"

AI: I'll post that message to the general channel.
[Calls slack_list_channels to find #general]
[Calls slack_post_message with channel ID and text]
```

### Adding a Reaction
```
User: "Add a thumbs up reaction to the latest message in #announcements"

AI: I'll add a thumbs up reaction to the latest message.
[Calls slack_get_channel_history to get latest message]
[Calls slack_add_reaction with message timestamp]
```

### Replying to a Thread
```
User: "Reply to the thread about the Q4 planning with 'I'll review this tomorrow'"

AI: I'll reply to that thread.
[Calls slack_get_channel_history to find the thread]
[Calls slack_reply_to_thread with thread_ts]
```

## System Prompts

The AI assistant receives comprehensive system prompts about Slack capabilities, including:

- Available tools and their purposes
- Best practices for posting messages
- Thread management guidelines
- Channel discovery tips
- User information access
- Message history retrieval

These prompts are automatically injected when Slack tools are available.

## Validation

The integration includes built-in validation:

### Bot Token Validation
- Must start with `xoxb-`
- Must be at least 20 characters long
- Validated in real-time in the UI

### Team ID Validation
- Must start with `T`
- Must match pattern: `T[A-Z0-9]{8,}`
- Validated in real-time in the UI

## Troubleshooting

### "Invalid token" error
- Verify your token starts with `xoxb-`
- Ensure you copied the entire token
- Check the token hasn't been revoked
- Reinstall the app to get a new token

### "Channel not found" error
- Use channel IDs, not names
- Channel IDs start with `C` (public) or `G` (private)
- Use `slack_list_channels` to find the correct ID

### "Missing scope" error
- Review the required scopes in Step 2
- Reinstall the app after adding scopes
- The token must be regenerated after scope changes

### Connection fails
- Check your internet connection
- Verify the Team ID is correct
- Ensure MCP is enabled in settings
- Check browser console for detailed errors

## Security Best Practices

1. **Never commit tokens to git**
   - Tokens are stored in localStorage only
   - Not included in database or source code

2. **Use workspace-specific apps**
   - Create separate apps for each workspace
   - Don't share tokens across workspaces

3. **Rotate tokens regularly**
   - Regenerate tokens periodically
   - Update configuration with new tokens

4. **Limit scopes to what's needed**
   - Only request permissions you'll use
   - Review scope requirements regularly

5. **Monitor app usage**
   - Check Slack app audit logs
   - Review which channels the bot accesses

## Integration Benefits

### Separation of Concerns
- Slack logic is isolated in dedicated files
- Easy to maintain and update
- No coupling with other MCP servers

### Type Safety
- Full TypeScript support
- Validated configuration objects
- Type-safe tool definitions

### User Experience
- Step-by-step setup guide
- Real-time validation feedback
- Helpful error messages
- Direct links to Slack API docs

### AI Awareness
- Comprehensive system prompts
- Tool usage examples
- Best practices guidance
- Context-aware suggestions

## Future Enhancements

Potential improvements for the Slack integration:

- [ ] File upload support
- [ ] Message editing and deletion
- [ ] Custom emoji support
- [ ] User presence detection
- [ ] Scheduled messages
- [ ] Message search
- [ ] Workspace analytics
- [ ] Integration with Slack workflows

## Support

For issues or questions:
- Check [Slack API Documentation](https://api.slack.com/)
- Review [MCP Slack Server](https://www.npmjs.com/package/@modelcontextprotocol/server-slack)
- Open an issue in the repository
- Contact support team

## Related Documentation

- [GitHub MCP Setup](./GITHUB_MCP_SETUP.md)
- [MCP Feature Overview](./MCP_FEATURE.md)
- [MCP Tool Calling Integration](./MCP_TOOL_CALLING_INTEGRATION.md)
