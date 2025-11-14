/**
 * Claude Code Bridge Hook
 *
 * Manages connection to the local Claude Code bridge server.
 * Use this instead of useTerminalBot when you want to connect to real Claude Code.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { TerminalMessage, TerminalAttachment } from "@/types/terminal";
import { getBridgeClient } from "@/lib/claudeCodeBridgeClient";

type UseClaudeCodeBridgeOptions = {
  autoConnect?: boolean; // Auto-connect on mount
};

type UseClaudeCodeBridgeResult = {
  messages: TerminalMessage[];
  isProcessing: boolean;
  isConnected: boolean;
  isBridgeAvailable: boolean;
  sendCommand: (command: string, files: File[]) => Promise<void>;
  clearSession: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  startClaudeCode: () => Promise<void>;
  stopClaudeCode: () => Promise<void>;
};

export function useClaudeCodeBridge({
  autoConnect = false,
}: UseClaudeCodeBridgeOptions = {}): UseClaudeCodeBridgeResult {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isBridgeAvailable, setIsBridgeAvailable] = useState(false);

  const bridgeClient = useRef(getBridgeClient());
  const currentMessageId = useRef<string | null>(null);
  const outputBuffer = useRef<string>('');

  /**
   * Check if bridge server is available
   */
  const checkBridgeAvailability = useCallback(async () => {
    try {
      const available = await bridgeClient.current.isAvailable();
      setIsBridgeAvailable(available);
      return available;
    } catch (error) {
      console.error('[Bridge Hook] Error checking availability:', error);
      setIsBridgeAvailable(false);
      return false;
    }
  }, []);

  /**
   * Connect to the bridge WebSocket
   */
  const connect = useCallback(async () => {
    try {
      // First check if bridge is available
      const available = await checkBridgeAvailability();
      if (!available) {
        throw new Error('Bridge server is not running. Start it with: cd claude-code-bridge && npm run dev');
      }

      await bridgeClient.current.connect();
      setIsConnected(true);

      // Set up event listeners
      bridgeClient.current.on('output', (data: string) => {
        console.log('[Bridge Hook] Output:', data);
        outputBuffer.current += data;
      });

      bridgeClient.current.on('error', (data: string) => {
        console.error('[Bridge Hook] Error:', data);

        const errorMessage: TerminalMessage = {
          id: `error-${Date.now()}`,
          role: 'error',
          content: data,
          timestamp: new Date(),
          exitCode: 1,
        };

        setMessages((prev) => [...prev, errorMessage]);
      });

      bridgeClient.current.on('response-complete', (data: any) => {
        console.log('[Bridge Hook] Response complete:', data);
        setIsProcessing(false);

        // Add assistant message with the complete response
        const assistantMessage: TerminalMessage = {
          id: data.messageId || `msg-${Date.now()}`,
          role: 'assistant',
          content: data.content || outputBuffer.current,
          timestamp: new Date(),
          exitCode: data.isTimeout ? 1 : 0,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Clear buffer
        outputBuffer.current = '';
        currentMessageId.current = null;
      });

      bridgeClient.current.on('exit', (data: any) => {
        console.log('[Bridge Hook] Claude Code exited:', data);
        setIsConnected(false);
        setIsProcessing(false);

        const exitMessage: TerminalMessage = {
          id: `exit-${Date.now()}`,
          role: 'error',
          content: `Claude Code process exited with code ${data.code}`,
          timestamp: new Date(),
          exitCode: data.code || 1,
        };

        setMessages((prev) => [...prev, exitMessage]);
      });

      console.log('[Bridge Hook] Connected to bridge');
    } catch (error) {
      console.error('[Bridge Hook] Connection error:', error);
      setIsConnected(false);
      throw error;
    }
  }, [checkBridgeAvailability]);

  /**
   * Disconnect from the bridge
   */
  const disconnect = useCallback(() => {
    bridgeClient.current.disconnect();
    setIsConnected(false);
  }, []);

  /**
   * Start Claude Code process on the bridge
   */
  const startClaudeCode = useCallback(async () => {
    try {
      console.log('[Bridge Hook] Starting Claude Code...');
      const result = await bridgeClient.current.start();
      console.log('[Bridge Hook] Claude Code started:', result);

      const infoMessage: TerminalMessage = {
        id: `info-${Date.now()}`,
        role: 'assistant',
        content: '✅ Connected to local Claude Code! You are now using the real Claude Code CLI.',
        timestamp: new Date(),
        exitCode: 0,
      };

      setMessages((prev) => [...prev, infoMessage]);
    } catch (error) {
      console.error('[Bridge Hook] Error starting Claude Code:', error);

      const errorMessage: TerminalMessage = {
        id: `error-${Date.now()}`,
        role: 'error',
        content: `Failed to start Claude Code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        exitCode: 1,
      };

      setMessages((prev) => [...prev, errorMessage]);
      throw error;
    }
  }, []);

  /**
   * Stop Claude Code process
   */
  const stopClaudeCode = useCallback(async () => {
    try {
      await bridgeClient.current.stop();

      const infoMessage: TerminalMessage = {
        id: `info-${Date.now()}`,
        role: 'assistant',
        content: 'Claude Code stopped.',
        timestamp: new Date(),
        exitCode: 0,
      };

      setMessages((prev) => [...prev, infoMessage]);
    } catch (error) {
      console.error('[Bridge Hook] Error stopping Claude Code:', error);
      throw error;
    }
  }, []);

  /**
   * Process file attachments
   */
  const processFiles = async (files: File[]): Promise<TerminalAttachment[]> => {
    const attachments: TerminalAttachment[] = [];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`);
      }

      const isImage = file.type.startsWith("image/");

      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;

        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });

      attachments.push({
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        content,
        isImage,
      });
    }

    return attachments;
  };

  /**
   * Send a command to Claude Code via the bridge
   */
  const sendCommand = useCallback(
    async (command: string, files: File[]) => {
      if (!command.trim() && files.length === 0) return;

      if (!isConnected) {
        throw new Error('Not connected to bridge. Click "Connect to Bridge" first.');
      }

      setIsProcessing(true);

      try {
        // Process file attachments
        const attachments = files.length > 0 ? await processFiles(files) : undefined;

        // Add user message
        const messageId = `msg-${Date.now()}`;
        const userMessage: TerminalMessage = {
          id: messageId,
          role: "user",
          content: command,
          timestamp: new Date(),
          attachments,
        };

        setMessages((prev) => [...prev, userMessage]);

        // Build message content
        let messageContent = command;

        // Add file attachments to message
        if (attachments && attachments.length > 0) {
          messageContent += '\n\n[Attached files:]\n';

          for (const attachment of attachments) {
            if (attachment.isImage) {
              messageContent += `- ${attachment.name} (image)\n`;
            } else {
              messageContent += `- ${attachment.name}:\n\`\`\`\n${attachment.content.substring(0, 1000)}${
                attachment.content.length > 1000 ? '\n... (truncated)' : ''
              }\n\`\`\`\n`;
            }
          }
        }

        // Store current message ID
        currentMessageId.current = messageId;

        // Clear output buffer
        outputBuffer.current = '';

        // Send to bridge
        await bridgeClient.current.sendMessage(messageContent, messageId);

        console.log('[Bridge Hook] Message sent to bridge');
      } catch (error) {
        console.error('[Bridge Hook] Error sending command:', error);
        setIsProcessing(false);

        const errorMessage: TerminalMessage = {
          id: `error-${Date.now()}`,
          role: 'error',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          exitCode: 1,
        };

        setMessages((prev) => [...prev, errorMessage]);
      }
    },
    [isConnected]
  );

  /**
   * Clear the session
   */
  const clearSession = useCallback(() => {
    setMessages([]);
    outputBuffer.current = '';
    currentMessageId.current = null;
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      checkBridgeAvailability().then((available) => {
        if (available) {
          connect().catch(console.error);
        }
      });
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, checkBridgeAvailability, connect, disconnect]);

  return {
    messages,
    isProcessing,
    isConnected,
    isBridgeAvailable,
    sendCommand,
    clearSession,
    connect,
    disconnect,
    startClaudeCode,
    stopClaudeCode,
  };
}
