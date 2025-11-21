/**
 * MCP Stdio Proxy API Route
 *
 * Provides a backend proxy for stdio-based MCP servers.
 * Allows browser clients to connect to stdio MCP servers via HTTP.
 *
 * POST /api/mcp/stdio
 * Body: {
 *   action: "connect" | "disconnect" | "request",
 *   serverId: string,
 *   config?: MCPServerConfig,  // for connect
 *   method?: string,            // for request
 *   params?: any                // for request
 * }
 */

import { NextResponse } from "next/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import {
  validateMCPCommand,
  sanitizeEnvironment,
  logSecurityEvent
} from "@/lib/mcpCommandValidator";
import { strictRatelimit, rateLimitErrorResponse } from "@/lib/ratelimit";

// Store active connections
// In production, use Redis or similar for multi-instance deployments
const connections = new Map<string, Client>();

export async function POST(request: Request) {
  // SECURITY: Require authentication
  const authResult = await getAuthenticatedUser(request);

  if (authResult.error || !authResult.user) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  const userId = authResult.user.id; // Use Supabase user ID

  // SECURITY: Rate limiting - 3 requests per minute for MCP operations
  const rateLimitResult = strictRatelimit(`mcp_stdio_${userId}`);
  if (!rateLimitResult.success) {
    console.log(`[Rate Limit] User ${userId} exceeded rate limit`);
    return NextResponse.json(
      rateLimitErrorResponse(rateLimitResult),
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  try {
    const body = await request.json();
    const { action, serverId, config, method, params } = body;

    // SECURITY: Scope serverId to user to prevent cross-user access
    const scopedServerId = `${userId}:${serverId}`;

    switch (action) {
      case "connect": {
        if (!config) {
          return NextResponse.json(
            { error: "Server config required for connect" },
            { status: 400 }
          );
        }

        // SECURITY: Validate command and arguments
        const validationResult = validateMCPCommand(
          config.command,
          config.args || []
        );

        if (!validationResult.valid) {
          // Log security event
          logSecurityEvent({
            type: "COMMAND_VALIDATION_FAILED",
            userId,
            command: config.command,
            args: config.args || [],
            error: validationResult.error,
          });

          return NextResponse.json(
            { error: `Command validation failed: ${validationResult.error}` },
            { status: 400 }
          );
        }

        // Log successful validation
        logSecurityEvent({
          type: "COMMAND_VALIDATED",
          userId,
          command: config.command,
          args: config.args || [],
        });

        // Check if already connected
        if (connections.has(scopedServerId)) {
          const client = connections.get(scopedServerId)!;
          // Return existing connection info
          const tools = await client.listTools().catch(() => ({ tools: [] }));
          const resources = await client.listResources().catch(() => ({ resources: [] }));
          const prompts = await client.listPrompts().catch(() => ({ prompts: [] }));

          return NextResponse.json({
            success: true,
            capabilities: {
              tools: tools.tools,
              resources: resources.resources,
              prompts: prompts.prompts,
            },
          });
        }

        // Create new client
        const client = new Client(
          {
            name: "ai-chat-app-backend",
            version: "1.0.0",
          },
          {
            capabilities: {
              roots: { listChanged: true },
              sampling: {},
            },
          }
        );

        // SECURITY: Sanitize environment variables
        const sanitizedEnv = sanitizeEnvironment(
          config.name || serverId,
          config.env || {}
        );

        // Windows-specific: Use npx.cmd instead of npx
        const command = process.platform === 'win32' && validationResult.sanitized!.command === 'npx'
          ? 'npx.cmd'
          : validationResult.sanitized!.command;

        // Create stdio transport with validated command and sanitized environment
        const transport = new StdioClientTransport({
          command,
          args: validationResult.sanitized!.args,
          env: sanitizedEnv,
        });

        // Connect
        await client.connect(transport);

        // Store connection with scoped ID
        connections.set(scopedServerId, client);

        // Get capabilities
        const tools = await client.listTools().catch(() => ({ tools: [] }));
        const resources = await client.listResources().catch(() => ({ resources: [] }));
        const prompts = await client.listPrompts().catch(() => ({ prompts: [] }));

        return NextResponse.json({
          success: true,
          capabilities: {
            tools: tools.tools,
            resources: resources.resources,
            prompts: prompts.prompts,
          },
        });
      }

      case "disconnect": {
        const client = connections.get(scopedServerId);
        if (client) {
          await client.close();
          connections.delete(scopedServerId);
        }

        return NextResponse.json({ success: true });
      }

      case "request": {
        const client = connections.get(scopedServerId);
        if (!client) {
          return NextResponse.json(
            { error: "Server not connected" },
            { status: 404 }
          );
        }

        if (!method) {
          return NextResponse.json(
            { error: "Method required for request" },
            { status: 400 }
          );
        }

        // Handle different request types
        let result;
        switch (method) {
          case "tools/list":
            result = await client.listTools();
            break;

          case "tools/call":
            if (!params || !params.name) {
              return NextResponse.json(
                { error: "Tool name required" },
                { status: 400 }
              );
            }
            result = await client.callTool({
              name: params.name,
              arguments: params.arguments || {},
            });
            break;

          case "resources/list":
            result = await client.listResources();
            break;

          case "resources/read":
            if (!params || !params.uri) {
              return NextResponse.json(
                { error: "Resource URI required" },
                { status: 400 }
              );
            }
            result = await client.readResource({ uri: params.uri });
            break;

          case "prompts/list":
            result = await client.listPrompts();
            break;

          case "prompts/get":
            if (!params || !params.name) {
              return NextResponse.json(
                { error: "Prompt name required" },
                { status: 400 }
              );
            }
            result = await client.getPrompt({
              name: params.name,
              arguments: params.arguments,
            });
            break;

          default:
            return NextResponse.json(
              { error: `Unknown method: ${method}` },
              { status: 400 }
            );
        }

        return NextResponse.json({ success: true, result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[MCP Stdio Proxy] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Cleanup on server shutdown
process.on("SIGTERM", async () => {
  console.log("[MCP Stdio Proxy] Shutting down, closing connections...");
  for (const [serverId, client] of connections.entries()) {
    try {
      await client.close();
      console.log(`[MCP Stdio Proxy] Closed connection: ${serverId}`);
    } catch (error) {
      console.error(`[MCP Stdio Proxy] Error closing ${serverId}:`, error);
    }
  }
  connections.clear();
});
