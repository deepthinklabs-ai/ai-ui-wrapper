/**
 * MCP Client Manager
 *
 * Manages connections to MCP servers and provides tool execution capabilities.
 * Handles both stdio and SSE transport types.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { MCPServerConfig } from "./mcpStorage";

export type MCPTool = {
  name: string;
  description?: string;
  inputSchema: any;
};

export type MCPResource = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

export type MCPPrompt = {
  name: string;
  description?: string;
  arguments?: any[];
};

export type MCPServerCapabilities = {
  tools?: MCPTool[];
  resources?: MCPResource[];
  prompts?: MCPPrompt[];
};

export type MCPConnection = {
  serverId: string;
  serverName: string;
  serverType: "stdio" | "sse"; // Track server type explicitly
  client: Client;
  capabilities: MCPServerCapabilities;
  status: "connected" | "disconnected" | "error";
  error?: string;
};

class MCPClientManager {
  private connections: Map<string, MCPConnection> = new Map();

  /**
   * Connect to an MCP server
   */
  async connect(config: MCPServerConfig): Promise<MCPConnection> {
    // Check if already connected
    if (this.connections.has(config.id)) {
      const existing = this.connections.get(config.id)!;
      if (existing.status === "connected") {
        return existing;
      }
      // Clean up failed connection
      await this.disconnect(config.id);
    }

    try {
      const client = new Client(
        {
          name: "ai-chat-app",
          version: "1.0.0",
        },
        {
          capabilities: {
            // Request all capabilities
            roots: { listChanged: true },
            sampling: {},
          },
        }
      );

      let transport;

      if (config.type === "stdio") {
        if (!config.command) {
          throw new Error("Command is required for stdio transport");
        }

        // Use backend proxy for stdio transport
        const response = await fetch("/api/mcp/stdio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "connect",
            serverId: config.id,
            config: {
              command: config.command,
              args: config.args,
              env: config.env,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to connect to MCP server");
        }

        const data = await response.json();

        // For stdio via proxy, we don't have a real client connection
        // Instead, we'll make requests through the proxy
        const connection: MCPConnection = {
          serverId: config.id,
          serverName: config.name,
          serverType: "stdio",
          client,
          capabilities: data.capabilities || {},
          status: "connected",
        };

        this.connections.set(config.id, connection);
        return connection;
      } else if (config.type === "sse") {
        if (!config.url) {
          throw new Error("URL is required for SSE transport");
        }

        transport = new SSEClientTransport(new URL(config.url));
      } else {
        throw new Error(`Unsupported transport type: ${config.type}`);
      }

      await client.connect(transport);

      // Get server capabilities
      const tools = await client.listTools().catch(() => ({ tools: [] }));
      const resources = await client.listResources().catch(() => ({ resources: [] }));
      const prompts = await client.listPrompts().catch(() => ({ prompts: [] }));

      const connection: MCPConnection = {
        serverId: config.id,
        serverName: config.name,
        serverType: config.type,
        client,
        capabilities: {
          tools: tools.tools,
          resources: resources.resources,
          prompts: prompts.prompts,
        },
        status: "connected",
      };

      this.connections.set(config.id, connection);
      return connection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const connection: MCPConnection = {
        serverId: config.id,
        serverName: config.name,
        serverType: config.type,
        client: new Client({ name: "ai-chat-app", version: "1.0.0" }, { capabilities: {} }),
        capabilities: {},
        status: "error",
        error: errorMessage,
      };

      this.connections.set(config.id, connection);
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    try {
      await connection.client.close();
    } catch (error) {
      console.error(`Error disconnecting from server ${serverId}:`, error);
    }

    this.connections.delete(serverId);
  }

  /**
   * Get a connected server
   */
  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId);
  }

  /**
   * Get all connections
   */
  getAllConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get all available tools from connected servers
   */
  getAllTools(): Array<MCPTool & { serverId: string; serverName: string }> {
    const tools: Array<MCPTool & { serverId: string; serverName: string }> = [];

    for (const connection of this.connections.values()) {
      if (connection.status === "connected" && connection.capabilities.tools) {
        for (const tool of connection.capabilities.tools) {
          tools.push({
            ...tool,
            serverId: connection.serverId,
            serverName: connection.serverName,
          });
        }
      }
    }

    return tools;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    const connection = this.connections.get(serverId);

    if (!connection) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    if (connection.status !== "connected") {
      throw new Error(`Server ${serverId} is not in connected state`);
    }

    try {
      // Check if this is a stdio server (proxied through backend)
      // We can tell by checking if tools came from backend proxy
      const isStdioProxy = connection.capabilities.tools &&
                          !connection.client._transport;

      if (isStdioProxy) {
        // Use backend proxy for stdio servers
        const response = await fetch("/api/mcp/stdio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request",
            serverId,
            method: "tools/call",
            params: {
              name: toolName,
              arguments: args,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to call tool");
        }

        const data = await response.json();
        return data.result;
      } else {
        // Direct call for SSE servers
        const result = await connection.client.callTool({
          name: toolName,
          arguments: args,
        });

        return result;
      }
    } catch (error) {
      console.error(`Error calling tool ${toolName} on server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Read a resource from a server
   */
  async readResource(serverId: string, uri: string): Promise<any> {
    const connection = this.connections.get(serverId);

    if (!connection) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    if (connection.status !== "connected") {
      throw new Error(`Server ${serverId} is not in connected state`);
    }

    try {
      const result = await connection.client.readResource({ uri });
      return result;
    } catch (error) {
      console.error(`Error reading resource ${uri} from server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(serverId =>
      this.disconnect(serverId)
    );

    await Promise.all(disconnectPromises);
  }
}

// Export singleton instance
export const mcpClientManager = new MCPClientManager();
