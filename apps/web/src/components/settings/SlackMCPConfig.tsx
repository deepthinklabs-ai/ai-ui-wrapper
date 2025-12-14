/**
 * Slack MCP Configuration Component
 *
 * Dedicated UI for configuring Slack MCP server integration.
 * Provides step-by-step guidance for setting up Slack bot tokens and team IDs.
 */

"use client";

import React, { useState } from "react";
import {
  isValidSlackBotToken,
  isValidSlackTeamId,
  extractSlackConfig,
} from "@/lib/slackMCPIntegration";

type SlackMCPConfigProps = {
  botToken: string;
  teamId: string;
  onBotTokenChange: (token: string) => void;
  onTeamIdChange: (teamId: string) => void;
};

export default function SlackMCPConfig({
  botToken,
  teamId,
  onBotTokenChange,
  onTeamIdChange,
}: SlackMCPConfigProps) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);

  const botTokenValid = botToken && isValidSlackBotToken(botToken) && botToken !== 'xoxb-YOUR_BOT_TOKEN_HERE';
  const teamIdValid = teamId && isValidSlackTeamId(teamId) && teamId !== 'T01234567';

  return (
    <div className="space-y-4">
      {/* Configuration Status */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Slack MCP Configuration</h4>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {showInstructions ? 'Hide' : 'Show'} Setup Instructions
        </button>
      </div>

      {/* Setup Instructions */}
      {showInstructions && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
          <h5 className="text-sm font-semibold text-slate-200">How to Set Up Slack MCP</h5>

          <div className="text-xs text-slate-300 space-y-2">
            <p className="font-medium">Step 1: Create a Slack App</p>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-slate-400">
              <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">api.slack.com/apps</a></li>
              <li>Click "Create New App" → "From scratch"</li>
              <li>Name your app (e.g., "AI Assistant") and select your workspace</li>
            </ol>

            <p className="font-medium mt-3">Step 2: Configure Bot Token Scopes</p>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-slate-400">
              <li>In your app settings, go to "OAuth & Permissions"</li>
              <li>Scroll to "Scopes" → "Bot Token Scopes"</li>
              <li>Add these scopes:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li><code className="bg-slate-900 px-1 rounded">channels:history</code> - Read channel history</li>
                  <li><code className="bg-slate-900 px-1 rounded">channels:read</code> - View channels</li>
                  <li><code className="bg-slate-900 px-1 rounded">chat:write</code> - Send messages</li>
                  <li><code className="bg-slate-900 px-1 rounded">reactions:write</code> - Add reactions</li>
                  <li><code className="bg-slate-900 px-1 rounded">users:read</code> - View user info</li>
                  <li><code className="bg-slate-900 px-1 rounded">groups:history</code> - Read private channel history</li>
                  <li><code className="bg-slate-900 px-1 rounded">im:history</code> - Read DM history</li>
                  <li><code className="bg-slate-900 px-1 rounded">mpim:history</code> - Read group DM history</li>
                </ul>
              </li>
            </ol>

            <p className="font-medium mt-3">Step 3: Install App to Workspace</p>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-slate-400">
              <li>Still in "OAuth & Permissions", click "Install to Workspace"</li>
              <li>Review permissions and click "Allow"</li>
              <li>Copy the "Bot User OAuth Token" (starts with xoxb-)</li>
            </ol>

            <p className="font-medium mt-3">Step 4: Get Team ID</p>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-slate-400">
              <li>In Slack, click your workspace name (top left)</li>
              <li>Go to "Settings & administration" → "Workspace settings"</li>
              <li>Your Workspace ID is in the URL: <code className="bg-slate-900 px-1 rounded">https://app.slack.com/client/T01234567/...</code></li>
              <li>Copy the ID that starts with 'T'</li>
            </ol>

            <p className="font-medium mt-3">Step 5: Paste Credentials Below</p>
          </div>
        </div>
      )}

      {/* Bot Token Input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Slack Bot Token
          <span className="text-red-400 ml-1">*</span>
        </label>
        <div className="relative">
          <input
            type={showBotToken ? "text" : "password"}
            value={botToken}
            onChange={(e) => onBotTokenChange(e.target.value)}
            placeholder="xoxb-your-bot-token-here"
            className={`w-full px-3 py-2 pr-20 bg-slate-800 border rounded-md text-sm font-mono ${
              botToken && !botTokenValid
                ? 'border-red-500 focus:ring-red-500'
                : 'border-slate-600 focus:ring-blue-500'
            } focus:ring-1 focus:outline-none`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBotToken(!showBotToken)}
              className="text-slate-400 hover:text-slate-300"
              tabIndex={-1}
            >
              {showBotToken ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
            {botToken && (
              botTokenValid ? (
                <span className="text-green-500 text-xs">✓ Valid</span>
              ) : (
                <span className="text-red-500 text-xs">✗ Invalid</span>
              )
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Starts with <code className="bg-slate-800 px-1 rounded">xoxb-</code>. Found in OAuth & Permissions.
        </p>
      </div>

      {/* Team ID Input */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Slack Team ID
          <span className="text-red-400 ml-1">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={teamId}
            onChange={(e) => onTeamIdChange(e.target.value.toUpperCase())}
            placeholder="T01234567"
            className={`w-full px-3 py-2 bg-slate-800 border rounded-md text-sm font-mono ${
              teamId && !teamIdValid
                ? 'border-red-500 focus:ring-red-500'
                : 'border-slate-600 focus:ring-blue-500'
            } focus:ring-1 focus:outline-none`}
          />
          {teamId && (
            <div className="absolute right-3 top-2.5">
              {teamIdValid ? (
                <span className="text-green-500 text-xs">✓ Valid</span>
              ) : (
                <span className="text-red-500 text-xs">✗ Invalid</span>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Starts with <code className="bg-slate-800 px-1 rounded">T</code>. Found in workspace URL.
        </p>
      </div>

      {/* Validation Summary */}
      {(botToken || teamId) && !(botTokenValid && teamIdValid) && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
          <p className="text-xs text-yellow-300 font-medium">⚠️ Configuration Incomplete</p>
          <ul className="text-xs text-yellow-400 mt-2 space-y-1">
            {!botTokenValid && <li>• Valid Slack Bot Token required</li>}
            {!teamIdValid && <li>• Valid Slack Team ID required</li>}
          </ul>
        </div>
      )}

      {/* Success Message */}
      {botTokenValid && teamIdValid && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
          <p className="text-xs text-green-300 font-medium">✓ Configuration Valid</p>
          <p className="text-xs text-green-400 mt-1">
            Your Slack MCP server is ready to connect. Enable the server to start using Slack tools.
          </p>
        </div>
      )}

      {/* Helpful Links */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-3">
        <p className="text-xs font-medium text-slate-300 mb-2">Helpful Links</p>
        <div className="space-y-1">
          <a
            href="https://api.slack.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-blue-400 hover:underline"
          >
            → Manage Slack Apps
          </a>
          <a
            href="https://api.slack.com/authentication/token-types"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-blue-400 hover:underline"
          >
            → Learn About Slack Tokens
          </a>
          <a
            href="https://api.slack.com/scopes"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-blue-400 hover:underline"
          >
            → Bot Token Scopes Reference
          </a>
        </div>
      </div>
    </div>
  );
}
