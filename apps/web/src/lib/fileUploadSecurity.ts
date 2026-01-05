/**
 * File Upload Security Utility
 *
 * Provides comprehensive security validation for file uploads:
 * - File type allowlist/blocklist validation
 * - File size limits
 * - MIME type verification using magic bytes
 * - Filename sanitization
 * - Content validation
 *
 * Debug logging can be enabled by setting:
 * - localStorage.setItem('DEBUG_FILE_UPLOAD_SECURITY', 'true')
 */

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

const DEBUG_KEY = 'DEBUG_FILE_UPLOAD_SECURITY';

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
  const prefix = `[FileUploadSecurity:${category}]`;
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

function debugWarn(category: string, message: string, data?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  const prefix = `[FileUploadSecurity:${category}]`;
  if (data) {
    console.warn(prefix, message, data);
  } else {
    console.warn(prefix, message);
  }
}

function debugError(category: string, message: string, data?: Record<string, unknown>): void {
  // Always log errors, but with more detail when debug is enabled
  const prefix = `[FileUploadSecurity:${category}]`;
  if (isDebugEnabled() && data) {
    console.error(prefix, message, data);
  } else {
    console.error(prefix, message);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type FileValidationResult = {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
};

export type FileValidationOptions = {
  maxSizeBytes?: number;
  allowedTypes?: string[];
  blockedTypes?: string[];
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  sanitizeFilename?: boolean;
  verifyMagicBytes?: boolean;
};

// ============================================================================
// CONFIGURATION
// ============================================================================

// Default configuration
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB for images

// Allowed MIME types for chat file uploads
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  // Code files
  'text/javascript',
  'application/javascript',
  'text/typescript',
  'application/typescript',
  'text/x-python',
  'application/x-python',
  'text/x-java',
  'text/x-c',
  'text/x-cpp',
  'text/x-csharp',
  'text/x-go',
  'text/x-rust',
  'text/html',
  'text/css',
  'application/json',
  'application/xml',
  'text/xml',
  'application/x-yaml',
  'text/yaml',
  // Archives (if needed)
  // 'application/zip',
  // 'application/gzip',
]);

// Blocked MIME types (dangerous file types)
const BLOCKED_MIME_TYPES = new Set([
  // Executables
  'application/x-executable',
  'application/x-msdos-program',
  'application/x-msdownload',
  'application/exe',
  'application/x-exe',
  'application/dos-exe',
  'application/x-winexe',
  'application/msdos-windows',
  'application/x-msi',
  // Scripts that could be dangerous
  'application/x-sh',
  'application/x-bash',
  'application/x-csh',
  'application/x-shellscript',
  'application/bat',
  'application/x-bat',
  'application/x-msbatch',
  'application/cmd',
  // Java
  'application/java-archive',
  'application/x-java-class',
  // Office macros
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-word.document.macroEnabled.12',
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
  // Other potentially dangerous
  'application/x-dosexec',
  'application/hta',
  'application/x-ms-shortcut',
]);

// Blocked file extensions
const BLOCKED_EXTENSIONS = new Set([
  // Executables
  '.exe', '.msi', '.dll', '.com', '.bat', '.cmd', '.ps1', '.vbs', '.vbe',
  '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.psc1', '.scr',
  // Scripts
  '.sh', '.bash', '.zsh', '.csh', '.ksh',
  // Java
  '.jar', '.class',
  // Office with macros
  '.xlsm', '.xlsb', '.xltm', '.docm', '.dotm', '.pptm', '.potm', '.ppam', '.ppsm', '.sldm',
  // Other dangerous
  '.hta', '.lnk', '.inf', '.reg', '.scf', '.url', '.pif',
  // Archives that might contain executables
  '.iso', '.img',
]);

// Allowed extensions (used when strict mode is enabled)
const ALLOWED_EXTENSIONS = new Set([
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
  // Documents
  '.pdf', '.txt', '.md', '.csv', '.rtf',
  // Code files
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.xml', '.yaml', '.yml', '.toml',
  '.sql', '.graphql', '.prisma',
  // Config files
  '.env.example', '.gitignore', '.dockerignore', '.editorconfig',
  // Data files
  '.log',
]);

