# GitHub MCP Server Setup Guide

## Overview

The GitHub MCP server enables LLMs to interact with GitHub repositories, issues, pull requests, and more through a standardized interface. This guide shows you how to set it up and use it.

## Prerequisites

1. **GitHub Account** with access to repositories you want the AI to interact with
2. **GitHub Personal Access Token** with appropriate permissions
3. **MCP Feature Enabled** in your app settings

## Setup Instructions

### Step 1: Create a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give your token a descriptive name (e.g., "AI Chat MCP")
4. Set expiration (recommend: 90 days for security)
5. Select the following scopes:
   - ✅ `repo` - Full control of private repositories
   - ✅ `read:org` - Read org and team membership
   - ✅ `read:user` - Read user profile data
   - ✅ `user:email` - Access user email addresses
   - ✅ `workflow` - Update GitHub Action workflows (if needed)

6. Click "Generate token"
7. **IMPORTANT**: Copy the token immediately (starts with `ghp_`)
8. Store it securely - you won't be able to see it again!

### Step 2: Configure the MCP Server

1. Navigate to **Settings** in your app
2. Scroll to **MCP Servers** section
3. Toggle **"Enable MCP Servers"** ON
4. Click **"Show Presets"**
5. Find **"GitHub"** in the preset list
6. Click **"Add"** to add the GitHub server

### Step 3: Add Your GitHub Token

1. Find the newly added **GitHub** server in the list
2. Click **"Edit"**
3. Scroll to **Environment Variables** field
4. You'll see:
   ```json
   {
     "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
   }
   ```
5. Replace `ghp_YOUR_TOKEN_HERE` with your actual token:
   ```json
   {
     "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   }
   ```
6. Click **"Update Server"**

### Step 4: Enable the Server

1. Find the GitHub server in your server list
2. Click the **"Enabled"** button (should turn green)
3. The server will automatically connect

### Step 5: Verify Connection

1. Go to **Dashboard**
2. Look for the **MCP indicator** in the header (e.g., `MCP: 1/1 (X tools)`)
3. Click the indicator to expand
4. You should see:
   - ✅ Green dot next to "GitHub"
   - List of available tools
   - Connection status

## Available Tools

The GitHub MCP server provides these tools:

### Repository Tools
- **`create_repository`** - Create a new GitHub repository
- **`get_file_contents`** - Read file contents from a repository
- **`push_files`** - Commit and push changes to a repository
- **`search_repositories`** - Search for repositories
- **`create_or_update_file`** - Create or update a single file
- **`search_code`** - Search for code across repositories
- **`fork_repository`** - Fork a repository

### Issue Tools
- **`create_issue`** - Create a new issue
- **`update_issue`** - Update an existing issue
- **`add_issue_comment`** - Comment on an issue
- **`search_issues`** - Search for issues and pull requests
- **`list_issues`** - List issues in a repository
- **`get_issue`** - Get details of a specific issue

### Pull Request Tools
- **`create_pull_request`** - Create a new pull request
- **`merge_pull_request`** - Merge a pull request
- **`list_commits`** - List commits in a repository
- **`list_pull_requests`** - List PRs in a repository

## Usage Examples

### Example 1: Ask the AI to Search GitHub

```
"Search GitHub for popular React chart libraries"
```

The AI will use the `search_repositories` tool to find relevant repositories.

### Example 2: Read Repository Files

```
"Show me the README.md from facebook/react repository"
```

The AI will use `get_file_contents` to fetch and display the file.

### Example 3: Create an Issue

```
"Create an issue in my repo username/project about fixing the login bug"
```

The AI will use `create_issue` to create the issue with appropriate details.

### Example 4: List Open Issues

```
"What are the open issues in microsoft/vscode?"
```

The AI will use `list_issues` or `search_issues` to show current issues.

### Example 5: Search Code

```
"Find examples of useState hooks in the facebook/react codebase"
```

The AI will use `search_code` to find relevant code examples.

## How It Works

### Architecture

```
Browser Client
    ↓
MCP Client (mcpClient.ts)
    ↓
Backend API Proxy (/api/mcp/stdio)
    ↓
GitHub MCP Server (stdio subprocess)
    ↓
GitHub API
```

1. **Browser** makes request to MCP client
2. **MCP Client** detects stdio server, proxies to backend
3. **Backend** spawns GitHub MCP server subprocess
4. **MCP Server** makes GitHub API calls
5. **Results** flow back through the chain

