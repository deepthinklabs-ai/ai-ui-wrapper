/**
 * @security-audit-requested
 * AUDIT FOCUS: MCP Credentials API Security
 * - Is authentication properly enforced on all routes?
 * - Can users access/modify other users' credentials (IDOR)?
 * - Is rate limiting sufficient to prevent credential stuffing?
 * - Are decrypted credentials exposed in logs or error messages?
 * - Is input validation sufficient (serverName, serverId, config)?
 * - Are there any SQL injection vectors in the queries?
 * - Is the encryption/decryption error handling secure?
 */

/**
 * MCP Credentials API
 *
 * SECURITY: Phase 1 - Encrypted credential storage
 * Manages MCP server credentials in database with AES-256-GCM encryption
 *
 * Routes:
 * - GET /api/mcp/credentials - List user's MCP servers
 * - POST /api/mcp/credentials - Save encrypted credentials
 * - PUT /api/mcp/credentials/:id - Update credentials
 * - DELETE /api/mcp/credentials/:id - Delete credentials
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedSupabaseClient } from "@/lib/serverAuth";
import {
  encryptMCPConfig,
  decryptMCPConfig,
} from "@/lib/credentialEncryption";
import { standardRatelimit, rateLimitErrorResponse } from "@/lib/ratelimit";
import {
  validateMCPServerConfig,
  validateServerName,
  sanitizeString,
} from "@/lib/inputValidation";
import { validateForFeature } from "@/lib/validateEnv";

// Database record type
interface MCPCredentialRecord {
  id: string;
  user_id: string;
  server_id: string;
  server_name: string;
  server_type: string;
  encrypted_config: string;
  encryption_iv: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/mcp/credentials
 * List all MCP servers for the authenticated user
 */