// ============================================================================
// MAGIC BYTES SIGNATURES
// ============================================================================

// Magic bytes signatures for common file types
const MAGIC_BYTES: Record<string, { signature: number[]; offset?: number }[]> = {
  // Images
  'image/jpeg': [{ signature: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/gif': [
    { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [
    { signature: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
    // WebP also has WEBP at offset 8, but checking RIFF is usually sufficient
  ],
  'image/bmp': [{ signature: [0x42, 0x4D] }], // BM
  // Documents
  'application/pdf': [{ signature: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  // Archives
  'application/zip': [{ signature: [0x50, 0x4B, 0x03, 0x04] }], // PK
  'application/gzip': [{ signature: [0x1F, 0x8B] }],
  // Executables (for blocking)
  'application/x-msdownload': [
    { signature: [0x4D, 0x5A] }, // MZ (DOS/Windows executable)
  ],
  'application/x-executable': [
    { signature: [0x7F, 0x45, 0x4C, 0x46] }, // ELF (Linux executable)
  ],
};

// ============================================================================
// MAGIC BYTES VERIFICATION
// ============================================================================

/**
 * Check if a file's actual content matches its claimed MIME type using magic bytes
 */
export async function verifyMagicBytes(file: File): Promise<{ valid: boolean; detectedType?: string; error?: string }> {
  debugLog('MagicBytes', 'Starting verification', { fileName: file.name, claimedType: file.type, size: file.size });

  try {
    // Read the first 16 bytes of the file
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    debugLog('MagicBytes', 'Read file header bytes', {
      bytes: Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
    });

    // Check for known dangerous signatures first
    const dangerousSignatures = [
      { type: 'executable', signature: [0x4D, 0x5A] }, // MZ - Windows executable
      { type: 'executable', signature: [0x7F, 0x45, 0x4C, 0x46] }, // ELF - Linux executable
    ];

    for (const { type, signature } of dangerousSignatures) {
      if (matchesSignature(bytes, signature, 0)) {
        debugError('MagicBytes', 'BLOCKED: Dangerous file signature detected', { type, fileName: file.name });
        return {
          valid: false,
          detectedType: type,
          error: `File appears to be an ${type} - upload blocked for security`,
        };
      }
    }

    // For text files, we can't verify magic bytes, so we allow them
    if (file.type.startsWith('text/') || file.type === 'application/json' || file.type === 'application/xml') {
      debugLog('MagicBytes', 'Text file - skipping magic bytes check', { type: file.type });
      return { valid: true };
    }

    // Check if the file matches its claimed type
    const expectedSignatures = MAGIC_BYTES[file.type];
    if (expectedSignatures) {
      for (const { signature, offset = 0 } of expectedSignatures) {
        if (matchesSignature(bytes, signature, offset)) {
          debugLog('MagicBytes', 'File matches claimed type', { type: file.type });
          return { valid: true, detectedType: file.type };
        }
      }
      // File doesn't match its claimed type
      debugWarn('MagicBytes', 'File content does not match claimed type', {
        claimedType: file.type,
        actualBytes: Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
      });
      return {
        valid: false,
        error: `File content does not match claimed type (${file.type})`,
      };
    }

    // For types without signatures, allow but log
    debugLog('MagicBytes', 'No signature defined for type - allowing', { type: file.type });
    return { valid: true };
  } catch (error) {
    debugError('MagicBytes', 'Verification failed', { error: error instanceof Error ? error.message : 'Unknown' });
    return {
      valid: false,
      error: `Failed to verify file content: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if bytes match a signature at a given offset
 */
function matchesSignature(bytes: Uint8Array, signature: number[], offset: number): boolean {
  if (bytes.length < offset + signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// FILENAME SANITIZATION
// ============================================================================

/**
 * Sanitize a filename to prevent path traversal and other security issues
 */
export function sanitizeFilename(filename: string): string {
  debugLog('Sanitize', 'Starting filename sanitization', { original: filename });

  if (!filename || typeof filename !== 'string') {
    debugWarn('Sanitize', 'Invalid filename - using default', { received: typeof filename });
    return 'unnamed_file';
  }

  let sanitized = filename
    // Remove path separators
    .replace(/[/\\]/g, '_')
    // Remove null bytes
    .replace(/\x00/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove Windows invalid characters
    .replace(/[<>:"|?*]/g, '_')
    // Remove path traversal attempts
    .replace(/\.\./g, '_')
    // Remove leading/trailing dots and spaces
    .replace(/^[\s.]+|[\s.]+$/g, '')
    // Collapse multiple underscores
    .replace(/_+/g, '_')
    // Limit length
    .slice(0, 255);

  // Ensure we have a valid filename
  if (!sanitized || sanitized === '_') {
    sanitized = 'unnamed_file';
  }

  if (sanitized !== filename) {
    debugLog('Sanitize', 'Filename was sanitized', { original: filename, sanitized });
  }

  return sanitized;
}

// ============================================================================
// EXTENSION VALIDATION
// ============================================================================

/**
 * Get file extension from filename (lowercase, with dot)
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if file extension is allowed
 */
export function isExtensionAllowed(
  filename: string,
  options?: { allowedExtensions?: string[]; blockedExtensions?: string[] }
): { allowed: boolean; reason?: string } {
  const ext = getFileExtension(filename);

  debugLog('Extension', 'Checking extension', { filename, extension: ext || '(none)' });

  if (!ext) {
    // Files without extensions are suspicious
    debugWarn('Extension', 'BLOCKED: File has no extension', { filename });
    return { allowed: false, reason: 'File has no extension' };
  }

  // Check blocked extensions first
  const blocked = options?.blockedExtensions
    ? new Set(options.blockedExtensions.map(e => e.toLowerCase()))
    : BLOCKED_EXTENSIONS;

  if (blocked.has(ext)) {
    debugWarn('Extension', 'BLOCKED: Extension in blocklist', { filename, extension: ext });
    return { allowed: false, reason: `File extension "${ext}" is not allowed` };
  }

  // If allowlist is provided, check against it
  if (options?.allowedExtensions) {
    const allowed = new Set(options.allowedExtensions.map(e => e.toLowerCase()));
    if (!allowed.has(ext)) {
      debugWarn('Extension', 'BLOCKED: Extension not in allowlist', { filename, extension: ext });
      return { allowed: false, reason: `File extension "${ext}" is not in the allowed list` };
    }
  }

  debugLog('Extension', 'Extension allowed', { filename, extension: ext });
  return { allowed: true };
}

// ============================================================================
// MIME TYPE VALIDATION
// ============================================================================

/**
 * Check if MIME type is allowed
 */
export function isMimeTypeAllowed(
  mimeType: string,
  options?: { allowedTypes?: string[]; blockedTypes?: string[] }
): { allowed: boolean; reason?: string } {
  const type = mimeType.toLowerCase();

  debugLog('MimeType', 'Checking MIME type', { mimeType: type });

  // Check blocked types first
  const blocked = options?.blockedTypes
    ? new Set(options.blockedTypes.map(t => t.toLowerCase()))
    : BLOCKED_MIME_TYPES;

  if (blocked.has(type)) {
    debugWarn('MimeType', 'BLOCKED: MIME type in blocklist', { mimeType: type });
    return { allowed: false, reason: `File type "${type}" is not allowed` };
  }

  // If allowlist is provided, check against it
  if (options?.allowedTypes) {
    const allowed = new Set(options.allowedTypes.map(t => t.toLowerCase()));
    if (!allowed.has(type)) {
      debugWarn('MimeType', 'BLOCKED: MIME type not in custom allowlist', { mimeType: type });
      return { allowed: false, reason: `File type "${type}" is not in the allowed list` };
    }
  } else {
    // Use default allowlist
    if (!ALLOWED_MIME_TYPES.has(type)) {
      // Allow unknown text types
      if (!type.startsWith('text/')) {
        debugWarn('MimeType', 'BLOCKED: MIME type not in default allowlist', { mimeType: type });
        return { allowed: false, reason: `File type "${type}" is not allowed` };
      }
      debugLog('MimeType', 'Allowing unknown text type', { mimeType: type });
    }
  }

  debugLog('MimeType', 'MIME type allowed', { mimeType: type });
  return { allowed: true };
}

// ============================================================================
// FILE SIZE VALIDATION
// ============================================================================

/**
 * Check if file size is within limits
 */
export function isFileSizeAllowed(
  file: File,
  maxSizeBytes?: number
): { allowed: boolean; reason?: string } {
  // Use different limits for images vs other files
  const isImage = file.type.startsWith('image/');
  const limit = maxSizeBytes ?? (isImage ? DEFAULT_MAX_IMAGE_SIZE_BYTES : DEFAULT_MAX_SIZE_BYTES);

  debugLog('FileSize', 'Checking file size', {
    fileName: file.name,
    size: file.size,
    limit,
    isImage,
  });

  if (file.size > limit) {
    const limitMB = (limit / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    debugWarn('FileSize', 'BLOCKED: File too large', { fileName: file.name, sizeMB: fileSizeMB, limitMB });
    return {
      allowed: false,
      reason: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${limitMB}MB)`,
    };
  }

  if (file.size === 0) {
    debugWarn('FileSize', 'BLOCKED: Empty file', { fileName: file.name });
    return { allowed: false, reason: 'File is empty' };
  }

  debugLog('FileSize', 'File size OK', { fileName: file.name, size: file.size });
  return { allowed: true };
}

// ============================================================================
// COMPREHENSIVE VALIDATION
// ============================================================================

/**
 * Comprehensive file validation
 */
export async function validateFile(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  debugLog('Validate', '========== Starting file validation ==========', {
    fileName: file.name,
    type: file.type,
    size: file.size,
  });

  const {
    maxSizeBytes,
    allowedTypes,
    blockedTypes,
    allowedExtensions,
    blockedExtensions,
    sanitizeFilename: shouldSanitize = true,
    verifyMagicBytes: shouldVerifyMagic = true,
  } = options;

  // 1. Validate file size
  debugLog('Validate', 'Step 1: Checking file size...');
  const sizeCheck = isFileSizeAllowed(file, maxSizeBytes);
  if (!sizeCheck.allowed) {
    debugError('Validate', 'REJECTED at step 1 (file size)', { reason: sizeCheck.reason });
    return { valid: false, error: sizeCheck.reason };
  }

  // 2. Validate filename and extension
  debugLog('Validate', 'Step 2: Checking file extension...');
  const extCheck = isExtensionAllowed(file.name, { allowedExtensions, blockedExtensions });
  if (!extCheck.allowed) {
    debugError('Validate', 'REJECTED at step 2 (extension)', { reason: extCheck.reason });
    return { valid: false, error: extCheck.reason };
  }

  // 3. Validate MIME type
  debugLog('Validate', 'Step 3: Checking MIME type...');
  const mimeCheck = isMimeTypeAllowed(file.type, { allowedTypes, blockedTypes });
  if (!mimeCheck.allowed) {
    debugError('Validate', 'REJECTED at step 3 (MIME type)', { reason: mimeCheck.reason });
    return { valid: false, error: mimeCheck.reason };
  }

  // 4. Verify magic bytes (content matches claimed type)
  if (shouldVerifyMagic) {
    debugLog('Validate', 'Step 4: Verifying magic bytes...');
    const magicCheck = await verifyMagicBytes(file);
    if (!magicCheck.valid) {
      debugError('Validate', 'REJECTED at step 4 (magic bytes)', { reason: magicCheck.error });
      return { valid: false, error: magicCheck.error };
    }
  } else {
    debugLog('Validate', 'Step 4: Skipping magic bytes verification (disabled)');
  }

  // 5. Sanitize filename
  debugLog('Validate', 'Step 5: Sanitizing filename...');
  const sanitizedFilename = shouldSanitize ? sanitizeFilename(file.name) : file.name;

  debugLog('Validate', '========== Validation PASSED ==========', {
    fileName: file.name,
    sanitizedFilename,
  });

  return {
    valid: true,
    sanitizedFilename,
  };
}

/**
 * Validate multiple files
 */
export async function validateFiles(
  files: File[],
  options: FileValidationOptions = {}
): Promise<{ valid: boolean; errors: string[]; validFiles: File[]; sanitizedFilenames: Map<File, string> }> {
  debugLog('ValidateMultiple', `Validating ${files.length} files...`);

  const errors: string[] = [];
  const validFiles: File[] = [];
  const sanitizedFilenames = new Map<File, string>();

  for (const file of files) {
    const result = await validateFile(file, options);
    if (result.valid) {
      validFiles.push(file);
      if (result.sanitizedFilename) {
        sanitizedFilenames.set(file, result.sanitizedFilename);
      }
    } else {
      errors.push(`${file.name}: ${result.error}`);
    }
  }

  debugLog('ValidateMultiple', 'Batch validation complete', {
    total: files.length,
    valid: validFiles.length,
    rejected: errors.length,
  });

  return {
    valid: errors.length === 0,
    errors,
    validFiles,
    sanitizedFilenames,
  };
}

// ============================================================================
// QUICK VALIDATION (SYNCHRONOUS)
// ============================================================================

/**
 * Quick check if a file is potentially safe (for UI feedback)
 * This is a synchronous check that doesn't verify magic bytes
 */
export function quickValidateFile(file: File): { valid: boolean; error?: string } {
  debugLog('QuickValidate', 'Quick validation (no magic bytes)', { fileName: file.name });

  // Check size
  const sizeCheck = isFileSizeAllowed(file);
  if (!sizeCheck.allowed) {
    debugWarn('QuickValidate', 'Failed size check', { fileName: file.name });
    return { valid: false, error: sizeCheck.reason };
  }

  // Check extension
  const extCheck = isExtensionAllowed(file.name);
  if (!extCheck.allowed) {
    debugWarn('QuickValidate', 'Failed extension check', { fileName: file.name });
    return { valid: false, error: extCheck.reason };
  }

  // Check MIME type
  const mimeCheck = isMimeTypeAllowed(file.type);
  if (!mimeCheck.allowed) {
    debugWarn('QuickValidate', 'Failed MIME type check', { fileName: file.name });
    return { valid: false, error: mimeCheck.reason };
  }

  debugLog('QuickValidate', 'Quick validation passed', { fileName: file.name });
  return { valid: true };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export constants for external use
export const FILE_UPLOAD_LIMITS = {
  DEFAULT_MAX_SIZE_BYTES,
  DEFAULT_MAX_IMAGE_SIZE_BYTES,
} as const;

export const FILE_SECURITY_LISTS = {
  ALLOWED_MIME_TYPES: Array.from(ALLOWED_MIME_TYPES),
  BLOCKED_MIME_TYPES: Array.from(BLOCKED_MIME_TYPES),
  ALLOWED_EXTENSIONS: Array.from(ALLOWED_EXTENSIONS),
  BLOCKED_EXTENSIONS: Array.from(BLOCKED_EXTENSIONS),
} as const;

// ============================================================================
// DEBUG CONTROL
// ============================================================================

/**
 * Enable or disable debug logging for file upload security
 * Usage: enableFileUploadSecurityDebug(true) to enable
 *        enableFileUploadSecurityDebug(false) to disable
 *
 * Can also be enabled via browser console:
 *   localStorage.setItem('DEBUG_FILE_UPLOAD_SECURITY', 'true')
 */
export function enableFileUploadSecurityDebug(enable: boolean): void {
  if (typeof window === 'undefined') {
    console.warn('[FileUploadSecurity] Debug toggle only available in browser');
    return;
  }
  try {
    if (enable) {
      localStorage.setItem(DEBUG_KEY, 'true');
      console.log('[FileUploadSecurity] Debug logging ENABLED');
    } else {
      localStorage.removeItem(DEBUG_KEY);
      console.log('[FileUploadSecurity] Debug logging DISABLED');
    }
  } catch (error) {
    console.error('[FileUploadSecurity] Failed to toggle debug mode:', error);
  }
}

/**
 * Check if debug logging is currently enabled
 */
export function isFileUploadSecurityDebugEnabled(): boolean {
  return isDebugEnabled();
}
