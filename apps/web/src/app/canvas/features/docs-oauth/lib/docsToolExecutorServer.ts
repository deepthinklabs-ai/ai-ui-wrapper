/**
 * Google Docs Tool Executor (Server-side)
 *
 * Executes Docs tool calls directly using googleapis.
 * This is used by the Ask/Answer API route for server-side execution.
 */

import { google, docs_v1, drive_v3 } from 'googleapis';
import { getDocsClient, getDriveClient } from '@/lib/googleClients';
import type { DocsPermissions } from '../types';
import { extractPlainText, getDocumentEndIndex } from './utils';

interface ToolCall {
  id: string;
  name: string;
  input: any;
}

interface ToolResult {
  toolCallId: string;
  result: string;
  isError: boolean;
}

/**
 * Execute Docs tool calls server-side
 */
export async function executeDocsToolCallsServer(
  toolCalls: ToolCall[],
  userId: string,
  nodeId: string,
  permissions: DocsPermissions
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  let docs: docs_v1.Docs | null = null;
  let drive: drive_v3.Drive | null = null;

  try {
    docs = await getDocsClient(userId);
  } catch (error) {
    console.error('[DocsExecutor] Failed to get Docs client:', error);
    return toolCalls.map((call) => ({
      toolCallId: call.id,
      result: JSON.stringify({ error: 'Failed to initialize Google Docs client' }),
      isError: true,
    }));
  }

  try {
    drive = await getDriveClient(userId);
  } catch (error) {
    console.error('[DocsExecutor] Failed to get Drive client:', error);
    // Drive is only needed for comments, so we can continue without it
  }

  for (const call of toolCalls) {
    try {
      console.log(`[DocsExecutor] Executing ${call.name} for node ${nodeId}`);

      let result: any;

      switch (call.name) {
        case 'docs_read':
          if (!permissions.canRead) throw new Error('Read permission not granted');
          result = await executeDocsRead(docs, call.input);
          break;

        case 'docs_get_text':
          if (!permissions.canRead) throw new Error('Read permission not granted');
          result = await executeDocsGetText(docs, call.input);
          break;

        case 'docs_get_metadata':
          if (!permissions.canRead) throw new Error('Read permission not granted');
          result = await executeDocsGetMetadata(docs, call.input);
          break;

        case 'docs_insert_text':
          if (!permissions.canWrite) throw new Error('Write permission not granted');
          result = await executeDocsInsertText(docs, call.input);
          break;

        case 'docs_append_text':
          if (!permissions.canWrite) throw new Error('Write permission not granted');
          result = await executeDocsAppendText(docs, call.input);
          break;

        case 'docs_replace_text':
          if (!permissions.canWrite) throw new Error('Write permission not granted');
          result = await executeDocsReplaceText(docs, call.input);
          break;

        case 'docs_delete_content':
          if (!permissions.canWrite) throw new Error('Write permission not granted');
          result = await executeDocsDeleteContent(docs, call.input);
          break;

        case 'docs_create':
          if (!permissions.canCreate) throw new Error('Create permission not granted');
          result = await executeDocsCreate(docs, call.input);
          break;

        case 'docs_add_comment':
          if (!permissions.canComment) throw new Error('Comment permission not granted');
          if (!drive) throw new Error('Drive client not available for comments');
          result = await executeDocsAddComment(drive, call.input);
          break;

        case 'docs_list_comments':
          if (!permissions.canComment) throw new Error('Comment permission not granted');
          if (!drive) throw new Error('Drive client not available for comments');
          result = await executeDocsListComments(drive, call.input);
          break;

        default:
          throw new Error(`Unknown tool: ${call.name}`);
      }

      results.push({
        toolCallId: call.id,
        result: JSON.stringify(result),
        isError: false,
      });
    } catch (error) {
      console.error(`[DocsExecutor] Error executing ${call.name}:`, error);
      results.push({
        toolCallId: call.id,
        result: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        isError: true,
      });
    }
  }

  return results;
}

// Tool implementations

async function executeDocsRead(docs: docs_v1.Docs, params: { documentId: string }) {
  const response = await docs.documents.get({
    documentId: params.documentId,
  });
  return response.data;
}

