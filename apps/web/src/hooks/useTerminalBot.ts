/**
 * Terminal Bot Hook
 *
 * Manages the Terminal Bot conversation and command execution.
 * Acts as a GUI wrapper for CLI-based AI tools like Claude Code.
 */

"use client";

import { useState, useCallback } from "react";
import type { UserTier } from "./useUserTier";
import type { TerminalMessage, TerminalAttachment } from "@/types/terminal";
import { sendUnifiedChatRequest, type UnifiedChatMessage } from "@/lib/unifiedAIClient";
import type { FileNode } from "./useFileSystemAccess";

type UseTerminalBotOptions = {
  userId: string;
  userTier: UserTier;
  fileTree?: FileNode | null;
  readFile?: (path: string) => Promise<string>;
  writeFile?: (path: string, content: string) => Promise<void>;
  deleteFile?: (path: string) => Promise<void>;
};

type UseTerminalBotResult = {
  messages: TerminalMessage[];
  isProcessing: boolean;
  sendCommand: (command: string, files: File[]) => Promise<void>;
  clearSession: () => void;
};

export function useTerminalBot({
  userId,
  userTier,
  fileTree,
  readFile,
  writeFile,
  deleteFile,
}: UseTerminalBotOptions): UseTerminalBotResult {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Track file tree hash to detect changes (for smart caching)
  const [fileTreeHash, setFileTreeHash] = useState<string | null>(null);
  const [fileTreeSent, setFileTreeSent] = useState(false);

  // Rate limiting for file operations
  const [operationCount, setOperationCount] = useState(0);
  const [operationWindowStart, setOperationWindowStart] = useState(Date.now());
  const MAX_OPERATIONS_PER_MINUTE = 50; // Limit to prevent runaway AI

  /**
   * Check rate limiting for file operations
   */
  const checkRateLimit = (): boolean => {
    const now = Date.now();
    const windowDuration = 60 * 1000; // 1 minute

    // Reset window if expired
    if (now - operationWindowStart > windowDuration) {
      setOperationWindowStart(now);
      setOperationCount(0);
      return true;
    }

    // Check if limit exceeded
    if (operationCount >= MAX_OPERATIONS_PER_MINUTE) {
      return false;
    }

    return true;
  };

  /**
   * Increment operation counter
   */
  const incrementOperationCount = () => {
    setOperationCount((prev) => prev + 1);
  };

  /**
   * Generate hash of file tree for change detection
   */
  const generateFileTreeHash = (node: FileNode | null): string => {
    if (!node) return "";

    const collectPaths = (n: FileNode): string[] => {
      const paths = [n.path];
      if (n.children) {
        for (const child of n.children) {
          paths.push(...collectPaths(child));
        }
      }
      return paths;
    };

    return collectPaths(node).sort().join("|");
  };

  /**
   * Convert file tree to a readable format
   */
  const fileTreeToString = (node: FileNode, indent: string = ""): string => {
    let result = `${indent}${node.type === "directory" ? "📁" : "📄"} ${node.name}\n`;

    if (node.children) {
      for (const child of node.children) {
        result += fileTreeToString(child, indent + "  ");
      }
    }

    return result;
  };

  /**
   * Get file list summary (lightweight alternative)
   */
  const getFileSummary = (node: FileNode): { totalFiles: number; totalFolders: number; files: string[] } => {
    let totalFiles = 0;
    let totalFolders = 0;
    const files: string[] = [];

    const traverse = (n: FileNode) => {
      if (n.type === "file") {
        totalFiles++;
        files.push(n.path);
      } else {
        totalFolders++;
      }

      if (n.children) {
        for (const child of n.children) {
          traverse(child);
        }
      }
    };

    traverse(node);
    return { totalFiles, totalFolders, files };
  };

  /**
   * Check if file contains sensitive data
   */
  const containsSensitiveData = (filename: string, content: string): { isSensitive: boolean; reason?: string } => {
    // Check filename patterns
    const sensitiveFiles = ['.env', 'credentials.json', 'secrets.json', 'password', 'api_key', '.pem', '.key', 'private'];
    if (sensitiveFiles.some(pattern => filename.toLowerCase().includes(pattern))) {
      return { isSensitive: true, reason: `Filename suggests sensitive data: ${filename}` };
    }

    // Check content patterns (first 1000 chars)
    const sample = content.substring(0, 1000).toLowerCase();
    const sensitivePatterns = [
      { pattern: /api[_-]?key\s*[=:]\s*['"][a-z0-9_-]{20,}['"]/i, name: 'API key' },
      { pattern: /password\s*[=:]\s*['"][^'"]{8,}['"]/i, name: 'password' },
      { pattern: /secret\s*[=:]\s*['"][a-z0-9_-]{20,}['"]/i, name: 'secret' },
      { pattern: /private[_-]?key/i, name: 'private key' },
      { pattern: /-----BEGIN (RSA |DSA )?PRIVATE KEY-----/i, name: 'private key' },
    ];

    for (const { pattern, name } of sensitivePatterns) {
      if (pattern.test(content)) {
        return { isSensitive: true, reason: `Content contains ${name}` };
      }
    }

    return { isSensitive: false };
  };

  /**
   * Convert files to attachments
   */
  const processFiles = async (files: File[]): Promise<TerminalAttachment[]> => {
    const attachments: TerminalAttachment[] = [];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

    for (const file of files) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`);
      }

      const isImage = file.type.startsWith("image/");

      // Read file content
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.onerror = reject;

        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });

      // Check for sensitive data in text files
      if (!isImage) {
        const sensitivityCheck = containsSensitiveData(file.name, content);
        if (sensitivityCheck.isSensitive) {
          console.warn(`⚠️ Sensitive data detected: ${sensitivityCheck.reason}`);
          // Still allow but warn in console
        }
      }

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
   * Send a command to the terminal bot
   */
  const sendCommand = useCallback(
    async (command: string, files: File[]) => {
      if (!command.trim() && files.length === 0) return;

      setIsProcessing(true);

      try {
        // Process file attachments
        const attachments = files.length > 0 ? await processFiles(files) : undefined;

        // Add user message
        const userMessage: TerminalMessage = {
          id: `msg-${Date.now()}`,
          role: "user",
          content: command,
          timestamp: new Date(),
          attachments,
        };

        setMessages((prev) => [...prev, userMessage]);

        // Build context for the AI
        let systemPrompt = `You are Terminal Bot Command, a GUI wrapper for CLI-based AI tools like Claude Code.

Your role:
- Act as if you're Claude Code running in a terminal
- Help users with coding tasks, file operations, and development questions
- When users attach files, you can read and analyze their content directly
- When users attach images, you can SEE and VIEW them - describe what you see, analyze diagrams, read text from screenshots, identify UI elements, etc.
- Provide detailed, technical responses as Claude Code would
- Format code with proper markdown code blocks
- Be helpful, concise, and action-oriented

The user has a GUI interface with file/image upload capabilities that traditional CLI tools lack.
IMPORTANT: You have full vision capabilities - when images are uploaded, you can actually see them and analyze their visual content.`;

        // Add file system context if available
        if (fileTree) {
          // Check if file tree has changed
          const currentHash = generateFileTreeHash(fileTree);
          const fileTreeChanged = currentHash !== fileTreeHash;

          // Smart caching: only send full tree on first message or when changed
          if (!fileTreeSent || fileTreeChanged) {
            // Send full file tree
            const fileTreeStr = fileTreeToString(fileTree);
            systemPrompt += `\n\n## File System Access - YOU CAN READ, WRITE, AND DELETE FILES

You have FULL READ/WRITE/DELETE access to the user's project directory: "${fileTree.name}"

Current file structure:
\`\`\`
${fileTreeStr}
\`\`\`

## How to Perform File Operations:

### To READ a file:
Output: \`\`\`read-file:path/to/file.ts\`\`\`
Example: \`\`\`read-file:src/components/Button.tsx\`\`\`

### To WRITE/CREATE a file:
Output the file content in a code block with the language and path:
\`\`\`typescript:src/components/NewComponent.tsx
export function NewComponent() {
  return <div>Hello</div>;
}
\`\`\`

### To DELETE a file:
Output: \`\`\`delete-file:path/to/file.ts\`\`\`
Example: \`\`\`delete-file:src/components/OldComponent.tsx\`\`\`

The files will be automatically created/modified/deleted on the user's file system.

IMPORTANT:
- You CAN and SHOULD create, edit, delete files when the user asks
- Use the exact paths from the file tree
- For new files, create them in the appropriate directory
- The system will automatically perform file operations - you don't need to tell the user to copy/paste
- After performing file operations, confirm what you did
- Be careful with delete operations - make sure the user really wants to delete before doing so`;

            // Update cache
            setFileTreeHash(currentHash);
            setFileTreeSent(true);
          } else {
            // File tree unchanged - just send lightweight reference
            const summary = getFileSummary(fileTree);
            systemPrompt += `\n\n## File System Access - YOU CAN READ, WRITE, AND DELETE FILES

You have FULL READ/WRITE/DELETE access to the user's project directory: "${fileTree.name}"

📊 Project Stats: ${summary.totalFiles} files, ${summary.totalFolders} folders
✅ File structure cached from previous message (unchanged)

You can still perform all file operations (read/write/delete) using the same commands as before.
The full file tree is available in your context from the previous message.`;
          }
        } else {
          systemPrompt += `\n\nNote: No project directory is currently connected. The user can connect a directory to give you access to their project files.`;
        }

        // Build message history for context
        const conversationHistory: UnifiedChatMessage[] = [
          { role: "system", content: systemPrompt },
        ];

        // Add previous messages for context (last 10 messages)
        const recentMessages = messages.slice(-10);
        for (const msg of recentMessages) {
          if (msg.role === "user" || msg.role === "assistant") {
            // Check if this message has image attachments
            const hasImages = msg.attachments?.some((f) => f.isImage) ?? false;

            if (msg.role === "user" && hasImages && msg.attachments) {
              // Reconstruct multi-modal message with images
              const contentParts: any[] = [{ type: "text", text: msg.content }];

              for (const attachment of msg.attachments) {
                if (attachment.isImage) {
                  contentParts.push({
                    type: "image_url",
                    image_url: {
                      url: attachment.content,
                    },
                  });
                } else {
                  contentParts[0].text += `\n\n[Attached file: ${attachment.name}]\n\`\`\`\n${attachment.content.substring(0, 1000)}${
                    attachment.content.length > 1000 ? "\n... (truncated)" : ""
                  }\n\`\`\``;
                }
              }

              conversationHistory.push({
                role: "user",
                content: contentParts,
              });
            } else {
              // Simple text message or assistant message
              let content = msg.content;

              // Add attachment context for non-image files
              if (msg.attachments && msg.attachments.length > 0 && !hasImages) {
                const fileList = msg.attachments
                  .map((f) => `- ${f.name}\nContent:\n\`\`\`\n${f.content.substring(0, 1000)}${
                    f.content.length > 1000 ? "\n... (truncated)" : ""
                  }\n\`\`\``)
                  .join("\n");
                content += `\n\n[Attached files:\n${fileList}]`;
              }

              conversationHistory.push({
                role: msg.role === "user" ? "user" : "assistant",
                content,
              });
            }
          }
        }

        // Add current user message with attachments
        if (attachments && attachments.length > 0) {
          // Check if we have any images
          const hasImages = attachments.some((f) => f.isImage);

          if (hasImages) {
            // Use multi-modal content format for images
            const contentParts: any[] = [{ type: "text", text: command }];

            for (const attachment of attachments) {
              if (attachment.isImage) {
                // Add image in the format expected by the AI
                contentParts.push({
                  type: "image_url",
                  image_url: {
                    url: attachment.content, // This is already a data URL
                  },
                });
              } else {
                // Add text file content as text
                contentParts[0].text += `\n\n[Attached file: ${attachment.name}]\n\`\`\`\n${attachment.content.substring(0, 1000)}${
                  attachment.content.length > 1000 ? "\n... (truncated)" : ""
                }\n\`\`\``;
              }
            }

            conversationHistory.push({
              role: "user",
              content: contentParts,
            });
          } else {
            // Only text files - use simple text format
            let currentUserContent = command;
            const fileList = attachments
              .map((f) => {
                return `- ${f.name}\nContent:\n\`\`\`\n${f.content.substring(0, 1000)}${
                  f.content.length > 1000 ? "\n... (truncated)" : ""
                }\n\`\`\``;
              })
              .join("\n");

            currentUserContent += `\n\n[Attached files:\n${fileList}]`;

            conversationHistory.push({
              role: "user",
              content: currentUserContent,
            });
          }
        } else {
          // No attachments - simple text message
          conversationHistory.push({
            role: "user",
            content: command,
          });
        }

        // Get AI response
        const response = await sendUnifiedChatRequest(conversationHistory, {
          userTier,
          userId,
        });

        let responseContent = response.content;
        const fileOperations: string[] = [];

        // Process file operations if we have file system access
        if (fileTree && readFile && writeFile && deleteFile) {
          // Check rate limit before processing
          if (!checkRateLimit()) {
            fileOperations.push(`⚠️ Rate limit exceeded: Maximum ${MAX_OPERATIONS_PER_MINUTE} operations per minute. Please wait before performing more operations.`);
          } else {
            // Detect file write operations: ```language:path/to/file.ext
            const writeFileRegex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
            let match;

            while ((match = writeFileRegex.exec(response.content)) !== null) {
              const [fullMatch, language, filePath, fileContent] = match;

              // Check rate limit for each operation
              if (!checkRateLimit()) {
                fileOperations.push(`⚠️ Rate limit reached. Stopped processing after ${operationCount} operations.`);
                break;
              }

              try {
                const trimmedPath = filePath.trim();
                const trimmedContent = fileContent.trim();

                // Check for sensitive data
                const sensitivityCheck = containsSensitiveData(trimmedPath, trimmedContent);
                if (sensitivityCheck.isSensitive) {
                  fileOperations.push(`⚠️ Skipped ${trimmedPath}: ${sensitivityCheck.reason}`);
                  continue;
                }

                await writeFile(trimmedPath, trimmedContent);
                incrementOperationCount();
                fileOperations.push(`✅ Created/updated file: ${trimmedPath}`);
              } catch (error) {
                fileOperations.push(`❌ Failed to write ${filePath.trim()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }

            // Detect file read operations: ```read-file:path/to/file.ext```
            const readFileRegex = /```read-file:([^\n]+)```/g;

            while ((match = readFileRegex.exec(response.content)) !== null) {
              const filePath = match[1].trim();

              if (!checkRateLimit()) {
                fileOperations.push(`⚠️ Rate limit reached. Stopped processing operations.`);
                break;
              }

              try {
                const content = await readFile(filePath);
                incrementOperationCount();
                fileOperations.push(`📄 Read file: ${filePath}\n\`\`\`\n${content.substring(0, 500)}${content.length > 500 ? '\n... (truncated)' : ''}\n\`\`\``);
              } catch (error) {
                fileOperations.push(`❌ Failed to read ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }

            // Detect file delete operations: ```delete-file:path/to/file.ext```
            const deleteFileRegex = /```delete-file:([^\n]+)```/g;

            while ((match = deleteFileRegex.exec(response.content)) !== null) {
              const filePath = match[1].trim();

              if (!checkRateLimit()) {
                fileOperations.push(`⚠️ Rate limit reached. Stopped processing operations.`);
                break;
              }

              try {
                await deleteFile(filePath);
                incrementOperationCount();
                fileOperations.push(`🗑️ Deleted file: ${filePath}`);
              } catch (error) {
                fileOperations.push(`❌ Failed to delete ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          }
        }

        // Append file operation results to response
        if (fileOperations.length > 0) {
          responseContent += '\n\n---\n**File Operations:**\n' + fileOperations.join('\n');
        }

        // Add assistant message
        const assistantMessage: TerminalMessage = {
          id: `msg-${Date.now()}-${Math.random()}`,
          role: "assistant",
          content: responseContent,
          timestamp: new Date(),
          exitCode: fileOperations.some(op => op.startsWith('❌')) ? 1 : 0,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("Error processing command:", error);

        // Add error message
        const errorMessage: TerminalMessage = {
          id: `msg-${Date.now()}-${Math.random()}`,
          role: "error",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
          exitCode: 1, // Error
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsProcessing(false);
      }
    },
    [messages, userId, userTier, fileTree, readFile, writeFile, deleteFile]
  );

  /**
   * Clear the current session
   */
  const clearSession = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isProcessing,
    sendCommand,
    clearSession,
  };
}
