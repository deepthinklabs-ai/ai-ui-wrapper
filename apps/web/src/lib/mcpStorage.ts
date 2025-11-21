/**
 * MCP Server Storage
 *
 * Manages MCP (Model Context Protocol) server configurations in localStorage.
 * Stores server connection details, enabled/disabled state, and preferences.
 */

const MCP_SERVERS_KEY = "mcp_servers";
const MCP_ENABLED_KEY = "mcp_enabled";

export type MCPServerType = "stdio" | "sse";

export type MCPServerConfig = {
  id: string;
  name: string;
  description?: string;
  type: MCPServerType;
  enabled: boolean;
  // For stdio servers
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // For SSE servers
  url?: string;
  // Metadata
  createdAt: string;
  lastConnected?: string;
};

/**
 * Check if MCP feature is globally enabled
 */
export function isMCPEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const value = localStorage.getItem(MCP_ENABLED_KEY);
  return value === "true";
}

/**
 * Enable or disable MCP feature globally
 */
export function setMCPEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MCP_ENABLED_KEY, enabled ? "true" : "false");
}

/**
 * Get all configured MCP servers
 */
export function getMCPServers(): MCPServerConfig[] {
  if (typeof window === "undefined") return [];

  const value = localStorage.getItem(MCP_SERVERS_KEY);
  if (!value) return [];

  try {
    return JSON.parse(value) as MCPServerConfig[];
  } catch {
    return [];
  }
}

/**
 * Save MCP servers configuration
 */
export function saveMCPServers(servers: MCPServerConfig[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(servers));
}

/**
 * Add a new MCP server
 */
export function addMCPServer(server: Omit<MCPServerConfig, "id" | "createdAt">): MCPServerConfig {
  const servers = getMCPServers();

  const newServer: MCPServerConfig = {
    ...server,
    id: generateServerId(),
    createdAt: new Date().toISOString(),
  };

  servers.push(newServer);
  saveMCPServers(servers);

  return newServer;
}

/**
 * Update an existing MCP server
 */
export function updateMCPServer(id: string, updates: Partial<MCPServerConfig>): void {
  const servers = getMCPServers();
  const index = servers.findIndex(s => s.id === id);

  if (index === -1) return;

  servers[index] = { ...servers[index], ...updates };
  saveMCPServers(servers);
}

/**
 * Delete an MCP server
 */
export function deleteMCPServer(id: string): void {
  const servers = getMCPServers();
  const filtered = servers.filter(s => s.id !== id);
  saveMCPServers(filtered);
}

/**
 * Get enabled MCP servers only
 */
export function getEnabledMCPServers(): MCPServerConfig[] {
  return getMCPServers().filter(s => s.enabled);
}

/**
 * Toggle server enabled state
 */
export function toggleMCPServer(id: string): void {
  const servers = getMCPServers();
  const server = servers.find(s => s.id === id);

  if (!server) return;

  updateMCPServer(id, { enabled: !server.enabled });
}

/**
 * Update last connected timestamp
 */
export function updateLastConnected(id: string): void {
  updateMCPServer(id, { lastConnected: new Date().toISOString() });
}

/**
 * Generate a unique server ID
 */
function generateServerId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate server configuration
 */
export function validateMCPServer(server: Partial<MCPServerConfig>): string[] {
  const errors: string[] = [];

  if (!server.name || server.name.trim() === "") {
    errors.push("Server name is required");
  }

  if (!server.type) {
    errors.push("Server type is required");
  }

  if (server.type === "stdio") {
    if (!server.command || server.command.trim() === "") {
      errors.push("Command is required for stdio servers");
    }
  }

  if (server.type === "sse") {
    if (!server.url || server.url.trim() === "") {
      errors.push("URL is required for SSE servers");
    } else if (!isValidUrl(server.url)) {
      errors.push("Invalid URL format");
    }
  }

  return errors;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get preset MCP server configurations
 */
export function getPresetServers(): Omit<MCPServerConfig, "id" | "createdAt">[] {
  return [
    {
      name: "Filesystem",
      description: "Access local filesystem for reading/writing files",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
      enabled: false,
    },
    {
      name: "GitHub",
      description: "Interact with GitHub repositories, issues, pull requests, and more. Requires GitHub Personal Access Token.",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_YOUR_TOKEN_HERE",
        GITHUB_USERNAME: "your-github-username"
      },
      enabled: false,
    },
    {
      name: "Memory",
      description: "Persistent memory for conversations",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
      enabled: false,
    },
    {
      name: "Brave Search",
      description: "Web search using Brave Search API",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: { BRAVE_API_KEY: "" },
      enabled: false,
    },
    {
      name: "PostgreSQL",
      description: "Query PostgreSQL databases",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
      env: { POSTGRES_CONNECTION_STRING: "" },
      enabled: false,
    },
    {
      name: "Slack",
      description: "Interact with Slack workspace - post messages, reply to threads, add reactions, list channels, and access user information. Requires Slack Bot Token and Team ID.",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
      env: {
        SLACK_BOT_TOKEN: "xoxb-YOUR_BOT_TOKEN_HERE",
        SLACK_TEAM_ID: "T01234567"
      },
      enabled: false,
    },
  ];
}
