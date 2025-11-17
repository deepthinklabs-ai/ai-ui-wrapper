/**
 * MCP Servers Hook
 *
 * React hook for managing MCP server connections and state.
 * Handles connection lifecycle, tool discovery, and execution.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMCPServers,
  getEnabledMCPServers,
  isMCPEnabled,
  updateLastConnected,
  type MCPServerConfig,
} from "@/lib/mcpStorage";
import {
  mcpClientManager,
  type MCPConnection,
  type MCPTool,
} from "@/lib/mcpClient";

type UseMCPServersResult = {
  servers: MCPServerConfig[];
  connections: MCPConnection[];
  tools: Array<MCPTool & { serverId: string; serverName: string }>;
  isEnabled: boolean;
  isConnecting: boolean;
  connectServer: (serverId: string) => Promise<void>;
  disconnectServer: (serverId: string) => Promise<void>;
  connectAllEnabled: () => Promise<void>;
  disconnectAll: () => Promise<void>;
  callTool: (serverId: string, toolName: string, args: Record<string, any>) => Promise<any>;
  refreshServers: () => void;
  getServerStatus: (serverId: string) => "connected" | "disconnected" | "error" | "connecting";
};

export function useMCPServers(): UseMCPServersResult {
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [tools, setTools] = useState<Array<MCPTool & { serverId: string; serverName: string }>>([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingServers, setConnectingServers] = useState<Set<string>>(new Set());

  // Track if this instance should stay connected
  const shouldStayConnectedRef = useRef(true);
  const hasConnectedRef = useRef(false);

  // Load servers and enabled state
  const refreshServers = useCallback(() => {
    const loadedServers = getMCPServers();
    const mcpEnabled = isMCPEnabled();
    console.log('[MCP Debug] Servers loaded:', loadedServers.length, 'MCP Enabled:', mcpEnabled);
    setServers(loadedServers);
    setIsEnabled(mcpEnabled);
  }, []);

  useEffect(() => {
    refreshServers();
  }, [refreshServers]);

  // Update connections and tools when they change
  const refreshConnections = useCallback(() => {
    const allConnections = mcpClientManager.getAllConnections();
    setConnections(allConnections);

    const allTools = mcpClientManager.getAllTools();
    setTools(allTools);
  }, []);

  // Connect to a specific server
  const connectServer = useCallback(async (serverId: string) => {
    const server = getMCPServers().find(s => s.id === serverId);
    if (!server) {
      console.error(`Server ${serverId} not found`);
      return;
    }

    setConnectingServers(prev => new Set(prev).add(serverId));
    setIsConnecting(true);

    try {
      await mcpClientManager.connect(server);
      updateLastConnected(serverId);
      refreshConnections();
      console.log(`[MCP] Connected to server: ${server.name}`);
    } catch (error) {
      console.error(`[MCP] Failed to connect to server ${server.name}:`, error);
      refreshConnections(); // Update to show error state
    } finally {
      setConnectingServers(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
      setIsConnecting(false);
    }
  }, [refreshConnections]);

  // Disconnect from a specific server
  const disconnectServer = useCallback(async (serverId: string) => {
    try {
      await mcpClientManager.disconnect(serverId);
      refreshConnections();
      console.log(`[MCP] Disconnected from server: ${serverId}`);
    } catch (error) {
      console.error(`[MCP] Error disconnecting from server ${serverId}:`, error);
    }
  }, [refreshConnections]);

  // Connect to all enabled servers
  const connectAllEnabled = useCallback(async () => {
    if (!isMCPEnabled()) {
      console.log("[MCP] MCP feature is disabled");
      return;
    }

    const enabledServers = getEnabledMCPServers();
    if (enabledServers.length === 0) {
      console.log("[MCP] No enabled servers to connect");
      return;
    }

    setIsConnecting(true);
    console.log(`[MCP] Connecting to ${enabledServers.length} enabled servers...`);

    const connectPromises = enabledServers.map(server =>
      connectServer(server.id).catch(error => {
        console.error(`[MCP] Failed to connect to ${server.name}:`, error);
      })
    );

    await Promise.all(connectPromises);
    setIsConnecting(false);
  }, [connectServer]);

  // Disconnect all servers
  const disconnectAll = useCallback(async () => {
    try {
      await mcpClientManager.disconnectAll();
      refreshConnections();
      console.log("[MCP] Disconnected from all servers");
    } catch (error) {
      console.error("[MCP] Error disconnecting from all servers:", error);
    }
  }, [refreshConnections]);

  // Call a tool on a specific server
  const callTool = useCallback(
    async (serverId: string, toolName: string, args: Record<string, any>) => {
      try {
        const result = await mcpClientManager.callTool(serverId, toolName, args);
        console.log(`[MCP] Tool ${toolName} called successfully on server ${serverId}`);
        return result;
      } catch (error) {
        console.error(`[MCP] Error calling tool ${toolName} on server ${serverId}:`, error);
        throw error;
      }
    },
    []
  );

  // Get status of a specific server
  const getServerStatus = useCallback((serverId: string): "connected" | "disconnected" | "error" | "connecting" => {
    if (connectingServers.has(serverId)) {
      return "connecting";
    }

    const connection = connections.find(c => c.serverId === serverId);
    if (!connection) {
      return "disconnected";
    }

    return connection.status === "connected" ? "connected" :
           connection.status === "error" ? "error" : "disconnected";
  }, [connections, connectingServers]);

  // Auto-connect to enabled servers when MCP is enabled
  useEffect(() => {
    if (isEnabled && !hasConnectedRef.current) {
      console.log('[MCP] MCP enabled, auto-connecting to enabled servers...');
      shouldStayConnectedRef.current = true;

      const connect = async () => {
        if (!isMCPEnabled()) {
          console.log("[MCP] MCP feature is disabled");
          return;
        }

        const enabledServers = getEnabledMCPServers();
        if (enabledServers.length === 0) {
          console.log("[MCP] No enabled servers to connect");
          return;
        }

        setIsConnecting(true);
        console.log(`[MCP] Connecting to ${enabledServers.length} enabled servers...`);

        for (const server of enabledServers) {
          if (!shouldStayConnectedRef.current) break;
          try {
            await connectServer(server.id);
          } catch (error) {
            console.error(`[MCP] Failed to connect to ${server.name}:`, error);
          }
        }

        if (shouldStayConnectedRef.current) {
          setIsConnecting(false);
          hasConnectedRef.current = true;
        }
      };

      connect();
    }

    // Only disconnect if MCP is disabled
    if (!isEnabled && hasConnectedRef.current) {
      console.log('[MCP] MCP disabled, disconnecting...');
      shouldStayConnectedRef.current = false;
      disconnectAll();
      hasConnectedRef.current = false;
    }
  }, [isEnabled, connectServer, disconnectAll]); // Depend on isEnabled

  // Clean up stale connections when servers change
  useEffect(() => {
    const enabledServerIds = new Set(servers.filter(s => s.enabled).map(s => s.id));
    const connectedServerIds = new Set(connections.map(c => c.serverId));

    // Disconnect servers that are no longer enabled or were removed
    for (const connectedId of connectedServerIds) {
      if (!enabledServerIds.has(connectedId)) {
        console.log(`[MCP] Disconnecting removed/disabled server: ${connectedId}`);
        disconnectServer(connectedId);
      }
    }

    // Refresh connections after cleanup
    refreshConnections();
  }, [servers, connections.length]); // Run when servers list changes

  // Cleanup only on true unmount
  useEffect(() => {
    return () => {
      // Only disconnect if we're truly unmounting (not a React Strict Mode remount)
      const timeoutId = setTimeout(() => {
        if (!shouldStayConnectedRef.current) {
          console.log('[MCP] Component truly unmounting, disconnecting...');
          disconnectAll();
        }
      }, 200);

      return () => clearTimeout(timeoutId);
    };
  }, [disconnectAll]);

  return {
    servers,
    connections,
    tools,
    isEnabled,
    isConnecting,
    connectServer,
    disconnectServer,
    connectAllEnabled,
    disconnectAll,
    callTool,
    refreshServers,
    getServerStatus,
  };
}
