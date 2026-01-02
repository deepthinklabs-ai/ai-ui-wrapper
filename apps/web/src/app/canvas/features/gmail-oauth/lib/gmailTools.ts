/**
 * Gmail Tools for AI
 *
 * Tool definitions that can be provided to Claude/OpenAI for Gmail operations.
 * These tools allow Genesis Bots to interact with Gmail on behalf of users.
 */

import type { GmailToolDefinition, GmailPermissions } from '../types';

/**
 * All available Gmail tools
 */
export const gmailTools: GmailToolDefinition[] = [
  {
    name: 'gmail_search',
    description:
      'Search for emails in the connected Gmail account. Use Gmail search syntax (e.g., "from:user@example.com", "subject:meeting", "is:unread", "after:2024/01/01").',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Gmail search query. Examples: "from:boss@company.com", "subject:urgent is:unread", "has:attachment after:2024/01/01"',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of emails to return (default: 10, max: 50)',
          default: 10,
        },
      },
      required: ['query'],
    },
    requiredPermission: 'canSearch',
  },
  {
    name: 'gmail_read',
    description:
      'Read the full content of a specific email by its ID. Use gmail_search first to find email IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: {
          type: 'string',
          description: 'The ID of the email to read (obtained from gmail_search results)',
        },
      },
      required: ['emailId'],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'gmail_read_thread',
    description:
      'Read all emails in a conversation thread. Useful for understanding full email conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: {
          type: 'string',
          description: 'The thread ID to read (obtained from gmail_search results)',
        },
      },
      required: ['threadId'],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'gmail_send',
    description:
      'Send an email from the connected Gmail account. IMPORTANT: If the user has uploaded any files or images with their message and wants to send them as attachments, you MUST set includeUploadedAttachments to true. Use with caution - this will actually send an email.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of recipient email addresses',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text)',
        },
        cc: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of CC recipients',
        },
        bcc: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of BCC recipients',
        },
        replyToMessageId: {
          type: 'string',
          description: 'Optional message ID to reply to (for threading)',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file',
              },
              mimeType: {
                type: 'string',
                description: 'MIME type of the file (e.g., "image/png", "application/pdf")',
              },
              content: {
                type: 'string',
                description: 'Base64-encoded file content',
              },
            },
            required: ['filename', 'mimeType', 'content'],
          },
          description: 'Optional array of file attachments to include (for programmatically generated content)',
        },
        includeUploadedAttachments: {
          type: 'boolean',
          description:
            'IMPORTANT: Set this to true when the user has uploaded files/images with their message and wants to send them as email attachments. This will automatically attach all user-uploaded files to the email.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
    requiredPermission: 'canSend',
  },
  {
    name: 'gmail_draft',
    description:
      'Create an email draft without sending. IMPORTANT: If the user has uploaded any files or images with their message and wants to include them as attachments, you MUST set includeUploadedAttachments to true. The user can review and send manually.',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of recipient email addresses',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text)',
        },
        cc: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of CC recipients',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file',
              },
              mimeType: {
                type: 'string',
                description: 'MIME type of the file (e.g., "image/png", "application/pdf")',
              },
              content: {
                type: 'string',
                description: 'Base64-encoded file content',
              },
            },
            required: ['filename', 'mimeType', 'content'],
          },
          description: 'Optional array of file attachments to include (for programmatically generated content)',
        },
        includeUploadedAttachments: {
          type: 'boolean',
          description:
            'IMPORTANT: Set this to true when the user has uploaded files/images with their message and wants to include them as draft attachments. This will automatically attach all user-uploaded files to the draft.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
    requiredPermission: 'canManageDrafts',
  },
  {
    name: 'gmail_get_labels',
    description: 'Get all labels/folders in the Gmail account.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'gmail_modify_labels',
    description: 'Add or remove labels from an email (e.g., mark as read, archive, star).',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: {
          type: 'string',
          description: 'The ID of the email to modify',
        },
        addLabels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to add (e.g., "STARRED", "IMPORTANT", custom label IDs)',
        },
        removeLabels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to remove (e.g., "UNREAD", "INBOX" for archiving)',
        },
      },
      required: ['emailId'],
    },
    requiredPermission: 'canManageLabels',
  },
  {
    name: 'gmail_get_unread_count',
    description: 'Get the count of unread emails, optionally filtered by label.',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: {
          type: 'string',
          description: 'Optional label ID to filter by (default: INBOX)',
          default: 'INBOX',
        },
      },
      required: [],
    },
    requiredPermission: 'canRead',
  },
];

/**
 * Get tools that are enabled based on permissions
 */
export function getEnabledGmailTools(permissions: GmailPermissions | undefined): GmailToolDefinition[] {
  // Return empty array if permissions are not defined
  if (!permissions) {
    return [];
  }
  return gmailTools.filter((tool) => permissions[tool.requiredPermission]);
}

/**
 * Convert Gmail tools to Claude tool format
 */
export function toClaudeToolFormat(tools: GmailToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/**
 * Convert Gmail tools to OpenAI function format
 */
export function toOpenAIFunctionFormat(tools: GmailToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}
