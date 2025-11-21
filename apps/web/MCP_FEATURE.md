# MCP (Model Context Protocol) Integration

## Overview
This feature integrates Model Context Protocol (MCP) servers into the AI chat application, allowing LLMs to access external tools, resources, and capabilities through standardized MCP servers.

## What is MCP?

Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to LLMs. It enables:

- **Tools**: Functions the AI can call (e.g., file operations, web search, database queries)
- **Resources**: Data sources the AI can read (e.g., files, documentation, APIs)
- **Prompts**: Pre-configured prompt templates

## Architecture

### Core Files

#### Storage Layer
- **`src/lib/mcpStorage.ts`** - LocalStorage management for MCP configurations
  - Server configuration CRUD operations
  - Global enable/disable state
  - Preset server definitions
  - Validation logic

#### Connection Layer
- **`src/lib/mcpClient.ts`** - MCP client connection manager
  - Singleton manager for all MCP connections
  - Support for stdio and SSE transports
  - Tool discovery and execution
  - Resource reading
  - Connection lifecycle management

#### React Integration
- **`src/hooks/useMCPServers.ts`** - React hook for MCP state management
  - Server connection state
  - Auto-connect on mount
  - Tool listing
  - Server status tracking

#### UI Components
- **`src/components/settings/MCPServerSettings.tsx`** - Settings panel
  - Add/edit/delete servers
  - Enable/disable toggle
  - Preset servers gallery
  - Form validation

- **`src/components/dashboard/MCPServerIndicator.tsx`** - Status indicator
  - Connection status display
  - Tool count
  - Expandable server details
  - Real-time updates

## Features

### 1. Server Configuration

Users can configure two types of MCP servers:

#### SSE (Server-Sent Events) Servers
- Browser-compatible
- Connects via HTTP/HTTPS
- Example: `https://your-mcp-server.com/sse`

#### Stdio Servers (Requires Backend Proxy)
- Runs MCP server as subprocess
- Requires Node.js environment
- **Note**: Currently requires backend API proxy for browser apps
- Example: `npx @modelcontextprotocol/server-filesystem`

### 2. Preset Servers

Built-in presets for popular MCP servers:

1. **Filesystem** - Read/write local files
2. **GitHub** - Repository and issue management
3. **Memory** - Persistent conversation memory
4. **Brave Search** - Web search capability
5. **PostgreSQL** - Database queries

### 3. Connection Management

- **Auto-connect**: Enabled servers connect on app load
- **Manual control**: Connect/disconnect individual servers
- **Status tracking**: Connected, disconnected, error states
- **Error handling**: Graceful failure with error messages

### 4. Tool Discovery

- Automatic tool enumeration from connected servers
- Tool metadata (name, description, input schema)
- Grouped by server for organization

## Data Flow

```
1. User configures server in Settings
   ↓
2. Server config saved to localStorage
   ↓
3. On dashboard load, useMCPServers hook:
   - Reads enabled servers
   - Connects to each server
   - Discovers available tools
   ↓
4. Tools become available to LLM
   ↓
5. LLM can call tools via mcpClientManager
   ↓
6. Results returned to conversation
```

## Configuration Storage

### LocalStorage Keys

```typescript
// Global enable/disable
"mcp_enabled": "true" | "false"

// Server configurations array
"mcp_servers": [
  {
    id: "mcp_1234567890_abc123",
    name: "Filesystem",
    description: "Access local files",
    type: "stdio" | "sse",
    enabled: true,
    command: "npx",  // stdio only
    args: ["-y", "@modelcontextprotocol/server-filesystem"],  // stdio only
    env: { "VAR": "value" },  // stdio only
    url: "https://...",  // sse only
    createdAt: "2025-01-01T00:00:00.000Z",
    lastConnected: "2025-01-01T00:00:00.000Z"
  }
]
```

## Usage

### Setup (Settings Page)

1. Navigate to Settings → MCP Servers
2. Toggle "Enable MCP Servers" ON
3. Click "+ Add Server" or "Show Presets"
4. Configure server details:
   - Name and description
   - Transport type (SSE recommended for browser)
   - Connection details (URL for SSE, command for stdio)
5. Click "Add Server"
6. Server will auto-connect on next dashboard load

### Viewing Status (Dashboard)

- MCP indicator shows in header: `MCP: 2/3 (15 tools)`
- Click indicator to expand:
  - See connected servers
  - View available tools per server
  - Check error messages
  - Inspect server capabilities

### Using Tools (Future Integration)

Tools will be available to the LLM through:
1. Automatic tool detection
2. Function calling in API requests
3. Tool execution via `mcpClientManager.callTool()`

## Current Limitations

### ⚠️ Important Notes

1. **Stdio Transport Not Yet Supported in Browser**
   - Stdio servers require Node.js environment
   - Browser apps need backend API proxy
   - Use SSE transport for browser-based servers
   - Stdio support planned for backend integration

2. **Tool Integration Pending**
   - Infrastructure is complete
   - Message flow integration needed
   - Tool calling logic to be implemented
   - Results formatting pending

