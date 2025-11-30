/**
 * Gmail Tool Executor (Server-Side)
 *
 * Server-side execution of Gmail tools - calls Gmail API directly.
 * Use this in API routes (server-side) instead of gmailToolExecutor.ts which uses HTTP fetch.
 */

import { getGmailClient } from '@/lib/googleClients';
import { createClient } from '@supabase/supabase-js';
import type { GmailPermissions, GmailSearchParams, EmailMessage } from '../types';

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

// Uploaded attachment from user's message
interface UploadedAttachment {
  name: string;
  type: string; // MIME type
  size: number;
  content: string; // base64 content
  isImage: boolean;
}

/**
 * Execute a single Gmail tool call (server-side)
 */
export async function executeGmailToolCallServer(
  toolCall: ToolCall,
  userId: string,
  nodeId: string,
  permissions: GmailPermissions,
  uploadedAttachments?: UploadedAttachment[]
): Promise<ToolResult> {
  try {
    console.log(`[Gmail Server] Executing tool: ${toolCall.name}`);
    console.log(`[Gmail Server] User: ${userId}, Node: ${nodeId}`);
    console.log(`[Gmail Server] Input:`, JSON.stringify(toolCall.input).substring(0, 200));

    // Verify Pro tier
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (!profile || profile.tier !== 'pro') {
      return {
        toolCallId: toolCall.id,
        result: JSON.stringify({ error: 'Gmail integration requires Pro tier' }),
        isError: true,
      };
    }

    // Get Gmail client
    let gmail;
    try {
      gmail = await getGmailClient(userId);
      console.log(`[Gmail Server] Gmail client obtained successfully`);
    } catch (err) {
      console.error('[Gmail Server] Failed to get Gmail client:', err);
      return {
        toolCallId: toolCall.id,
        result: JSON.stringify({
          error: 'Gmail not connected or token expired. Please reconnect.',
          details: err instanceof Error ? err.message : 'Unknown error',
        }),
        isError: true,
      };
    }

    // Execute based on tool name
    let result;
    switch (toolCall.name) {
      case 'gmail_search':
        if (!permissions.canSearch) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Search permission not granted' }),
            isError: true,
          };
        }
        result = await executeSearch(gmail, toolCall.input as unknown as GmailSearchParams);
        break;

      case 'gmail_read':
        if (!permissions.canRead) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Read permission not granted' }),
            isError: true,
          };
        }
        result = await executeRead(gmail, toolCall.input.emailId as string);
        break;

      case 'gmail_read_thread':
        if (!permissions.canRead) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Read permission not granted' }),
            isError: true,
          };
        }
        result = await executeReadThread(gmail, toolCall.input.threadId as string);
        break;

      case 'gmail_send':
        if (!permissions.canSend) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Send permission not granted' }),
            isError: true,
          };
        }
        result = await executeSend(gmail, toolCall.input, uploadedAttachments);
        break;

      case 'gmail_draft':
        if (!permissions.canManageDrafts) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Draft permission not granted' }),
            isError: true,
          };
        }
        result = await executeDraft(gmail, toolCall.input, uploadedAttachments);
        break;

      case 'gmail_get_labels':
        if (!permissions.canRead) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Read permission not granted' }),
            isError: true,
          };
        }
        result = await executeGetLabels(gmail);
        break;

      case 'gmail_modify_labels':
        if (!permissions.canManageLabels) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Label management permission not granted' }),
            isError: true,
          };
        }
        result = await executeModifyLabels(gmail, toolCall.input);
        break;

      case 'gmail_get_unread_count':
        if (!permissions.canRead) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Read permission not granted' }),
            isError: true,
          };
        }
        result = await executeGetUnreadCount(gmail, toolCall.input.labelId as string);
        break;

      default:
        return {
          toolCallId: toolCall.id,
          result: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
          isError: true,
        };
    }

    console.log(`[Gmail Server] Tool ${toolCall.name} executed successfully`);
    console.log(`[Gmail Server] Result preview:`, JSON.stringify(result).substring(0, 300));

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    console.error(`[Gmail Server] Error executing ${toolCall.name}:`, error);
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
 * Execute multiple Gmail tool calls (server-side)
 */
export async function executeGmailToolCallsServer(
  toolCalls: ToolCall[],
  userId: string,
  nodeId: string,
  permissions: GmailPermissions,
  uploadedAttachments?: UploadedAttachment[]
): Promise<ToolResult[]> {
  console.log(`[Gmail Server] Executing ${toolCalls.length} tool calls`);
  if (uploadedAttachments?.length) {
    console.log(`[Gmail Server] ${uploadedAttachments.length} uploaded attachments available`);
  }
  const results = await Promise.all(
    toolCalls.map((tc) => executeGmailToolCallServer(tc, userId, nodeId, permissions, uploadedAttachments))
  );
  return results;
}

