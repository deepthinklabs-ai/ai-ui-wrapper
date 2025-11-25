/**
 * Google Docs Tools Definition
 *
 * Defines the tools available for Google Docs integration.
 * Each tool includes name, description, parameters, and required permission.
 */

import type { DocsTool, DocsPermissions } from '../types';

/**
 * All available Google Docs tools
 */
export const DOCS_TOOLS: DocsTool[] = [
  // Read Tools
  {
    name: 'docs_read',
    description: 'Read the full content of a Google Doc including structure and formatting information',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc to read',
        },
      },
      required: ['documentId'],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'docs_get_text',
    description: 'Get the plain text content of a Google Doc (without formatting)',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
      },
      required: ['documentId'],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'docs_get_metadata',
    description: 'Get metadata about a Google Doc (title, revision ID, etc.)',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
      },
      required: ['documentId'],
    },
    requiredPermission: 'canRead',
  },

  // Write Tools
  {
    name: 'docs_insert_text',
    description: 'Insert text at a specific position in a Google Doc',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
        text: {
          type: 'string',
          description: 'The text to insert',
        },
        index: {
          type: 'number',
          description: 'The index position to insert at (1 = after title, omit for end of document)',
        },
      },
      required: ['documentId', 'text'],
    },
    requiredPermission: 'canWrite',
  },
  {
    name: 'docs_append_text',
    description: 'Append text to the end of a Google Doc',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
        text: {
          type: 'string',
          description: 'The text to append',
        },
      },
      required: ['documentId', 'text'],
    },
    requiredPermission: 'canWrite',
  },
  {
    name: 'docs_replace_text',
    description: 'Find and replace text in a Google Doc',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
        searchText: {
          type: 'string',
          description: 'The text to search for',
        },
        replaceText: {
          type: 'string',
          description: 'The text to replace with',
        },
        matchCase: {
          type: 'boolean',
          description: 'Whether to match case (default: false)',
        },
      },
      required: ['documentId', 'searchText', 'replaceText'],
    },
    requiredPermission: 'canWrite',
  },
  {
    name: 'docs_delete_content',
    description: 'Delete content from a Google Doc between specified indices',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
        startIndex: {
          type: 'number',
          description: 'The start index of content to delete',
        },
        endIndex: {
          type: 'number',
          description: 'The end index of content to delete',
        },
      },
      required: ['documentId', 'startIndex', 'endIndex'],
    },
    requiredPermission: 'canWrite',
  },

  // Create Tools
  {
    name: 'docs_create',
    description: 'Create a new Google Doc with optional initial content',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title of the new document',
        },
        content: {
          type: 'string',
          description: 'Optional initial content for the document',
        },
      },
      required: ['title'],
    },
    requiredPermission: 'canCreate',
  },

  // Comment Tools
  {
    name: 'docs_add_comment',
    description: 'Add a comment to a Google Doc',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
        content: {
          type: 'string',
          description: 'The comment text',
        },
        quotedText: {
          type: 'string',
          description: 'Optional text in the document to anchor the comment to',
        },
      },
      required: ['documentId', 'content'],
    },
    requiredPermission: 'canComment',
  },
  {
    name: 'docs_list_comments',
    description: 'List all comments on a Google Doc',
    input_schema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'The ID of the Google Doc',
        },
        includeDeleted: {
          type: 'boolean',
          description: 'Whether to include deleted comments (default: false)',
        },
      },
      required: ['documentId'],
    },
    requiredPermission: 'canComment',
  },
];

/**
 * Get tools that are enabled based on permissions
 */
export function getEnabledDocsTools(permissions: DocsPermissions): DocsTool[] {
  return DOCS_TOOLS.filter((tool) => permissions[tool.requiredPermission]);
}

/**
 * Convert tools to Claude tool format
 */
export function toClaudeToolFormat(tools: DocsTool[]): any[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}

/**
 * Generate system prompt section for Docs capabilities
 */
export function generateDocsSystemPrompt(config: { permissions: DocsPermissions }): string {
  const enabledTools = getEnabledDocsTools(config.permissions);

  if (enabledTools.length === 0) {
    return '';
  }

  const capabilities: string[] = [];

  if (config.permissions.canRead) {
    capabilities.push('- Read Google Docs content and metadata');
    capabilities.push('- Extract plain text from documents');
  }

  if (config.permissions.canWrite) {
    capabilities.push('- Insert, append, and replace text in documents');
    capabilities.push('- Delete content from documents');
  }

  if (config.permissions.canCreate) {
    capabilities.push('- Create new Google Docs');
  }

  if (config.permissions.canComment) {
    capabilities.push('- Add and list comments on documents');
  }

  return `
GOOGLE DOCS CAPABILITIES:
You have access to Google Docs integration. You can:
${capabilities.join('\n')}

When working with Google Docs:
- Document IDs can be found in the URL: docs.google.com/document/d/{DOCUMENT_ID}/edit
- Use docs_get_text to get plain text content for analysis
- Use docs_read for full document structure including formatting
- Always confirm successful operations with the user
`.trim();
}
