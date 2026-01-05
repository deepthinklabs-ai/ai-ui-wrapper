/**
 * Import File Security Utility
 *
 * Provides security validation specifically for importing .thread, .canvas, and .chatbot files.
 * These are JSON-based configuration files with custom extensions.
 *
 * Security checks:
 * - Exact extension matching (no fallback to .json)
 * - File size limits
 * - JSON structure validation
 * - Type field verification
 *
 * Debug logging can be enabled by setting:
 * - localStorage.setItem('DEBUG_IMPORT_FILE_SECURITY', 'true')
 */

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

const DEBUG_KEY = 'DEBUG_IMPORT_FILE_SECURITY';

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEBUG_KEY) === 'true';
  } catch {
    return false;
  }
}

function debugLog(category: string, message: string, data?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  const prefix = `[ImportFileSecurity:${category}]`;
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

function debugWarn(category: string, message: string, data?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  const prefix = `[ImportFileSecurity:${category}]`;
  if (data) {
    console.warn(prefix, message, data);
  } else {
    console.warn(prefix, message);
  }
}

function debugError(category: string, message: string, data?: Record<string, unknown>): void {
  const prefix = `[ImportFileSecurity:${category}]`;
  if (isDebugEnabled() && data) {
    console.error(prefix, message, data);
  } else {
    console.error(prefix, message);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type ImportFileType = 'thread' | 'canvas' | 'chatbot';

export type ImportFileValidationResult = {
  valid: boolean;
  error?: string;
  parsedData?: Record<string, unknown>;
};

export type ImportFileSecurityOptions = {
  /** Maximum file size in bytes (default: 5MB) */
  maxSizeBytes?: number;
  /** Whether to parse and return JSON data (default: true) */
  parseJson?: boolean;
  /** Whether to validate the type field matches (default: true) */
  validateTypeField?: boolean;
};

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Maximum file size for import files (5MB default - these are just JSON configs) */
const DEFAULT_MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum length for individual string fields (100KB) */
const DEFAULT_MAX_STRING_FIELD_LENGTH = 100 * 1024;

/** Maximum length for system prompts (50KB) */
const MAX_SYSTEM_PROMPT_LENGTH = 50 * 1024;

/** Maximum length for message content (100KB) */
const MAX_MESSAGE_CONTENT_LENGTH = 100 * 1024;

/** Maximum length for names/titles (1KB) */
const MAX_NAME_LENGTH = 1024;

/** Maximum length for descriptions (10KB) */
const MAX_DESCRIPTION_LENGTH = 10 * 1024;

/** Mapping of file types to their expected extensions */
const FILE_TYPE_EXTENSIONS: Record<ImportFileType, string> = {
  thread: '.thread',
  canvas: '.canvas',
  chatbot: '.chatbot',
};

/** Mapping of file types to their expected type field value */
const FILE_TYPE_IDENTIFIERS: Record<ImportFileType, string> = {
  thread: 'thread',
  canvas: 'canvas',
  chatbot: 'chatbot',
};

/** Dangerous HTML/script patterns to strip from imported content */
const DANGEROUS_PATTERNS = [
  // Script tags (handles </script > with optional whitespace before >)
  /<script\b[^<]*(?:(?!<\/script\s*>)<[^<]*)*<\/script\s*>/gi,
  // Event handlers
  /\bon\w+\s*=\s*["'][^"']*["']/gi,
  /\bon\w+\s*=\s*[^\s>]+/gi,
  // JavaScript URLs
  /javascript\s*:/gi,
  // Data URLs with scripts
  /data\s*:\s*text\/html/gi,
  // VBScript
  /vbscript\s*:/gi,
  // Expression (IE)
  /expression\s*\(/gi,
  // Import statements in style
  /@import/gi,
  // Binding (Firefox XBL)
  /-moz-binding/gi,
];

/** Tags that should be escaped (not just stripped) */
const ESCAPE_TAGS = ['<', '>', '&', '"', "'"];
const ESCAPE_MAP: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#x27;',
};

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize a string by removing dangerous HTML/script patterns
 * Returns the sanitized string
 */
export function sanitizeImportString(input: string): string {
  if (typeof input !== 'string') return '';

  let sanitized = input;

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  debugLog('Sanitize', 'String sanitized', {
    originalLength: input.length,
    sanitizedLength: sanitized.length,
    removed: input.length - sanitized.length,
  });

  return sanitized;
}

/**
 * Escape HTML entities in a string (for display purposes)
 */
export function escapeHtmlEntities(input: string): string {
  if (typeof input !== 'string') return '';

  let escaped = input;
  for (const char of ESCAPE_TAGS) {
    escaped = escaped.split(char).join(ESCAPE_MAP[char]);
  }

  return escaped;
}

/**
 * Validate that a string field does not exceed length limits
 */
export function validateFieldLength(
  value: unknown,
  fieldName: string,
  maxLength: number
): { valid: boolean; error?: string } {
  if (typeof value !== 'string') {
    return { valid: true }; // Non-string values handled elsewhere
  }

  if (value.length > maxLength) {
    const error = `Field "${fieldName}" exceeds maximum length (${value.length} > ${maxLength})`;
    debugWarn('FieldLength', error);
    return { valid: false, error };
  }

  return { valid: true };
}

/**
 * Deep sanitize an object by removing dangerous patterns from all string values
 * Also validates field lengths based on field names
 */
export function sanitizeImportData(
  data: Record<string, unknown>,
  path: string = ''
): { sanitized: Record<string, unknown>; errors: string[] } {
  const sanitized: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string') {
      // Determine max length based on field name
      let maxLength = DEFAULT_MAX_STRING_FIELD_LENGTH;
      const lowerKey = key.toLowerCase();

      if (lowerKey.includes('name') || lowerKey.includes('title') || lowerKey.includes('label')) {
        maxLength = MAX_NAME_LENGTH;
      } else if (lowerKey.includes('description')) {
        maxLength = MAX_DESCRIPTION_LENGTH;
      } else if (lowerKey.includes('system_prompt') || lowerKey.includes('systemprompt')) {
        maxLength = MAX_SYSTEM_PROMPT_LENGTH;
      } else if (lowerKey.includes('content') || lowerKey.includes('message')) {
        maxLength = MAX_MESSAGE_CONTENT_LENGTH;
      }

      // Validate length
      const lengthCheck = validateFieldLength(value, currentPath, maxLength);
      if (!lengthCheck.valid) {
        errors.push(lengthCheck.error!);
        // Truncate to max length instead of failing completely
        sanitized[key] = sanitizeImportString(value.substring(0, maxLength));
      } else {
        // Sanitize the string
        sanitized[key] = sanitizeImportString(value);
      }
    } else if (Array.isArray(value)) {
      // Recursively sanitize array elements
      const sanitizedArray: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const result = sanitizeImportData(item as Record<string, unknown>, `${currentPath}[${i}]`);
          sanitizedArray.push(result.sanitized);
          errors.push(...result.errors);
        } else if (typeof item === 'string') {
          sanitizedArray.push(sanitizeImportString(item));
        } else {
          sanitizedArray.push(item);
        }
      }
      sanitized[key] = sanitizedArray;
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      const result = sanitizeImportData(value as Record<string, unknown>, currentPath);
      sanitized[key] = result.sanitized;
      errors.push(...result.errors);
    } else {
      // Keep primitives as-is
      sanitized[key] = value;
    }
  }

  return { sanitized, errors };
}

