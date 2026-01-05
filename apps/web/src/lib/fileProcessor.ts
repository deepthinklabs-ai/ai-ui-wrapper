/**
 * File Processor Utility
 *
 * Handles processing of uploaded files for LLM consumption:
 * - Security validation (type, size, content verification)
 * - Converts images to base64 for vision models
 * - Reads text-based files and extracts content
 */

import {
  validateFile,
  validateFiles,
  quickValidateFile,
  sanitizeFilename,
  type FileValidationOptions,
  type FileValidationResult,
} from './fileUploadSecurity';

export type ProcessedFile = {
  name: string;
  type: string;
  size: number;
  content: string; // base64 for images, text content for text files
  isImage: boolean;
};

export type SecureProcessResult = {
  success: boolean;
  file?: ProcessedFile;
  error?: string;
};

export type SecureProcessMultipleResult = {
  processedFiles: ProcessedFile[];
  errors: string[];
  allSuccessful: boolean;
};

/**
 * Reads a file and converts it to base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a text file and returns its content
 */
async function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Process a single file for LLM consumption
 */
export async function processFile(file: File): Promise<ProcessedFile> {
  const isImage = file.type.startsWith("image/");

  let content: string;

  if (isImage) {
    // For images, convert to base64
    content = await fileToBase64(file);
  } else {
    // For text files, read the content
    content = await fileToText(file);
  }

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    content,
    isImage,
  };
}

/**
 * Process multiple files
 */
export async function processFiles(files: File[]): Promise<ProcessedFile[]> {
  return Promise.all(files.map(processFile));
}

/**
 * Format file content for inclusion in a message to the LLM
 */
export function formatFilesForMessage(processedFiles: ProcessedFile[]): string {
  if (processedFiles.length === 0) return "";

  const textFiles = processedFiles.filter(f => !f.isImage);

  if (textFiles.length === 0) return "";

  let fileContent = "\n\n---\n**Attached Files:**\n\n";

  textFiles.forEach(file => {
    fileContent += `**${file.name}**\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
  });

  return fileContent;
}

/**
 * Securely process a single file with full validation
 * Validates file type, size, and content before processing
 */
export async function secureProcessFile(
  file: File,
  options?: FileValidationOptions
): Promise<SecureProcessResult> {
  // Validate the file first
  const validation = await validateFile(file, options);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'File validation failed',
    };
  }

  try {
    // Process the validated file
    const processed = await processFile(file);

    // Use sanitized filename
    if (validation.sanitizedFilename) {
      processed.name = validation.sanitizedFilename;
    }

    return {
      success: true,
      file: processed,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Securely process multiple files with full validation
 * Returns successfully processed files and any errors
 */
export async function secureProcessFiles(
  files: File[],
  options?: FileValidationOptions
): Promise<SecureProcessMultipleResult> {
  const processedFiles: ProcessedFile[] = [];
  const errors: string[] = [];

  // Validate all files first
  const validation = await validateFiles(files, options);

  // Add validation errors
  errors.push(...validation.errors);

  // Process valid files
  for (const file of validation.validFiles) {
    try {
      const processed = await processFile(file);

      // Use sanitized filename if available
      const sanitizedName = validation.sanitizedFilenames.get(file);
      if (sanitizedName) {
        processed.name = sanitizedName;
      }

      processedFiles.push(processed);
    } catch (error) {
      errors.push(
        `${file.name}: Failed to process - ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return {
    processedFiles,
    errors,
    allSuccessful: errors.length === 0,
  };
}

/**
 * Quick validation for UI feedback (synchronous, no magic byte check)
 * Use this for immediate user feedback before full processing
 */
export function quickValidateFiles(files: File[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const file of files) {
    const result = quickValidateFile(file);
    if (!result.valid) {
      errors.push(`${file.name}: ${result.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Re-export security utilities for convenience
export {
  validateFile,
  validateFiles,
  quickValidateFile,
  sanitizeFilename,
  type FileValidationOptions,
  type FileValidationResult,
} from './fileUploadSecurity';

export {
  FILE_UPLOAD_LIMITS,
  FILE_SECURITY_LISTS,
  enableFileUploadSecurityDebug,
  isFileUploadSecurityDebugEnabled,
} from './fileUploadSecurity';
