/**
 * Google Docs OAuth Feature Types
 *
 * Type definitions for Docs integration in Genesis Bot nodes.
 */

/**
 * Docs permissions that can be granted to a bot
 */
export interface DocsPermissions {
  canRead: boolean;
  canWrite: boolean;
  canCreate: boolean;
  canComment: boolean;
}

/**
 * Docs OAuth configuration for a Genesis Bot node
 */
export interface DocsOAuthConfig {
  enabled: boolean;
  connectionId: string | null;
  permissions: DocsPermissions;
}

/**
 * Parameters for reading a document
 */
export interface DocsReadParams {
  documentId: string;
}

/**
 * Parameters for getting document content as plain text
 */
export interface DocsGetTextParams {
  documentId: string;
}

/**
 * Parameters for creating a document
 */
export interface DocsCreateParams {
  title: string;
  content?: string;
}

/**
 * Parameters for inserting text into a document
 */
export interface DocsInsertTextParams {
  documentId: string;
  text: string;
  index?: number; // Insert position (1 = beginning after title)
}

/**
 * Parameters for appending text to a document
 */
export interface DocsAppendTextParams {
  documentId: string;
  text: string;
}

/**
 * Parameters for replacing text in a document
 */
export interface DocsReplaceTextParams {
  documentId: string;
  searchText: string;
  replaceText: string;
  matchCase?: boolean;
}

/**
 * Parameters for deleting content from a document
 */
export interface DocsDeleteContentParams {
  documentId: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parameters for getting document metadata
 */
export interface DocsMetadataParams {
  documentId: string;
}

/**
 * Parameters for adding a comment
 */
export interface DocsAddCommentParams {
  documentId: string;
  content: string;
  quotedText?: string; // Text to anchor the comment to
}

/**
 * Parameters for listing comments
 */
export interface DocsListCommentsParams {
  documentId: string;
  includeDeleted?: boolean;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  documentId: string;
  title: string;
  revisionId: string;
  suggestionsViewMode: string;
}

/**
 * Document content structure
 */
export interface DocumentContent {
  documentId: string;
  title: string;
  body: {
    content: DocumentElement[];
  };
}

/**
 * Document element (paragraph, table, etc.)
 */
export interface DocumentElement {
  startIndex: number;
  endIndex: number;
  paragraph?: {
    elements: TextElement[];
  };
  table?: any;
  sectionBreak?: any;
}

/**
 * Text element within a paragraph
 */
export interface TextElement {
  startIndex: number;
  endIndex: number;
  textRun?: {
    content: string;
    textStyle?: any;
  };
}

/**
 * Comment on a document
 */
export interface DocumentComment {
  id: string;
  content: string;
  author: {
    displayName: string;
    emailAddress: string;
  };
  createdTime: string;
  modifiedTime: string;
  resolved: boolean;
  quotedFileContent?: {
    value: string;
  };
}

/**
 * Result of a Docs operation
 */
export interface DocsOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Tool definition for Claude
 */
export interface DocsTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  requiredPermission: keyof DocsPermissions;
}

/**
 * Default Docs OAuth configuration
 */
export const DEFAULT_DOCS_CONFIG: DocsOAuthConfig = {
  enabled: false,
  connectionId: null,
  permissions: {
    canRead: true,
    canWrite: false,
    canCreate: false,
    canComment: false,
  },
};