// Gmail execution functions (same as in route.ts but local)

async function executeSearch(gmail: any, params: GmailSearchParams) {
  const maxResults = Math.min(params.maxResults || 10, 50);

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: params.query,
    maxResults,
    labelIds: params.labelIds,
  });

  const messages = response.data.messages || [];

  const emails: Partial<EmailMessage>[] = await Promise.all(
    messages.map(async (msg: { id: string; threadId: string }) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });

      const headers = detail.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      return {
        id: msg.id,
        threadId: msg.threadId,
        from: getHeader('From'),
        to: getHeader('To').split(',').map((e: string) => e.trim()),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        snippet: detail.data.snippet || '',
        labels: detail.data.labelIds || [],
        isRead: !detail.data.labelIds?.includes('UNREAD'),
      };
    })
  );

  return {
    resultCount: emails.length,
    emails,
  };
}

async function executeRead(gmail: any, emailId: string) {
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: emailId,
    format: 'full',
  });

  const message = response.data;
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  let body = '';
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  } else if (message.payload?.parts) {
    const textPart = message.payload.parts.find(
      (p: { mimeType: string }) => p.mimeType === 'text/plain'
    );
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader('From'),
    to: getHeader('To').split(',').map((e: string) => e.trim()),
    cc: getHeader('Cc') ? getHeader('Cc').split(',').map((e: string) => e.trim()) : [],
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body,
    labels: message.labelIds || [],
    isRead: !message.labelIds?.includes('UNREAD'),
    hasAttachments: message.payload?.parts?.some((p: { filename: string }) => p.filename) || false,
  };
}

async function executeReadThread(gmail: any, threadId: string) {
  const response = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  });

  const messages = response.data.messages || [];

  return {
    threadId,
    messageCount: messages.length,
    messages: messages.map((msg: any) => {
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: { name: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      let body = '';
      if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
      } else if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find(
          (p: { mimeType: string }) => p.mimeType === 'text/plain'
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      return {
        id: msg.id,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        body,
        snippet: msg.snippet,
      };
    }),
  };
}

// Type for email attachments
interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: string; // base64 encoded
}

/**
 * Build a MIME message with optional attachments
 */