async function executeDocsGetText(docs: docs_v1.Docs, params: { documentId: string }) {
  const response = await docs.documents.get({
    documentId: params.documentId,
  });
  const plainText = extractPlainText(response.data);
  return {
    documentId: params.documentId,
    title: response.data.title,
    text: plainText,
  };
}

async function executeDocsGetMetadata(docs: docs_v1.Docs, params: { documentId: string }) {
  const response = await docs.documents.get({
    documentId: params.documentId,
  });
  return {
    documentId: response.data.documentId,
    title: response.data.title,
    revisionId: response.data.revisionId,
  };
}

async function executeDocsInsertText(
  docs: docs_v1.Docs,
  params: { documentId: string; text: string; index?: number }
) {
  const index = params.index || 1;

  await docs.documents.batchUpdate({
    documentId: params.documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index },
            text: params.text,
          },
        },
      ],
    },
  });

  return {
    success: true,
    message: `Text inserted at index ${index}`,
    documentId: params.documentId,
  };
}

async function executeDocsAppendText(
  docs: docs_v1.Docs,
  params: { documentId: string; text: string }
) {
  // First get the document to find the end index
  const docResponse = await docs.documents.get({
    documentId: params.documentId,
  });

  const endIndex = getDocumentEndIndex(docResponse.data);

  await docs.documents.batchUpdate({
    documentId: params.documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: endIndex - 1 },
            text: params.text,
          },
        },
      ],
    },
  });

  return {
    success: true,
    message: 'Text appended to document',
    documentId: params.documentId,
  };
}

async function executeDocsReplaceText(
  docs: docs_v1.Docs,
  params: { documentId: string; searchText: string; replaceText: string; matchCase?: boolean }
) {
  await docs.documents.batchUpdate({
    documentId: params.documentId,
    requestBody: {
      requests: [
        {
          replaceAllText: {
            containsText: {
              text: params.searchText,
              matchCase: params.matchCase || false,
            },
            replaceText: params.replaceText,
          },
        },
      ],
    },
  });

  return {
    success: true,
    message: `Replaced "${params.searchText}" with "${params.replaceText}"`,
    documentId: params.documentId,
  };
}

async function executeDocsDeleteContent(
  docs: docs_v1.Docs,
  params: { documentId: string; startIndex: number; endIndex: number }
) {
  await docs.documents.batchUpdate({
    documentId: params.documentId,
    requestBody: {
      requests: [
        {
          deleteContentRange: {
            range: {
              startIndex: params.startIndex,
              endIndex: params.endIndex,
            },
          },
        },
      ],
    },
  });

  return {
    success: true,
    message: `Deleted content from index ${params.startIndex} to ${params.endIndex}`,
    documentId: params.documentId,
  };
}

async function executeDocsCreate(
  docs: docs_v1.Docs,
  params: { title: string; content?: string }
) {
  // Create the document
  const createResponse = await docs.documents.create({
    requestBody: {
      title: params.title,
    },
  });

  const documentId = createResponse.data.documentId!;

  // If content is provided, insert it
  if (params.content) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: params.content,
            },
          },
        ],
      },
    });
  }

  return {
    success: true,
    documentId,
    title: params.title,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

async function executeDocsAddComment(
  drive: drive_v3.Drive,
  params: { documentId: string; content: string; quotedText?: string }
) {
  const comment: any = {
    content: params.content,
  };

  if (params.quotedText) {
    comment.quotedFileContent = {
      value: params.quotedText,
    };
  }

  const response = await drive.comments.create({
    fileId: params.documentId,
    fields: 'id,content,author,createdTime',
    requestBody: comment,
  });

  return {
    success: true,
    commentId: response.data.id,
    content: response.data.content,
  };
}

async function executeDocsListComments(
  drive: drive_v3.Drive,
  params: { documentId: string; includeDeleted?: boolean }
) {
  const response = await drive.comments.list({
    fileId: params.documentId,
    fields: 'comments(id,content,author,createdTime,modifiedTime,resolved,quotedFileContent)',
    includeDeleted: params.includeDeleted || false,
  });

  return {
    comments: response.data.comments || [],
    count: response.data.comments?.length || 0,
  };
}
