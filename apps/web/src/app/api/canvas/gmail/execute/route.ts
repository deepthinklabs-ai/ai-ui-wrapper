/**
 * Gmail Tool Execution API Route
 *
 * Executes Gmail operations on behalf of Genesis Bot nodes.
 * Handles all Gmail tools: search, read, send, draft, labels.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGmailClient } from '@/lib/googleClients';
import type { GmailPermissions, EmailMessage, GmailSearchParams } from '@/app/canvas/features/gmail-oauth/types';
import { withDebug } from '@/lib/debug';

interface ExecuteRequest {
  userId: string;
  nodeId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  permissions: GmailPermissions;
}

export const POST = withDebug(async (request, sessionId) => {
  try {
    const body: ExecuteRequest = await request.json();
    const { userId, nodeId, toolName, parameters, permissions } = body;

    // Validate required fields
    if (!userId || !toolName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, toolName' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify user has Pro tier (Gmail integration is a Pro feature)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (!profile || profile.tier !== 'pro') {
      return NextResponse.json(
        { error: 'Gmail integration requires Pro tier' },
        { status: 403 }
      );
    }

    // Get Gmail client (handles token refresh)
    let gmail;
    try {
      console.log(`[Gmail Execute] Getting Gmail client for user ${userId}`);
      gmail = await getGmailClient(userId);
      console.log(`[Gmail Execute] Gmail client obtained successfully`);
    } catch (err) {
      console.error('[Gmail Execute] Failed to get Gmail client:', err);
      return NextResponse.json(
        { error: 'Gmail not connected or token expired. Please reconnect.', details: err instanceof Error ? err.message : 'Unknown error' },
        { status: 401 }
      );
    }

    // Execute the requested tool
    let result;
    switch (toolName) {
      case 'gmail_search':
        if (!permissions.canSearch) {
          return NextResponse.json(
            { error: 'Search permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeSearch(gmail, parameters as unknown as GmailSearchParams);
        break;

      case 'gmail_read':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeRead(gmail, parameters.emailId as string);
        break;

      case 'gmail_read_thread':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeReadThread(gmail, parameters.threadId as string);
        break;

      case 'gmail_send':
        if (!permissions.canSend) {
          return NextResponse.json(
            { error: 'Send permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeSend(gmail, parameters);
        break;

      case 'gmail_draft':
        if (!permissions.canManageDrafts) {
          return NextResponse.json(
            { error: 'Draft permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeDraft(gmail, parameters);
        break;

      case 'gmail_get_labels':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeGetLabels(gmail);
        break;

      case 'gmail_modify_labels':
        if (!permissions.canManageLabels) {
          return NextResponse.json(
            { error: 'Label management permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeModifyLabels(gmail, parameters);
        break;

      case 'gmail_get_unread_count':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeGetUnreadCount(gmail, parameters.labelId as string);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown tool: ${toolName}` },
          { status: 400 }
        );
    }

    // Log tool usage (not content for privacy)
    console.log(`[Gmail Execute] User ${userId} | Node ${nodeId} | Tool: ${toolName} | Success`);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Gmail Execute] Error:', error);
    console.error('[Gmail Execute] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

// Tool execution functions

async function executeSearch(gmail: any, params: GmailSearchParams) {
  const maxResults = Math.min(params.maxResults || 10, 50);

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: params.query,
    maxResults,
    labelIds: params.labelIds,
  });

  const messages = response.data.messages || [];

  // Fetch details for each message
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

  // Extract body
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

async function executeSend(gmail: any, params: Record<string, unknown>) {
  const { to, subject, body, cc, bcc, replyToMessageId } = params;

  // Build email content
  const toAddresses = (to as string[]).join(', ');
  const ccAddresses = cc ? (cc as string[]).join(', ') : '';
  const bccAddresses = bcc ? (bcc as string[]).join(', ') : '';

  let emailContent = `To: ${toAddresses}\r\n`;
  if (ccAddresses) emailContent += `Cc: ${ccAddresses}\r\n`;
  if (bccAddresses) emailContent += `Bcc: ${bccAddresses}\r\n`;
  emailContent += `Subject: ${subject}\r\n`;
  emailContent += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
  emailContent += body;

  // SECURITY: Use replaceAll instead of regex to avoid ReDoS warnings
  const encodedMessage = Buffer.from(emailContent)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');  // Safe: bounded pattern at end of string

  const requestBody: any = {
    raw: encodedMessage,
  };

  if (replyToMessageId) {
    requestBody.threadId = replyToMessageId;
  }

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody,
  });

  return {
    messageId: response.data.id,
    threadId: response.data.threadId,
    sent: true,
  };
}

async function executeDraft(gmail: any, params: Record<string, unknown>) {
  const { to, subject, body, cc } = params;

  const toAddresses = (to as string[]).join(', ');
  const ccAddresses = cc ? (cc as string[]).join(', ') : '';

  let emailContent = `To: ${toAddresses}\r\n`;
  if (ccAddresses) emailContent += `Cc: ${ccAddresses}\r\n`;
  emailContent += `Subject: ${subject}\r\n`;
  emailContent += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
  emailContent += body;

  // SECURITY: Use replaceAll instead of regex to avoid ReDoS warnings
  const encodedMessage = Buffer.from(emailContent)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');  // Safe: bounded pattern at end of string

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