function buildMimeMessage(
  headers: string,
  body: string,
  attachments?: EmailAttachment[]
): string {
  if (!attachments || attachments.length === 0) {
    // Simple plain text message
    return `${headers}Content-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
  }

  // Multipart message with attachments
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`;

  let mimeMessage = `${headers}Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  // Add body part
  mimeMessage += `--${boundary}\r\n`;
  mimeMessage += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
  mimeMessage += `${body}\r\n\r\n`;

  // Add attachment parts
  for (const attachment of attachments) {
    mimeMessage += `--${boundary}\r\n`;
    mimeMessage += `Content-Type: ${attachment.mimeType}\r\n`;
    mimeMessage += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
    mimeMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    mimeMessage += `${attachment.content}\r\n\r\n`;
  }

  // End boundary
  mimeMessage += `--${boundary}--`;

  return mimeMessage;
}

async function executeSend(
  gmail: any,
  params: Record<string, unknown>,
  uploadedAttachments?: UploadedAttachment[]
) {
  const { to, subject, body, cc, bcc, replyToMessageId, attachments, includeUploadedAttachments } = params;

  const toAddresses = (to as string[]).join(', ');
  const ccAddresses = cc ? (cc as string[]).join(', ') : '';
  const bccAddresses = bcc ? (bcc as string[]).join(', ') : '';

  // Build final attachments list
  let emailAttachments: EmailAttachment[] = (attachments as EmailAttachment[]) || [];

  // If includeUploadedAttachments is true, convert and add user's uploaded files
  if (includeUploadedAttachments && uploadedAttachments?.length) {
    console.log(`[Gmail Server] Including ${uploadedAttachments.length} user-uploaded attachments`);
    const convertedAttachments = uploadedAttachments.map((ua) => ({
      filename: ua.name,
      mimeType: ua.type,
      content: ua.content,
    }));
    emailAttachments = [...emailAttachments, ...convertedAttachments];
  }

  console.log(`[Gmail Server] Sending email with ${emailAttachments.length} total attachments`);

  // For replies, we need to get the original message's Message-ID and threadId
  let originalMessageId: string | null = null;
  let threadId: string | null = null;

  if (replyToMessageId) {
    try {
      console.log(`[Gmail Server] Fetching original message for reply: ${replyToMessageId}`);
      const originalMsg = await gmail.users.messages.get({
        userId: 'me',
        id: replyToMessageId,
        format: 'metadata',
        metadataHeaders: ['Message-ID', 'References'],
      });

      const msgHeaders = originalMsg.data.payload?.headers || [];
      const messageIdHeader = msgHeaders.find(
        (h: { name: string }) => h.name.toLowerCase() === 'message-id'
      );
      originalMessageId = messageIdHeader?.value || null;
      threadId = originalMsg.data.threadId;

      console.log(`[Gmail Server] Original Message-ID: ${originalMessageId}`);
      console.log(`[Gmail Server] Thread ID: ${threadId}`);
    } catch (err) {
      console.error('[Gmail Server] Failed to fetch original message for reply:', err);
      // Continue anyway - it will just create a new thread
    }
  }

  // Build headers
  let headers = `To: ${toAddresses}\r\n`;
  if (ccAddresses) headers += `Cc: ${ccAddresses}\r\n`;
  if (bccAddresses) headers += `Bcc: ${bccAddresses}\r\n`;

  // Add reply headers for proper threading
  if (originalMessageId) {
    headers += `In-Reply-To: ${originalMessageId}\r\n`;
    headers += `References: ${originalMessageId}\r\n`;
  }

  headers += `Subject: ${subject}\r\n`;

  // Build MIME message with optional attachments
  const emailContent = buildMimeMessage(
    headers,
    body as string,
    emailAttachments.length > 0 ? emailAttachments : undefined
  );

  const encodedMessage = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody: any = {
    raw: encodedMessage,
  };

  // Add threadId for proper Gmail threading
  if (threadId) {
    requestBody.threadId = threadId;
  }

  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody,
    });

    return {
      messageId: response.data.id,
      threadId: response.data.threadId,
      sent: true,
      isReply: !!originalMessageId,
      attachmentCount: emailAttachments.length,
    };
  } catch (sendError: any) {
    // If sending with threadId fails (404), retry without threadId
    if (sendError.code === 404 && threadId) {
      console.warn('[Gmail Server] Failed to send with threadId, retrying without threading');
      delete requestBody.threadId;

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody,
      });

      return {
        messageId: response.data.id,
        threadId: response.data.threadId,
        sent: true,
        isReply: false,
        attachmentCount: emailAttachments.length,
        warning: 'Could not thread reply, sent as new message',
      };
    }
    throw sendError;
  }
}

async function executeDraft(
  gmail: any,
  params: Record<string, unknown>,
  uploadedAttachments?: UploadedAttachment[]
) {
  const { to, subject, body, cc, attachments, includeUploadedAttachments } = params;

  const toAddresses = (to as string[]).join(', ');
  const ccAddresses = cc ? (cc as string[]).join(', ') : '';

  // Build final attachments list
  let emailAttachments: EmailAttachment[] = (attachments as EmailAttachment[]) || [];

  // If includeUploadedAttachments is true, convert and add user's uploaded files
  if (includeUploadedAttachments && uploadedAttachments?.length) {
    console.log(`[Gmail Server] Including ${uploadedAttachments.length} user-uploaded attachments in draft`);
    const convertedAttachments = uploadedAttachments.map((ua) => ({
      filename: ua.name,
      mimeType: ua.type,
      content: ua.content,
    }));
    emailAttachments = [...emailAttachments, ...convertedAttachments];
  }

  console.log(`[Gmail Server] Creating draft with ${emailAttachments.length} total attachments`);

  // Build headers
  let headers = `To: ${toAddresses}\r\n`;
  if (ccAddresses) headers += `Cc: ${ccAddresses}\r\n`;
  headers += `Subject: ${subject}\r\n`;

  // Build MIME message with optional attachments
  const emailContent = buildMimeMessage(
    headers,
    body as string,
    emailAttachments.length > 0 ? emailAttachments : undefined
  );

  const encodedMessage = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encodedMessage,
      },
    },
  });

  return {
    draftId: response.data.id,
    created: true,
    attachmentCount: emailAttachments.length,
  };
}

async function executeGetLabels(gmail: any) {
  const response = await gmail.users.labels.list({
    userId: 'me',
  });

  const labels = response.data.labels || [];

  return {
    labels: labels.map((label: any) => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messagesTotal: label.messagesTotal,
      messagesUnread: label.messagesUnread,
    })),
  };
}

async function executeModifyLabels(gmail: any, params: Record<string, unknown>) {
  const { emailId, addLabels, removeLabels } = params;

  await gmail.users.messages.modify({
    userId: 'me',
    id: emailId,
    requestBody: {
      addLabelIds: addLabels || [],
      removeLabelIds: removeLabels || [],
    },
  });

  return {
    modified: true,
    emailId,
    labelsAdded: addLabels || [],
    labelsRemoved: removeLabels || [],
  };
}

async function executeGetUnreadCount(gmail: any, labelId: string = 'INBOX') {
  const response = await gmail.users.labels.get({
    userId: 'me',
    id: labelId,
  });

  return {
    label: response.data.name,
    unreadCount: response.data.messagesUnread || 0,
    totalCount: response.data.messagesTotal || 0,
  };
}