export async function GET(request: Request) {
  // Validate MCP configuration
  const envCheck = validateForFeature("mcp");
  if (!envCheck.valid) {
    console.error("[MCP Credentials] Missing configuration:", envCheck.missing);
    return NextResponse.json(
      { error: "MCP service not configured" },
      { status: 503 }
    );
  }

  // SECURITY: Require authentication
  const { supabase, user, error: authError } = await getAuthenticatedSupabaseClient(request);

  if (authError || !supabase || !user) {
    return NextResponse.json(
      { error: authError || "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Fetch user's MCP credentials (RLS will automatically filter by user)
    const { data: credentials, error } = await supabase
      .from("mcp_server_credentials")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[MCP Credentials] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch credentials" },
        { status: 500 }
      );
    }

    // Decrypt credentials for response
    const decryptedServers = (credentials as MCPCredentialRecord[] | null)?.map((cred) => {
      try {
        // Split encrypted_config into encrypted data and auth tag
        const [encryptedData, authTag] = cred.encrypted_config.split(":");

        const decryptedConfig = decryptMCPConfig(
          encryptedData,
          cred.encryption_iv,
          authTag
        );

        return {
          id: cred.server_id,
          name: cred.server_name,
          type: cred.server_type,
          enabled: cred.enabled,
          env: decryptedConfig.env,
          createdAt: cred.created_at,
          updatedAt: cred.updated_at,
        };
      } catch (error) {
        console.error(`[MCP Credentials] Failed to decrypt ${cred.server_id}:`, error);
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({ servers: decryptedServers });
  } catch (error) {
    console.error("[MCP Credentials] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mcp/credentials
 * Save new encrypted MCP server credentials
 */
export async function POST(request: Request) {
  // Validate MCP configuration
  const envCheck = validateForFeature("mcp");
  if (!envCheck.valid) {
    console.error("[MCP Credentials] Missing configuration:", envCheck.missing);
    return NextResponse.json(
      { error: "MCP service not configured" },
      { status: 503 }
    );
  }

  // SECURITY: Require authentication
  const { supabase, user, error: authError } = await getAuthenticatedSupabaseClient(request);

  if (authError || !supabase || !user) {
    return NextResponse.json(
      { error: authError || "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  // SECURITY: Rate limiting - 10 requests per 10 seconds
  const rateLimitResult = standardRatelimit(`mcp_credentials_post_${user.id}`);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      rateLimitErrorResponse(rateLimitResult),
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { serverId, serverName, serverType, config, enabled } = body;

    // Validate required fields
    if (!serverId || !serverName || !serverType || !config) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate server type
    if (!["stdio", "sse"].includes(serverType)) {
      return NextResponse.json(
        { error: "Invalid server type" },
        { status: 400 }
      );
    }

    // SECURITY: Validate server name format
    const nameValidation = validateServerName(serverName);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // SECURITY: Validate API key formats based on server type
    const configValidation = validateMCPServerConfig(serverName, config.env || {});
    if (!configValidation.valid) {
      return NextResponse.json(
        { error: configValidation.error },
        { status: 400 }
      );
    }

    // SECURITY: Sanitize string inputs
    const sanitizedServerName = sanitizeString(serverName);
    const sanitizedServerId = sanitizeString(serverId);

    // Encrypt configuration
    const { encryptedConfig, iv, authTag } = encryptMCPConfig(config);

    // Store encrypted data with auth tag appended
    const encryptedDataWithTag = `${encryptedConfig}:${authTag}`;

    // Insert into database (use sanitized values)
    const { data, error } = await supabase
      .from("mcp_server_credentials")
      .insert({
        user_id: user.id,
        server_id: sanitizedServerId,
        server_name: sanitizedServerName,
        server_type: serverType,
        encrypted_config: encryptedDataWithTag,
        encryption_iv: iv,
        enabled: enabled !== undefined ? enabled : false,
      } as any)
      .select()
      .single();

    if (error) {
      console.error("[MCP Credentials] Error inserting:", error);

      // Check for duplicate key error
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Server already exists" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to save credentials" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      serverId: (data as MCPCredentialRecord)?.server_id,
    });
  } catch (error) {
    console.error("[MCP Credentials] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mcp/credentials
 * Update existing MCP server credentials
 */
export async function PUT(request: Request) {
  // SECURITY: Require authentication
  const { supabase, user, error: authError } = await getAuthenticatedSupabaseClient(request);

  if (authError || !supabase || !user) {
    return NextResponse.json(
      { error: authError || "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { serverId, config, enabled } = body;

    if (!serverId) {
      return NextResponse.json(
        { error: "Server ID required" },
        { status: 400 }
      );
    }

    // Build update object
    const updates: any = {};

    if (config) {
      const { encryptedConfig, iv, authTag } = encryptMCPConfig(config);
      updates.encrypted_config = `${encryptedConfig}:${authTag}`;
      updates.encryption_iv = iv;
    }

    if (enabled !== undefined) {
      updates.enabled = enabled;
    }

    // Update in database
    const { error } = await (supabase as any)
      .from("mcp_server_credentials")
      .update(updates)
      .eq("user_id", user.id)
      .eq("server_id", serverId);

    if (error) {
      console.error("[MCP Credentials] Error updating:", error);
      return NextResponse.json(
        { error: "Failed to update credentials" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MCP Credentials] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mcp/credentials
 * Delete MCP server credentials
 */
export async function DELETE(request: Request) {
  // SECURITY: Require authentication
  const { supabase, user, error: authError } = await getAuthenticatedSupabaseClient(request);

  if (authError || !supabase || !user) {
    return NextResponse.json(
      { error: authError || "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");

    if (!serverId) {
      return NextResponse.json(
        { error: "Server ID required" },
        { status: 400 }
      );
    }

    // Delete from database (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from("mcp_server_credentials")
      .delete()
      .eq("user_id", user.id)
      .eq("server_id", serverId);

    if (error) {
      console.error("[MCP Credentials] Error deleting:", error);
      return NextResponse.json(
        { error: "Failed to delete credentials" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MCP Credentials] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
