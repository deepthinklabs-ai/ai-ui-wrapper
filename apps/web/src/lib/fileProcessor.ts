/**
 * File Processor Utility
 *
 * Handles processing of uploaded files for LLM consumption:
 * - Converts images to base64 for vision models
 * - Reads text-based files and extracts content
 */

export type ProcessedFile = {
  name: string;
  type: string;
  size: number;
  content: string; // base64 for images, text content for text files
  isImage: boolean;
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
