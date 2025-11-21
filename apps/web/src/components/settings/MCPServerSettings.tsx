/**
 * MCP Server Settings Component
 *
 * UI for managing MCP (Model Context Protocol) servers:
 * - Enable/disable MCP feature
 * - Add/remove/configure servers
 * - View preset servers
 * - Test connections
 */

"use client";

import React, { useState, useEffect } from "react";
import {
  getMCPServers,
  saveMCPServers,
  addMCPServer,
  deleteMCPServer,
  toggleMCPServer,
  isMCPEnabled,
  setMCPEnabled,
  getPresetServers,
  validateMCPServer,
  type MCPServerConfig,
  type MCPServerType,
} from "@/lib/mcpStorage";

export default function MCPServerSettings() {
  const [enabled, setEnabled] = useState(false);
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServerConfig | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<MCPServerType>("sse");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEnv, setFormEnv] = useState("");
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Load settings
  const loadServers = () => {
    setServers(getMCPServers());
    setEnabled(isMCPEnabled());
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    setMCPEnabled(newEnabled);
  };

  const handleAddServer = () => {
    setShowAddForm(true);
    setEditingServer(null);
    resetForm();
  };

  const handleEditServer = (server: MCPServerConfig) => {
    setEditingServer(server);
    setFormName(server.name);
    setFormDescription(server.description || "");
    setFormType(server.type);
    setFormCommand(server.command || "");
    setFormArgs(server.args?.join(" ") || "");
    setFormUrl(server.url || "");
    setFormEnv(server.env ? JSON.stringify(server.env, null, 2) : "");
    setShowAddForm(true);
  };

  const handleDeleteServer = (id: string) => {
    if (confirm("Are you sure you want to delete this MCP server?")) {
      deleteMCPServer(id);
      loadServers();
    }
  };

  const handleToggleServer = (id: string) => {
    toggleMCPServer(id);
    loadServers();
  };

  const handleAddPreset = (preset: any) => {
    // Check if preset requires credentials (has env variables with placeholder values)
    const needsCredentials = preset.env && Object.values(preset.env).some((val: any) =>
      typeof val === 'string' && (val.includes('YOUR_') || val === '' || val.includes('_HERE'))
    );

    if (needsCredentials) {
      // Open the edit form with preset values so user can configure credentials
      setEditingServer(null);
      setFormName(preset.name);
      setFormDescription(preset.description || "");
      setFormType(preset.type);
      setFormCommand(preset.command || "");
      setFormArgs(preset.args?.join(" ") || "");
      setFormUrl(preset.url || "");
      setFormEnv(preset.env ? JSON.stringify(preset.env, null, 2) : "");
      setShowAddForm(true);
      setShowPresets(false);
      setFormErrors(["⚠️ Please configure the required credentials below before saving."]);
    } else {
      // No credentials needed, add directly
      addMCPServer(preset);
      loadServers();
      setShowPresets(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormType("sse");
    setFormCommand("");
    setFormArgs("");
    setFormUrl("");
    setFormEnv("");
    setFormErrors([]);
  };

  const handleSaveServer = () => {
    const serverData: Partial<MCPServerConfig> = {
      name: formName,
      description: formDescription,
      type: formType,
      enabled: true,
    };

    if (formType === "stdio") {
      serverData.command = formCommand;
      serverData.args = formArgs.split(" ").filter(a => a.trim());
      if (formEnv.trim()) {
        try {
          serverData.env = JSON.parse(formEnv);

          // Validate that placeholder credentials have been replaced
          const envValues = Object.values(serverData.env);
          const hasPlaceholders = envValues.some((val: any) =>
            typeof val === 'string' && (
              val.includes('YOUR_TOKEN_HERE') ||
              val.includes('YOUR_KEY_HERE') ||
              val.includes('your-key-here') ||
              val.includes('your-github-username') ||
              (val.startsWith('ghp_YOUR') && val.includes('HERE'))
            )
          );

          if (hasPlaceholders) {
            setFormErrors(["❌ Please replace placeholder values with your actual credentials (e.g., GitHub token and username, API keys)"]);
            return;
          }
        } catch {
          setFormErrors(["Invalid JSON format for environment variables"]);
          return;
        }
      }
    } else {
      serverData.url = formUrl;
    }

    const errors = validateMCPServer(serverData);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    if (editingServer) {
      const updated = getMCPServers().map(s =>
        s.id === editingServer.id ? { ...s, ...serverData } : s
      );
      saveMCPServers(updated);
    } else {
      addMCPServer(serverData as any);
    }

    loadServers();
    setShowAddForm(false);
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">MCP Servers</h3>
        <p className="text-sm text-gray-400 mb-2">
          Connect to Model Context Protocol servers to extend AI capabilities with tools,
          resources, and prompts.
        </p>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 mb-4">
          <p className="text-xs text-blue-300">
            <strong>💡 What is MCP?</strong> MCP servers provide tools like filesystem access,
            web search, database queries, and more that the AI can use to assist you.
          </p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <label htmlFor="mcp-enabled" className="text-sm font-medium">
          Enable MCP Servers
        </label>
        <button
          id="mcp-enabled"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Server List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Configured Servers</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors"
                >
                  {showPresets ? "Hide" : "Show"} Presets
                </button>
                <button
                  onClick={handleAddServer}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
                >
                  + Add Server
                </button>
              </div>
            </div>

            {/* Preset Servers */}
            {showPresets && (
              <div className="space-y-2 p-3 bg-purple-950/30 border border-purple-800/30 rounded-lg">
                <p className="text-xs text-purple-300 mb-2">
                  Click to add popular MCP servers:
                </p>
                {getPresetServers().map((preset, index) => {
                  const needsCredentials = preset.env && Object.values(preset.env).some((val: any) =>
                    typeof val === 'string' && (val.includes('YOUR_') || val === '' || val.includes('_HERE') || val.includes('your-github-username'))
                  );

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-800/50 rounded"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{preset.name}</div>
                          {needsCredentials && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                              🔑 Requires credentials
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">{preset.description}</div>
                      </div>
                      <button
                        onClick={() => handleAddPreset(preset)}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {servers.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8 border border-gray-700 rounded-lg">
                No servers configured. Click "Add Server" or add a preset to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {servers.map(server => {
                  // Check if server has placeholder credentials
                  const hasPlaceholders = server.env && Object.values(server.env).some((val: any) =>
                    typeof val === 'string' && (
                      val.includes('YOUR_TOKEN_HERE') ||
                      val.includes('YOUR_KEY_HERE') ||
                      val.includes('your-key-here') ||
                      val.includes('your-github-username') ||
                      (val.startsWith('ghp_YOUR') && val.includes('HERE'))
                    )
                  );

                  return (
                    <div
                      key={server.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        hasPlaceholders ? 'bg-amber-900/20 border border-amber-700' : 'bg-gray-800'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{server.name}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              server.type === "sse"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            {server.type}
                          </span>
                          {hasPlaceholders && (
                            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">
                              ⚠️ Credentials needed
                            </span>
                          )}
                        </div>
                        {server.description && (
                          <div className="text-xs text-gray-400 mt-1">{server.description}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {server.type === "sse" ? server.url : server.command}
                        </div>
                        {hasPlaceholders && (
                          <div className="text-xs text-amber-400 mt-1">
                            Click "Edit" to add your credentials
                          </div>
                        )}
                      </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleServer(server.id)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          server.enabled
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-gray-600 hover:bg-gray-700"
                        }`}
                      >
                        {server.enabled ? "Enabled" : "Disabled"}
                      </button>
                      <button
                        onClick={() => handleEditServer(server)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteServer(server.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {editingServer ? "Edit Server" : "Add New Server"}
                </h4>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {formErrors.length > 0 && (
                <div className="p-2 bg-red-500/20 border border-red-500 rounded text-xs text-red-300">
                  {formErrors.map((error, i) => (
                    <div key={i}>• {error}</div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400">Server Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                  placeholder="My MCP Server"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                  placeholder="What does this server do?"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">Transport Type *</label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value as MCPServerType)}
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                >
                  <option value="sse">SSE (Server-Sent Events)</option>
                  <option value="stdio">Stdio (requires backend)</option>
                </select>
                <p className="text-xs text-amber-400 mt-1">
                  ⚠️ Stdio servers require a backend proxy - use SSE for browser-based servers
                </p>
              </div>

              {formType === "sse" ? (
                <div>
                  <label className="text-xs text-gray-400">Server URL *</label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                    placeholder="https://example.com/mcp"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-gray-400">Command *</label>
                    <input
                      type="text"
                      value={formCommand}
                      onChange={e => setFormCommand(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                      placeholder="npx"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Arguments (space-separated)</label>
                    <input
                      type="text"
                      value={formArgs}
                      onChange={e => setFormArgs(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                      placeholder="-y @modelcontextprotocol/server-memory"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Environment Variables (JSON)</label>
                    <textarea
                      value={formEnv}
                      onChange={e => setFormEnv(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
                      rows={3}
                      placeholder='{"API_KEY": "your-key-here"}'
                    />
                    {formName.toLowerCase().includes('github') && (
                      <div className="text-xs mt-1 space-y-1">
                        <div className="p-2 bg-blue-950/30 border border-blue-800/30 rounded">
                          <p className="text-blue-300 font-medium mb-1">📝 Configuration Required:</p>
                          <ol className="text-blue-400 space-y-0.5 pl-4 list-decimal">
                            <li>Replace <span className="font-mono bg-gray-700 px-1 rounded">ghp_YOUR_TOKEN_HERE</span> with your actual token</li>
                            <li>Replace <span className="font-mono bg-gray-700 px-1 rounded">your-github-username</span> with your GitHub username (e.g., "deepthinklabs-ai")</li>
                          </ol>
                          <p className="text-amber-400 text-[11px] mt-1">⚠️ Note: The MCP server will verify your username matches the token. Both must be from the same GitHub account.</p>
                        </div>
                        <div className="flex items-start gap-2">
                          <p className="text-blue-400">
                            🔗 Create new token:{" "}
                            <a
                              href="https://github.com/settings/tokens/new?scopes=repo,read:org,read:user&description=MCP%20Server"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-blue-300"
                            >
                              github.com/settings/tokens/new
                            </a>
                          </p>
                        </div>
                        <p className="text-blue-400">
                          🔧 Manage existing tokens:{" "}
                          <a
                            href="https://github.com/settings/tokens"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-blue-300"
                          >
                            github.com/settings/tokens
                          </a>
                        </p>
                        <div className="text-gray-400">
                          <p className="mb-1">Required scopes:</p>
                          <ul className="space-y-0.5 pl-4">
                            <li>
                              <span className="font-mono bg-gray-700 px-1 py-0.5 rounded">repo</span>
                              <span className="text-[11px] ml-1.5">- Full control of repositories (read, write, push, delete)</span>
                            </li>
                            <li>
                              <span className="font-mono bg-gray-700 px-1 py-0.5 rounded">read:org</span>
                              <span className="text-[11px] ml-1.5">- Read organization data</span>
                            </li>
                            <li>
                              <span className="font-mono bg-gray-700 px-1 py-0.5 rounded">read:user</span>
                              <span className="text-[11px] ml-1.5">- Read user profile data</span>
                            </li>
                          </ul>
                        </div>
                        <p className="text-green-400 text-[11px]">
                          ✅ The <span className="font-mono">repo</span> scope allows creating, reading, updating, and pushing to repositories
                        </p>
                        <p className="text-amber-400 text-[11px]">
                          ⚠️ You cannot edit token scopes after creation - you must create a new token with the correct scopes
                        </p>
                      </div>
                    )}
                    {!formName.toLowerCase().includes('github') && (
                      <p className="text-xs text-blue-400 mt-1">
                        💡 Enter your API credentials as JSON key-value pairs
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveServer}
                  className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                >
                  {editingServer ? "Update Server" : "Add Server"}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    resetForm();
                  }}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
