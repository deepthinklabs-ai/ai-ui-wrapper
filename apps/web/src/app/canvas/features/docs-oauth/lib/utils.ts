/**
 * Google Docs OAuth Utility Functions
 *
 * Helper functions for Docs integration.
 */

/**
 * Extract document ID from various Google Docs URL formats
 */
export function extractDocumentId(urlOrId: string): string | null {
  // If it's already just an ID (no slashes, reasonable length)
  if (!urlOrId.includes('/') && urlOrId.length > 10 && urlOrId.length < 100) {
    return urlOrId;
  }

  // Try to extract from URL patterns
  const patterns = [
    // Standard edit URL: docs.google.com/document/d/{id}/edit
    /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/,
    // Direct link: drive.google.com/open?id={id}
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    // File link: drive.google.com/file/d/{id}
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Build a Google Docs URL from a document ID
 */
export function buildDocsUrl(documentId: string): string {
  return `https://docs.google.com/document/d/${documentId}/edit`;
}

/**
 * Extract plain text from Google Docs content structure
 */
export function extractPlainText(content: any): string {
  if (!content || !content.body || !content.body.content) {
    return '';
  }

  const textParts: string[] = [];

  for (const element of content.body.content) {
    if (element.paragraph && element.paragraph.elements) {
      for (const textElement of element.paragraph.elements) {
        if (textElement.textRun && textElement.textRun.content) {
          textParts.push(textElement.textRun.content);
        }
      }
    }
  }

  return textParts.join('');
}

/**
 * Get the end index of a document (for appending)
 */
export function getDocumentEndIndex(content: any): number {
  if (!content || !content.body || !content.body.content) {
    return 1;
  }

  const bodyContent = content.body.content;
  if (bodyContent.length === 0) {
    return 1;
  }

  const lastElement = bodyContent[bodyContent.length - 1];
  return lastElement.endIndex || 1;
}

/**
 * Format document content for display
 */
export function formatDocumentContent(content: any): string {
  const plainText = extractPlainText(content);
  const lines = plainText.split('\n').filter((line: string) => line.trim());

  if (lines.length === 0) {
    return '(Empty document)';
  }

  if (lines.length > 20) {
    return lines.slice(0, 20).join('\n') + '\n... (truncated)';
  }

  return lines.join('\n');
}

/**
 * Validate document ID format
 */
export function isValidDocumentId(id: string): boolean {
  // Google Docs IDs are typically 44 characters of alphanumeric, hyphens, and underscores
  return /^[a-zA-Z0-9_-]{10,100}$/.test(id);
}

/**
 * Format error message for docs operations
 */
export function formatDocsError(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    // Clean up Google API error messages
    const message = error.message;

    if (message.includes('404')) {
      return 'Document not found. Please check the document ID and ensure you have access.';
    }

    if (message.includes('403')) {
      return 'Access denied. You may not have permission to access this document.';
    }

    if (message.includes('401')) {
      return 'Authentication failed. Please reconnect your Google account.';
    }

    return message;
  }

  return 'An unknown error occurred';
}
