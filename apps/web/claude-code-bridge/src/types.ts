/**
 * Types for Claude Code Bridge
 */

export interface BridgeMessage {
  id: string;
  content: string;
  timestamp: number;
}

export interface BridgeResponse {
  id: string;
  content: string;
  timestamp: number;
  isComplete: boolean;
}

export interface SessionInfo {
  sessionId: string;
  status: 'idle' | 'processing' | 'error';
  startTime: number;
  lastActivity: number;
}

export interface ClaudeCodeConfig {
  command: string; // Path to claude-code executable
  args: string[]; // Additional arguments
  workingDirectory?: string; // Working directory for Claude Code
}