### Security

- ✅ Token stored in browser localStorage
- ✅ Token sent to backend only during requests
- ✅ Backend validates all requests
- ✅ Server runs in isolated subprocess
- ⚠️ Token visible in DevTools (client-side storage)

## Troubleshooting

### "Server not connected" Error

**Check:**
1. MCP feature is enabled
2. GitHub server is enabled (green button)
3. Token is correctly configured
4. Token has not expired
5. Check browser console for errors

**Solution:**
- Go to Settings → MCP Servers
- Click "Edit" on GitHub server
- Verify token starts with `ghp_`
- Click "Disabled" then "Enabled" to reconnect

### "Authentication failed" Error

**Cause:** Invalid or expired token

**Solution:**
1. Generate a new token on GitHub
2. Update the token in server settings
3. Disable and re-enable the server

### Tools Not Showing

**Check:**
1. Server status is "connected" (green dot)
2. Expand MCP indicator to see tool list
3. Check console for connection errors

**Solution:**
- Refresh the page
- Disconnect and reconnect the server
- Check backend logs for errors

### "Permission denied" Errors

**Cause:** Token doesn't have required scopes

**Solution:**
1. Go to GitHub token settings
2. Edit the token
3. Add missing scopes (repo, read:org, etc.)
4. Update token in server settings
5. Reconnect the server

## Best Practices

### Token Security

1. **Use minimal scopes** - Only grant permissions you need
2. **Set expiration** - Use 90-day tokens and rotate regularly
3. **Don't share tokens** - Each user should have their own
4. **Revoke if compromised** - Immediately revoke exposed tokens
5. **Use fine-grained tokens** (coming soon) for better security

### Rate Limiting

GitHub API has rate limits:
- **Authenticated**: 5,000 requests/hour
- **Search API**: 30 requests/minute

The AI will be informed of rate limits and work within them.

### Repository Access

- Token grants access based on your GitHub permissions
- Private repos require `repo` scope
- Organization repos require appropriate org membership

## Advanced Configuration

### Custom GitHub Enterprise

If using GitHub Enterprise, edit the server configuration:

```json
{
  "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token",
  "GITHUB_API_URL": "https://github.your-company.com/api/v3"
}
```

### Proxy Settings

If behind a corporate proxy, add:

```json
{
  "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token",
  "HTTP_PROXY": "http://proxy.company.com:8080",
  "HTTPS_PROXY": "http://proxy.company.com:8080"
}
```

## Integration with LLM (Coming Soon)

### Current Status
- ✅ Server connection working
- ✅ Tool discovery working
- ✅ Tool execution working
- ⏳ LLM tool calling integration pending

### Next Steps
When tool calling is integrated, the AI will:
1. Analyze your question
2. Determine which GitHub tools to use
3. Call tools with appropriate parameters
4. Format results for you
5. Continue conversation with context

## Example Conversations (Future)

Once integrated, you'll be able to have conversations like:

```
You: "What are the most starred Python repositories created this year?"

AI: Let me search GitHub for that.
[Calls search_repositories with appropriate filters]
Here are the top 5 most starred Python repositories from 2025:
1. username/project - 45.2k stars - ML framework
2. ...
```

```
You: "Create a new repository called 'my-app' and add a README"

AI: I'll create that repository for you.
[Calls create_repository]
[Calls create_or_update_file for README.md]
Done! Your repository is ready at github.com/username/my-app
```

## Resources

- GitHub Personal Access Tokens: https://github.com/settings/tokens
- GitHub API Documentation: https://docs.github.com/en/rest
- MCP GitHub Server: https://github.com/modelcontextprotocol/servers/tree/main/src/github
- Token Permissions Guide: https://docs.github.com/en/developers/apps/scopes-for-oauth-apps

## Support

If you encounter issues:

1. Check this guide first
2. Verify token permissions on GitHub
3. Check browser console for errors
4. Check MCP server status in dashboard
5. Try disconnecting and reconnecting
6. Generate a new token if needed

## Security Notice

⚠️ **Important**: Your GitHub token provides access to your repositories.

- Keep it secure
- Don't share it
- Revoke if compromised
- Use minimal required scopes
- Rotate regularly

The token is stored in your browser's localStorage and only used for GitHub API calls through the MCP server.
