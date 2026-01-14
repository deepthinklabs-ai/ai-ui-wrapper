/**
 * Google Docs Execute API Route
 *
 * Executes Docs tool calls for Genesis Bot nodes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDocsClient, getDriveClient } from '@/lib/googleClients';
import type { DocsPermissions } from '@/app/canvas/features/docs-oauth/types';
import { extractPlainText, getDocumentEndIndex } from '@/app/canvas/features/docs-oauth/lib/utils';
import { withDebug } from '@/lib/debug';

interface ExecuteRequestBody {
  toolName: string;
  params: any;
  userId: string;
  nodeId: string;
  permissions: DocsPermissions;
}

export const POST = withDebug(async (request, sessionId) => {
  try {
    const body: ExecuteRequestBody = await request.json();
    const { toolName, params, userId, nodeId, permissions } = body;

    if (!toolName || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get authenticated Docs client
    let docs;
    try {
      docs = await getDocsClient(userId);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'No Google OAuth connection found' },
        { status: 401 }
      );
    }

    // Get Drive client for comments (optional)
    let drive;
    try {
      drive = await getDriveClient(userId);
    } catch (error) {
      // Drive is only needed for comments
    }

    let result: any;

    switch (toolName) {
      case 'docs_read':
        if (!permissions.canRead) throw new Error('Read permission not granted');
        result = await docs.documents.get({ documentId: params.documentId });
        return NextResponse.json({ success: true, data: result.data });

      case 'docs_get_text':
        if (!permissions.canRead) throw new Error('Read permission not granted');
        const textDoc = await docs.documents.get({ documentId: params.documentId });
        const plainText = extractPlainText(textDoc.data);
        return NextResponse.json({
          success: true,
          data: { documentId: params.documentId, title: textDoc.data.title, text: plainText },
        });

      case 'docs_get_metadata':
        if (!permissions.canRead) throw new Error('Read permission not granted');
        const metaDoc = await docs.documents.get({ documentId: params.documentId });
        return NextResponse.json({
          success: true,
          data: {
            documentId: metaDoc.data.documentId,
            title: metaDoc.data.title,
            revisionId: metaDoc.data.revisionId,
          },
        });

      case 'docs_insert_text':
        if (!permissions.canWrite) throw new Error('Write permission not granted');
        await docs.documents.batchUpdate({
          documentId: params.documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: params.index || 1 },
                  text: params.text,
                },
              },
            ],
          },
        });
        return NextResponse.json({
          success: true,
          data: { message: `Text inserted at index ${params.index || 1}` },
        });

      case 'docs_append_text':
        if (!permissions.canWrite) throw new Error('Write permission not granted');
        const appendDoc = await docs.documents.get({ documentId: params.documentId });
        const endIndex = getDocumentEndIndex(appendDoc.data);
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
        return NextResponse.json({
          success: true,
          data: { message: 'Text appended to document' },
        });

      case 'docs_replace_text':
        if (!permissions.canWrite) throw new Error('Write permission not granted');
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
        return NextResponse.json({
          success: true,
          data: { message: `Replaced "${params.searchText}" with "${params.replaceText}"` },
        });

      case 'docs_delete_content':
        if (!permissions.canWrite) throw new Error('Write permission not granted');
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
        return NextResponse.json({
          success: true,
          data: { message: `Deleted content from index ${params.startIndex} to ${params.endIndex}` },
        });

      case 'docs_create':
        if (!permissions.canCreate) throw new Error('Create permission not granted');
        const createResponse = await docs.documents.create({
          requestBody: { title: params.title },
        });
        const documentId = createResponse.data.documentId!;
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
        return NextResponse.json({
          success: true,
          data: {
            documentId,
            title: params.title,
            url: `https://docs.google.com/document/d/${documentId}/edit`,
          },
        });

      case 'docs_add_comment':
        if (!permissions.canComment) throw new Error('Comment permission not granted');
        if (!drive) throw new Error('Drive client not available');
        const comment: any = { content: params.content };
        if (params.quotedText) {
          comment.quotedFileContent = { value: params.quotedText };
        }
        const commentResponse = await drive.comments.create({
          fileId: params.documentId,
          fields: 'id,content,author,createdTime',
          requestBody: comment,
        });
        return NextResponse.json({
          success: true,
          data: { commentId: commentResponse.data.id, content: commentResponse.data.content },
        });

      case 'docs_list_comments':
        if (!permissions.canComment) throw new Error('Comment permission not granted');
        if (!drive) throw new Error('Drive client not available');
        const commentsResponse = await drive.comments.list({
          fileId: params.documentId,
          fields: 'comments(id,content,author,createdTime,modifiedTime,resolved,quotedFileContent)',
          includeDeleted: params.includeDeleted || false,
        });
        return NextResponse.json({
          success: true,
          data: { comments: commentsResponse.data.comments || [], count: commentsResponse.data.comments?.length || 0 },
        });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown tool: ${toolName}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Docs Execute API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