3. **SSE Servers Only (Currently)**
   - Only SSE-based MCP servers work in browser
   - Stdio servers will error with helpful message
   - Backend proxy needed for stdio support

## API Reference

### mcpClientManager

```typescript
// Connect to a server
await mcpClientManager.connect(serverConfig);

// Disconnect from a server
await mcpClientManager.disconnect(serverId);

// Get all available tools
const tools = mcpClientManager.getAllTools();
// Returns: Array<{ name, description, inputSchema, serverId, serverName }>

// Call a tool
const result = await mcpClientManager.callTool(
  serverId,
  toolName,
  { arg1: "value" }
);

// Read a resource
const resource = await mcpClientManager.readResource(
  serverId,
  "file:///path/to/file"
);

// Disconnect all servers
await mcpClientManager.disconnectAll();
```

### useMCPServers Hook

```typescript
const {
  servers,           // All configured servers
  connections,       // Active connections with status
  tools,             // All available tools
  isEnabled,         // Global MCP feature state
  isConnecting,      // Connection in progress
  connectServer,     // Connect specific server
  disconnectServer,  // Disconnect specific server
  connectAllEnabled, // Connect all enabled servers
  disconnectAll,     // Disconnect everything
  callTool,          // Execute a tool
  refreshServers,    // Reload from storage
  getServerStatus,   // Get status of specific server
} = useMCPServers();
```

## Security Considerations

### ⚠️ Security Warnings

1. **Environment Variables**
   - API keys stored in localStorage (client-side)
   - Visible in browser DevTools
   - Consider backend proxy for sensitive keys

2. **Server Validation**
   - URLs are validated for format
   - Commands are not sanitized
   - Trust only your own MCP servers

3. **CORS Requirements**
   - SSE servers must allow browser origin
   - Configure CORS headers on server
   - Example: `Access-Control-Allow-Origin: *`

## Troubleshooting

### Connection Errors

**"Stdio transport requires backend proxy"**
- You're trying to use stdio in browser
- Switch to SSE transport or configure backend proxy
- Check server type in configuration

**"Server not responding"**
- Verify SSE server URL is correct
- Check server is running and accessible
- Inspect network tab for CORS errors
- Verify server implements MCP protocol correctly

**"Tool not found"**
- Server connected but tool not available
- Check server capabilities in expanded indicator
- Verify tool name spelling
- Some tools require configuration/permissions

### No Servers Showing

- Check if MCP feature is enabled (Settings toggle)
- Verify servers are configured (Settings list)
- Check browser console for errors
- Try refreshing the page

### Tools Not Available

- Ensure server status is "connected"
- Check server implements tools capability
- Verify tool discovery completed
- Look for errors in server details

## Development

### Adding New Preset Servers

Edit `src/lib/mcpStorage.ts`, add to `getPresetServers()`:

```typescript
{
  name: "My Server",
  description: "What it does",
  type: "sse",
  url: "https://my-mcp-server.com/sse",
  enabled: false,
}
```

### Testing MCP Servers

1. Use official MCP servers from `@modelcontextprotocol/*`
2. Deploy SSE servers to public URLs
3. Test with simple servers first (memory, echo)
4. Verify tool discovery in indicator

### Creating Custom MCP Servers

See MCP specification: https://github.com/modelcontextprotocol/specification

Example SSE server structure:
- Implement `/sse` endpoint
- Return tools via `tools/list` method
- Handle `tools/call` requests
- Send responses as Server-Sent Events

## Future Enhancements

### Planned Features

1. **Tool Integration with LLMs**
   - Automatic tool calling in conversations
   - Tool result formatting
   - Multi-step tool workflows

2. **Backend Stdio Support**
   - API proxy for stdio servers
   - Subprocess management
   - Secure environment variable handling

3. **Resource Browser**
   - UI for browsing server resources
   - Resource preview
   - Direct resource insertion

4. **Prompt Templates**
   - Browse available prompts
   - Quick insertion into conversations
   - Prompt customization

5. **Advanced Features**
   - Server health monitoring
   - Usage statistics
   - Tool caching
   - Connection retry logic
   - Server groups/categories

## MCP Ecosystem

### Official Servers

- `@modelcontextprotocol/server-filesystem`
- `@modelcontextprotocol/server-github`
- `@modelcontextprotocol/server-memory`
- `@modelcontextprotocol/server-postgres`
- `@modelcontextprotocol/server-brave-search`
- Many more at: https://github.com/modelcontextprotocol

### Community Servers

Check MCP community for third-party servers providing:
- Cloud service integrations
- Specialized APIs
- Domain-specific tools
- Custom capabilities

## Support & Resources

- MCP Specification: https://github.com/modelcontextprotocol/specification
- Official Servers: https://github.com/modelcontextprotocol
- SDK Documentation: https://github.com/modelcontextprotocol/sdk

## Version History

### v1.0.0 (Current)
- Initial MCP integration
- SSE transport support
- Server configuration UI
- Status indicator
- Preset servers
- Tool discovery
- Connection management

### Upcoming
- Tool execution integration
- Stdio backend proxy
- Resource browser
- Prompt template support
