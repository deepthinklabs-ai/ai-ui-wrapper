/**
 * Model Capabilities Utility
 *
 * Provides helper functions to detect and validate model capabilities
 * like image support, file support, etc.
 */

import { AVAILABLE_MODELS, type AIModel, type ModelCapabilities } from './apiKeyStorage';

/**
 * Get the capabilities for a specific model
 */
export function getModelCapabilities(model: AIModel): ModelCapabilities {
  const modelInfo = AVAILABLE_MODELS.find(m => m.value === model);
  return modelInfo?.capabilities || { supportsImages: false, supportsFiles: false, supportsWebSearch: true };
}

/**
 * Check if a model supports image uploads
 */
export function modelSupportsImages(model: AIModel): boolean {
  return getModelCapabilities(model).supportsImages;
}

/**
 * Check if a model supports file uploads
 */
export function modelSupportsFiles(model: AIModel): boolean {
  return getModelCapabilities(model).supportsFiles;
}

/**
 * Check if a model supports web search
 */
export function modelSupportsWebSearch(model: AIModel): boolean {
  return getModelCapabilities(model).supportsWebSearch;
}

/**
 * Get a warning message if the model doesn't support the attached files
 * Returns null if all files are supported
 */
export function getFileUploadWarning(model: AIModel, files: File[]): string | null {
  if (files.length === 0) return null;

  const capabilities = getModelCapabilities(model);
  const hasImages = files.some(f => f.type.startsWith('image/'));
  const hasOtherFiles = files.some(f => !f.type.startsWith('image/'));

  // Model doesn't support any files
  if (!capabilities.supportsFiles) {
    return `${model} does not support file uploads. Please remove attached files or switch to a different model.`;
  }

  // Model doesn't support images but images are attached
  if (!capabilities.supportsImages && hasImages) {
    return `${model} does not support image uploads. Please remove image files or switch to a different model.`;
  }

  return null;
}

/**
 * Get supported file types for a model
 */
export function getSupportedFileTypes(model: AIModel): string[] | undefined {
  return getModelCapabilities(model).supportedFileTypes;
}

/**
 * Validate if files can be uploaded with the selected model
 */
export function canUploadFiles(model: AIModel, files: File[]): boolean {
  return getFileUploadWarning(model, files) === null;
}