/**
 * Pre-parse check: Verify JSON structure before full parsing
 * This is a lightweight check to catch obvious issues early
 */
export function preParseJsonCheck(content: string): { valid: boolean; error?: string } {
  debugLog('PreParse', 'Running pre-parse checks', { contentLength: content.length });

  // Check for empty content
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'File content is empty' };
  }

  // Check that content starts with { (object) - our files should all be objects
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) {
    debugWarn('PreParse', 'Content does not start with {');
    return { valid: false, error: 'Invalid file format: expected JSON object' };
  }

  // Check that content ends with }
  if (!trimmed.endsWith('}')) {
    debugWarn('PreParse', 'Content does not end with }');
    return { valid: false, error: 'Invalid file format: malformed JSON object' };
  }

  // Check for suspicious patterns that might indicate injection attempts
  const suspiciousPatterns = [
    /__proto__/i,
    /constructor\s*\[/i,
    /prototype\s*\[/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      debugWarn('PreParse', 'Suspicious pattern detected', { pattern: pattern.toString() });
      return { valid: false, error: 'Invalid file: contains suspicious patterns' };
    }
  }

  debugLog('PreParse', 'Pre-parse checks passed');
  return { valid: true };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if the file extension matches exactly what we expect
 */
export function validateImportFileExtension(
  filename: string,
  expectedType: ImportFileType
): { valid: boolean; error?: string } {
  const expectedExt = FILE_TYPE_EXTENSIONS[expectedType];

  debugLog('Extension', 'Checking file extension', {
    filename,
    expectedType,
    expectedExt,
  });

  if (!filename.toLowerCase().endsWith(expectedExt)) {
    debugWarn('Extension', 'REJECTED: Extension mismatch', {
      filename,
      expected: expectedExt,
      actual: filename.slice(filename.lastIndexOf('.')),
    });
    return {
      valid: false,
      error: `Invalid file type. Expected a ${expectedExt} file, got "${filename}"`,
    };
  }

  debugLog('Extension', 'Extension valid', { filename });
  return { valid: true };
}

/**
 * Check if the file size is within acceptable limits
 */
export function validateImportFileSize(
  file: File,
  maxSizeBytes?: number
): { valid: boolean; error?: string } {
  const limit = maxSizeBytes ?? DEFAULT_MAX_IMPORT_SIZE_BYTES;

  debugLog('FileSize', 'Checking import file size', {
    filename: file.name,
    size: file.size,
    limit,
  });

  if (file.size === 0) {
    debugWarn('FileSize', 'REJECTED: Empty file', { filename: file.name });
    return { valid: false, error: 'File is empty' };
  }

  if (file.size > limit) {
    const limitMB = (limit / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    debugWarn('FileSize', 'REJECTED: File too large', {
      filename: file.name,
      sizeMB: fileSizeMB,
      limitMB,
    });
    return {
      valid: false,
      error: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${limitMB}MB) for import files`,
    };
  }

  debugLog('FileSize', 'File size OK', { filename: file.name, size: file.size });
  return { valid: true };
}

/**
 * Read and parse JSON content from a file
 * Includes pre-parse security checks and content sanitization
 */
export async function readAndParseImportFile(
  file: File,
  options: { sanitize?: boolean } = { sanitize: true }
): Promise<{ valid: boolean; data?: Record<string, unknown>; error?: string; warnings?: string[] }> {
  debugLog('Parse', 'Reading file content', { filename: file.name });

  try {
    const content = await file.text();

    // Step 1: Pre-parse security check
    debugLog('Parse', 'Running pre-parse checks');
    const preParseResult = preParseJsonCheck(content);
    if (!preParseResult.valid) {
      debugWarn('Parse', 'REJECTED: Pre-parse check failed', { error: preParseResult.error });
      return { valid: false, error: preParseResult.error };
    }

    // Step 2: Parse JSON
    debugLog('Parse', 'Parsing JSON', { contentLength: content.length });

    const data = JSON.parse(content);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      debugWarn('Parse', 'REJECTED: Not a valid JSON object', { filename: file.name });
      return { valid: false, error: 'Invalid file format: expected a JSON object' };
    }

    // Step 3: Sanitize content if requested (default: true)
    if (options.sanitize !== false) {
      debugLog('Parse', 'Sanitizing imported data');
      const { sanitized, errors } = sanitizeImportData(data);

      debugLog('Parse', 'JSON parsed and sanitized successfully', {
        filename: file.name,
        keys: Object.keys(sanitized),
        sanitizationWarnings: errors.length,
      });

      // Return with warnings if any fields were truncated
      return {
        valid: true,
        data: sanitized,
        warnings: errors.length > 0 ? errors : undefined,
      };
    }

    debugLog('Parse', 'JSON parsed successfully (no sanitization)', {
      filename: file.name,
      keys: Object.keys(data),
    });

    return { valid: true, data };
  } catch (err) {
    debugError('Parse', 'REJECTED: JSON parse error', {
      filename: file.name,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return {
      valid: false,
      error: `Failed to parse file: ${err instanceof Error ? err.message : 'Invalid JSON'}`,
    };
  }
}

/**
 * Validate that the parsed data has the expected type field
 */
export function validateImportFileType(
  data: Record<string, unknown>,
  expectedType: ImportFileType
): { valid: boolean; error?: string } {
  const expectedTypeValue = FILE_TYPE_IDENTIFIERS[expectedType];

  debugLog('TypeField', 'Checking type field', {
    expected: expectedTypeValue,
    actual: data.type,
  });

  if (data.type !== expectedTypeValue) {
    debugWarn('TypeField', 'REJECTED: Type field mismatch', {
      expected: expectedTypeValue,
      actual: data.type,
    });
    return {
      valid: false,
      error: `Invalid file type: expected "${expectedTypeValue}", got "${data.type}"`,
    };
  }

  debugLog('TypeField', 'Type field valid');
  return { valid: true };
}

// ============================================================================
// COMPREHENSIVE VALIDATION
// ============================================================================

/**
 * Comprehensive validation for import files
 * Validates extension, size, JSON structure, and type field
 */
export async function validateImportFile(
  file: File,
  expectedType: ImportFileType,
  options: ImportFileSecurityOptions = {}
): Promise<ImportFileValidationResult> {
  const {
    maxSizeBytes,
    parseJson = true,
    validateTypeField = true,
  } = options;

  debugLog('Validate', '========== Starting import file validation ==========', {
    filename: file.name,
    expectedType,
    size: file.size,
  });

  // Step 1: Validate file extension
  debugLog('Validate', 'Step 1: Checking file extension...');
  const extCheck = validateImportFileExtension(file.name, expectedType);
  if (!extCheck.valid) {
    debugError('Validate', 'REJECTED at step 1 (extension)', { error: extCheck.error });
    return { valid: false, error: extCheck.error };
  }

  // Step 2: Validate file size
  debugLog('Validate', 'Step 2: Checking file size...');
  const sizeCheck = validateImportFileSize(file, maxSizeBytes);
  if (!sizeCheck.valid) {
    debugError('Validate', 'REJECTED at step 2 (file size)', { error: sizeCheck.error });
    return { valid: false, error: sizeCheck.error };
  }

  // Step 3: Parse JSON content (if requested)
  if (parseJson) {
    debugLog('Validate', 'Step 3: Parsing JSON content...');
    const parseResult = await readAndParseImportFile(file);
    if (!parseResult.valid || !parseResult.data) {
      debugError('Validate', 'REJECTED at step 3 (JSON parse)', { error: parseResult.error });
      return { valid: false, error: parseResult.error };
    }

    // Step 4: Validate type field (if requested)
    if (validateTypeField) {
      debugLog('Validate', 'Step 4: Validating type field...');
      const typeCheck = validateImportFileType(parseResult.data, expectedType);
      if (!typeCheck.valid) {
        debugError('Validate', 'REJECTED at step 4 (type field)', { error: typeCheck.error });
        return { valid: false, error: typeCheck.error };
      }
    }

    debugLog('Validate', '========== Validation PASSED ==========', {
      filename: file.name,
      expectedType,
    });

    return { valid: true, parsedData: parseResult.data };
  }

  debugLog('Validate', '========== Validation PASSED (no JSON parsing) ==========', {
    filename: file.name,
    expectedType,
  });

  return { valid: true };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Validate a .thread import file
 */
export async function validateThreadImportFile(
  file: File,
  options?: ImportFileSecurityOptions
): Promise<ImportFileValidationResult> {
  return validateImportFile(file, 'thread', options);
}

/**
 * Validate a .canvas import file
 */
export async function validateCanvasImportFile(
  file: File,
  options?: ImportFileSecurityOptions
): Promise<ImportFileValidationResult> {
  return validateImportFile(file, 'canvas', options);
}

/**
 * Validate a .chatbot import file
 */
export async function validateChatbotImportFile(
  file: File,
  options?: ImportFileSecurityOptions
): Promise<ImportFileValidationResult> {
  return validateImportFile(file, 'chatbot', options);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const IMPORT_FILE_LIMITS = {
  DEFAULT_MAX_SIZE_BYTES: DEFAULT_MAX_IMPORT_SIZE_BYTES,
  MAX_STRING_FIELD_LENGTH: DEFAULT_MAX_STRING_FIELD_LENGTH,
  MAX_SYSTEM_PROMPT_LENGTH,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} as const;

export const IMPORT_FILE_EXTENSIONS = FILE_TYPE_EXTENSIONS;

// ============================================================================
// DEBUG CONTROL
// ============================================================================

/**
 * Enable or disable debug logging for import file security
 */
export function enableImportFileSecurityDebug(enable: boolean): void {
  if (typeof window === 'undefined') {
    console.warn('[ImportFileSecurity] Debug toggle only available in browser');
    return;
  }
  try {
    if (enable) {
      localStorage.setItem(DEBUG_KEY, 'true');
      console.log('[ImportFileSecurity] Debug logging ENABLED');
    } else {
      localStorage.removeItem(DEBUG_KEY);
      console.log('[ImportFileSecurity] Debug logging DISABLED');
    }
  } catch (error) {
    console.error('[ImportFileSecurity] Failed to toggle debug mode:', error);
  }
}

/**
 * Check if debug logging is currently enabled
 */
export function isImportFileSecurityDebugEnabled(): boolean {
  return isDebugEnabled();
}
