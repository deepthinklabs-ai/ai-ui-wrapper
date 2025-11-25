/**
 * Gmail Tool Executor
 *
 * Executes Gmail tool calls made by AI during conversations.
 * Handles the bridge between Claude's tool_use responses and the Gmail API.
 */

import type { GmailOAuthConfig, GmailOperationResult } from '../types';

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResult {
  toolCallId: string;
  result: string;
  isError: boolean;
}

/**
 * Execute a Gmail tool call
 */
export async function executeGmailToolCall(
  toolCall: ToolCall,
  userId: string,
  nodeId: string,
  permissions: GmailOAuthConfig['permissions']
): Promise<ToolResult> {
  try {
    const response = await fetch('/api/canvas/gmail/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        nodeId,
        toolName: toolCall.name,
        parameters: toolCall.input,
        permissions,
      }),
    });

    const result: GmailOperationResult = await response.json();

    if (!result.success) {
      return {
        toolCallId: toolCall.id,
        result: JSON.stringify({ error: result.error }),
        isError: true,
      };
    }

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(result.data),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      result: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to execute Gmail tool',
      }),
      isError: true,
    };
  }
}

/**
 * Execute multiple Gmail tool calls
 */
export async function executeGmailToolCalls(
  toolCalls: ToolCall[],
  userId: string,
  nodeId: string,
  permissions: GmailOAuthConfig['permissions']
): Promise<ToolResult[]> {
  const results = await Promise.all(
    toolCalls.map((tc) => executeGmailToolCall(tc, userId, nodeId, permissions))
  );
  return results;
}

/**
 * Check if a tool name is a Gmail tool
 */
export function isGmailTool(toolName: string): boolean {
  return toolName.startsWith('gmail_');
}

/**
 * Filter Gmail tools from a list of tool calls
 */
export function filterGmailToolCalls(toolCalls: ToolCall[]): ToolCall[] {
  return toolCalls.filter((tc) => isGmailTool(tc.name));
}

/**
 * Generate system prompt for Gmail capabilities
 */
export function generateGmailSystemPrompt(config: GmailOAuthConfig): string {
  if (!config.enabled) {
    return '';
  }

  const capabilities: string[] = [];

  if (config.permissions.canSearch) {
    capabilities.push('- Search emails using Gmail search syntax (gmail_search)');
  }
  if (config.permissions.canRead) {
    capabilities.push('- Read email content (gmail_read, gmail_read_thread)');
    capabilities.push('- Get unread count (gmail_get_unread_count)');
    capabilities.push('- List labels/folders (gmail_get_labels)');
  }
  if (config.permissions.canSend) {
    capabilities.push('- Send emails (gmail_send) - USE WITH CAUTION');
  }
  if (config.permissions.canManageDrafts) {
    capabilities.push('- Create email drafts (gmail_draft)');
  }
  if (config.permissions.canManageLabels) {
    capabilities.push('- Add/remove labels (gmail_modify_labels)');
  }

  if (capabilities.length === 0) {
    return '';
  }

  let prompt = `📧 GMAIL INTEGRATION: You have access to the user's Gmail account with the following capabilities:

${capabilities.join('\n')}

When asked about emails, use these tools proactively. For search, use Gmail search syntax like:
- "from:user@example.com" - emails from a specific sender
- "subject:meeting" - emails with subject containing "meeting"
- "is:unread" - unread emails
- "after:2024/01/01" - emails after a date
- "has:attachment" - emails with attachments

Always be careful with email operations. When reading emails, summarize them helpfully.`;

  if (config.permissions.canSend && config.requireConfirmation) {
    prompt += `\n\nIMPORTANT: Before sending any email, clearly show the user the draft and ask for confirmation.`;
  }

  if (config.maxEmailsPerHour) {
    prompt += `\n\nNote: This bot is limited to ${config.maxEmailsPerHour} emails per hour.`;
  }

  return prompt;
}
