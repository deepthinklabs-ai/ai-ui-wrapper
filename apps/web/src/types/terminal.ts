/**
 * Terminal Bot Types
 *
 * Type definitions for Terminal Bot Command - a GUI wrapper for
 * CLI-based AI tools like Claude Code.
 */

export type TerminalProvider = "claude-code" | "other";

export type TerminalMessageRole = "user" | "assistant" | "system" | "error";

export type TerminalAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // base64 or text content
  isImage: boolean;
};

export type TerminalMessage = {
  id: string;
  role: TerminalMessageRole;
  content: string;
  timestamp: Date;
  attachments?: TerminalAttachment[];
  command?: string; // The actual command sent to terminal
  exitCode?: number; // Exit code from command execution
};

export type TerminalSession = {
  id: string;
  name: string;
  provider: TerminalProvider;
  messages: TerminalMessage[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

export type TerminalConfig = {
  provider: TerminalProvider;
  apiKey?: string; // For services that require API keys
  workingDirectory?: string;
  shellPath?: string; // Path to shell executable
  environment?: Record<string, string>;
};

export type CommandHistoryItem = {
  command: string;
  timestamp: Date;
  success: boolean;
};
