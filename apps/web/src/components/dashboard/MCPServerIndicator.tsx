/**
 * MCP Server Indicator Component
 *
 * Displays the status of connected MCP servers in the dashboard.
 * Shows number of connected servers, available tools, and connection status.
 */

"use client";

import React, { useState } from "react";
import type { MCPConnection, MCPTool } from "@/lib/mcpClient";

type MCPServerIndicatorProps = {
  connections: MCPConnection[];
  tools: Array<MCPTool & { serverId: string; serverName: string }>;
  isConnecting: boolean;
};

export default function MCPServerIndicator({
  connections,
  tools,
  isConnecting,
}: MCPServerIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const connectedCount = connections.filter(c => c.status === "connected").length;
  const errorCount = connections.filter(c => c.status === "error").length;
  const totalServers = connections.length;

  // Debug logging
  React.useEffect(() => {
    console.log('[MCP Indicator] Connections:', connections.length, 'Tools:', tools.length, 'Connecting:', isConnecting);
    console.log('[MCP Indicator] Connected:', connectedCount, 'Errors:', errorCount);
  }, [connections.length, tools.length, isConnecting, connectedCount, errorCount]);

  // Always show if there are any configured servers (even if not connected yet)
  // Only hide if absolutely no MCP configuration exists
  if (totalServers === 0 && !isConnecting) {
    console.log('[MCP Indicator] Hidden - no servers configured');
    return null;
  }

  const displayTotal = totalServers;

  return (
    <div className="relative">
      {/* Status Indicator Button - More prominent */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-all shadow-lg ${
          isConnecting
            ? "border-yellow-500 bg-yellow-500/30 text-yellow-300 shadow-yellow-500/20"
            : connectedCount > 0
            ? "border-green-500 bg-green-500/30 text-green-300 shadow-green-500/20 animate-pulse-slow"
            : errorCount > 0
            ? "border-red-500 bg-red-500/30 text-red-300 shadow-red-500/20"
            : "border-gray-600 bg-gray-800/50 text-gray-300"
        }`}
        title={`${connectedCount}/${displayTotal} MCP servers connected, ${tools.length} tools available`}
      >
        <svg
          className={`h-5 w-5 ${isConnecting ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isConnecting ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          )}
        </svg>
        <span className="font-bold">
          MCP: {connectedCount}/{displayTotal}
        </span>
        {tools.length > 0 && (
          <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
            {tools.length} tools
          </span>
        )}
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded Details Panel */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-sm font-medium">MCP Servers</h3>
            <p className="text-xs text-gray-400 mt-1">
              {connectedCount} connected, {errorCount} errors, {tools.length} total tools
            </p>
          </div>

          {/* Server List */}
          <div className="divide-y divide-gray-700">
            {connections.map(connection => (
              <div key={connection.serverId} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          connection.status === "connected"
                            ? "bg-green-500"
                            : connection.status === "error"
                            ? "bg-red-500"
                            : "bg-gray-500"
                        }`}
                      />
                      <span className="text-sm font-medium">{connection.serverName}</span>
                    </div>

                    {connection.status === "error" && connection.error && (
                      <p className="text-xs text-red-400 mt-1 ml-4">{connection.error}</p>
                    )}

                    {connection.status === "connected" && (
                      <div className="mt-2 ml-4 space-y-1">
                        {connection.capabilities.tools && connection.capabilities.tools.length > 0 && (
                          <div className="text-xs">
                            <span className="text-gray-400">Tools: </span>
                            <span className="text-gray-300">
                              {connection.capabilities.tools.length}
                            </span>
                          </div>
                        )}
                        {connection.capabilities.resources &&
                          connection.capabilities.resources.length > 0 && (
                            <div className="text-xs">
                              <span className="text-gray-400">Resources: </span>
                              <span className="text-gray-300">
                                {connection.capabilities.resources.length}
                              </span>
                            </div>
                          )}
                        {connection.capabilities.prompts &&
                          connection.capabilities.prompts.length > 0 && (
                            <div className="text-xs">
                              <span className="text-gray-400">Prompts: </span>
                              <span className="text-gray-300">
                                {connection.capabilities.prompts.length}
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tool List for this server */}
                {connection.status === "connected" &&
                  connection.capabilities.tools &&
                  connection.capabilities.tools.length > 0 && (
                    <div className="mt-2 ml-4">
                      <details className="text-xs">
                        <summary className="text-gray-400 cursor-pointer hover:text-gray-300">
                          View tools ({connection.capabilities.tools.length})
                        </summary>
                        <div className="mt-2 space-y-1 pl-2">
                          {connection.capabilities.tools.map((tool, index) => (
                            <div key={index} className="text-gray-300">
                              <span className="font-mono">{tool.name}</span>
                              {tool.description && (
                                <div className="text-gray-500 ml-2">{tool.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
              </div>
            ))}
          </div>

          {connections.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-500">
              No MCP servers configured. Go to Settings to add servers.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
