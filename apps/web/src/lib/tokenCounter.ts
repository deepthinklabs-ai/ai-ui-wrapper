/**
 * Token Counter Utility
 *
 * Estimates token count for messages to track context window usage.
 * Uses CONSERVATIVE approximation: ~3.8 characters per token.
 *
 * Calibration based on actual GPT-3.5-turbo usage:
 * - Actual API usage: 16,408 tokens (caused error at 16,385 limit)
 * - Target estimate: ~17,000 tokens (shows 100%+ BEFORE error occurs)
 * - With 500 token buffer: (17,000 - 500) / 16,408 = 1.006x
 * - This requires: ~3.8 characters per token
 *
 * This OVERESTIMATES slightly to ensure the meter hits 100% before users
 * encounter API errors, giving them advance warning to summarize.
 */

/**
 * Estimate token count for a text string
 * CONSERVATIVE approximation: 1 token ≈ 3.8 characters
 * (Intentionally overestimates to warn users BEFORE hitting API limits)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Conservative: ~3.8 characters per token (rounds up to overestimate)
  return Math.ceil(text.length / 3.8);
}

/**
 * Estimate tokens for an image
 * Images use a fixed token count based on resolution
 * This is a conservative estimate
 */
export function estimateImageTokens(imageType: string): number {
  // Standard image token estimate for vision models
  // Most vision models use ~170-765 tokens per image depending on detail level
  // We'll use a conservative middle estimate
  return 500;
}

/**
 * Calculate total tokens for a message including text and attachments
 */
export function calculateMessageTokens(
  content: string,
  attachments?: Array<{ isImage: boolean; content: string }> | null
): number {
  let tokens = estimateTokens(content);

  // Add tokens for attachments
  if (attachments && attachments.length > 0) {
    attachments.forEach((attachment) => {
      if (attachment.isImage) {
        tokens += estimateImageTokens(attachment.content);
      } else {
        // Text files - estimate based on content
        tokens += estimateTokens(attachment.content);
      }
    });
  }

  return tokens;
}

/**
 * Format token count for display (e.g., "15.2K" or "150K")
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }
  return tokens.toString();
}

/**
 * Get color class based on usage percentage
 * Shows warnings as user approaches 100% (which happens BEFORE API errors)
 */
export function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-500';      // Critical - stop NOW (at or over 100% soon)
  if (percentage >= 80) return 'text-orange-500';   // Warning - summarize ASAP
  if (percentage >= 75) return 'text-yellow-500';   // Caution - getting close
  return 'text-green-500';                           // Safe
}

/**
 * Get background color class based on usage percentage
 * Shows warnings as user approaches 100% (which happens BEFORE API errors)
 */
export function getUsageBackgroundColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';        // Critical
  if (percentage >= 80) return 'bg-orange-500';     // Warning
  if (percentage >= 75) return 'bg-yellow-500';     // Caution
  return 'bg-green-500';                             // Safe
}
