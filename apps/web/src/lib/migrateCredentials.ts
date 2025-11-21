/**
 * MCP Credentials Migration Utility
 *
 * Migrates MCP server credentials from localStorage to encrypted database storage.
 * This is a one-time migration for Phase 1 security implementation.
 *
 * Usage:
 * 1. User must be authenticated (next-auth session)
 * 2. Call migrateMCPCredentials() from browser console or settings page
 * 3. Credentials are encrypted and saved to database
 * 4. localStorage is cleared after successful migration
 */

import type { MCPServerConfig } from "./mcpStorage";

export type MigrationResult = {
  success: boolean;
  migrated: number;
  failed: number;
  errors: string[];
  details: {
    serverId: string;
    serverName: string;
    success: boolean;
    error?: string;
  }[];
};

/**
 * Migrate MCP credentials from localStorage to encrypted database
 */
export async function migrateMCPCredentials(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migrated: 0,
    failed: 0,
    errors: [],
    details: [],
  };

  try {
    // 1. Read servers from localStorage
    const serversJson = localStorage.getItem("mcp_servers");
    if (!serversJson) {
      console.log("[Migration] No MCP servers found in localStorage");
      result.success = true;
      return result;
    }

    const servers: MCPServerConfig[] = JSON.parse(serversJson);

    if (!Array.isArray(servers) || servers.length === 0) {
      console.log("[Migration] No servers to migrate");
      result.success = true;
      return result;
    }

    console.log(`[Migration] Found ${servers.length} servers to migrate`);

    // 2. Migrate each server
    for (const server of servers) {
      try {
        // Build config object with sensitive data
        const config: any = {};

        // Add environment variables if present
        if (server.env && Object.keys(server.env).length > 0) {
          config.env = server.env;
        }

        // Skip if no sensitive data to migrate
        if (Object.keys(config).length === 0) {
          console.log(`[Migration] Skipping ${server.name} - no credentials`);
          result.details.push({
            serverId: server.id,
            serverName: server.name,
            success: true,
          });
          continue;
        }

        // Save to database via API
        const response = await fetch("/api/mcp/credentials", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serverId: server.id,
            serverName: server.name,
            serverType: server.type,
            config,
            enabled: server.enabled !== undefined ? server.enabled : false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || `HTTP ${response.status}`;

          // If server already exists, that's okay
          if (response.status === 409) {
            console.log(`[Migration] ${server.name} already exists in database`);
            result.details.push({
              serverId: server.id,
              serverName: server.name,
              success: true,
            });
            result.migrated++;
            continue;
          }

          throw new Error(errorMsg);
        }

        console.log(`[Migration] ✓ Migrated ${server.name}`);
        result.migrated++;
        result.details.push({
          serverId: server.id,
          serverName: server.name,
          success: true,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Migration] ✗ Failed to migrate ${server.name}:`, errorMsg);

        result.failed++;
        result.errors.push(`${server.name}: ${errorMsg}`);
        result.details.push({
          serverId: server.id,
          serverName: server.name,
          success: false,
          error: errorMsg,
        });
      }
    }

    // 3. Clear localStorage if all migrations successful
    if (result.failed === 0 && result.migrated > 0) {
      console.log("[Migration] All servers migrated successfully");
      console.log("[Migration] Clearing localStorage...");

      // Keep the servers list but remove sensitive env vars
      const sanitizedServers = servers.map((server) => ({
        ...server,
        env: {}, // Clear environment variables
      }));

      localStorage.setItem("mcp_servers", JSON.stringify(sanitizedServers));
      console.log("[Migration] ✓ localStorage sanitized");

      result.success = true;
    } else if (result.failed > 0) {
      console.warn(
        `[Migration] Some migrations failed (${result.failed}/${servers.length})`
      );
      result.success = false;
    } else {
      result.success = true;
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Migration] Fatal error:", errorMsg);

    result.success = false;
    result.errors.push(`Fatal error: ${errorMsg}`);
    return result;
  }
}

/**
 * Check if migration is needed
 */
export function needsMigration(): boolean {
  try {
    const serversJson = localStorage.getItem("mcp_servers");
    if (!serversJson) return false;

    const servers: MCPServerConfig[] = JSON.parse(serversJson);
    if (!Array.isArray(servers)) return false;

    // Check if any server has environment variables (credentials)
    return servers.some(
      (server) => server.env && Object.keys(server.env).length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(): {
  needsMigration: boolean;
  serverCount: number;
  serversWithCredentials: number;
} {
  try {
    const serversJson = localStorage.getItem("mcp_servers");
    if (!serversJson) {
      return {
        needsMigration: false,
        serverCount: 0,
        serversWithCredentials: 0,
      };
    }

    const servers: MCPServerConfig[] = JSON.parse(serversJson);
    if (!Array.isArray(servers)) {
      return {
        needsMigration: false,
        serverCount: 0,
        serversWithCredentials: 0,
      };
    }

    const serversWithCredentials = servers.filter(
      (server) => server.env && Object.keys(server.env).length > 0
    ).length;

    return {
      needsMigration: serversWithCredentials > 0,
      serverCount: servers.length,
      serversWithCredentials,
    };
  } catch {
    return {
      needsMigration: false,
      serverCount: 0,
      serversWithCredentials: 0,
    };
  }
}

/**
 * Manual rollback - restore credentials from database to localStorage
 * Use this only if you need to rollback the migration
 */
export async function rollbackMigration(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Fetch credentials from database
    const response = await fetch("/api/mcp/credentials");

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch credentials");
    }

    const data = await response.json();
    const servers = data.servers || [];

    if (servers.length === 0) {
      console.log("[Rollback] No servers in database to restore");
      return { success: true };
    }

    // Read existing localStorage servers
    const existingJson = localStorage.getItem("mcp_servers");
    const existing: MCPServerConfig[] = existingJson
      ? JSON.parse(existingJson)
      : [];

    // Merge with database credentials
    const merged = existing.map((server) => {
      const dbServer = servers.find((s: any) => s.id === server.id);
      if (dbServer) {
        return {
          ...server,
          env: dbServer.env || {},
          enabled: dbServer.enabled,
        };
      }
      return server;
    });

    // Add any servers that exist in DB but not in localStorage
    for (const dbServer of servers) {
      if (!merged.find((s) => s.id === dbServer.id)) {
        merged.push({
          id: dbServer.id,
          name: dbServer.name,
          type: dbServer.type,
          command: dbServer.type === "stdio" ? "npx" : undefined,
          args: [],
          env: dbServer.env || {},
          enabled: dbServer.enabled,
        } as MCPServerConfig);
      }
    }

    localStorage.setItem("mcp_servers", JSON.stringify(merged));
    console.log(`[Rollback] ✓ Restored ${servers.length} servers to localStorage`);

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Rollback] Error:", errorMsg);
    return { success: false, error: errorMsg };
  }
}
