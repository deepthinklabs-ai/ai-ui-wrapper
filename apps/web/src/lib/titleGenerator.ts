/**
 * Title Generator Utility
 *
 * Automatically generates concise thread titles based on the first user message
 * using the user's selected AI model.
 */

import { sendUnifiedChatRequest } from "./unifiedAIClient";
import type { MessageRole } from "@/types/chat";

/**
 * Generates a short, descriptive title from a user's message
 *
 * @param userMessage - The first message from the user
 * @param options - Optional user tier and userId for API routing
 * @returns A concise title (max ~60 characters)
 */
export async function generateThreadTitle(
  userMessage: string,
  options?: {
    userTier?: 'trial' | 'pro' | 'expired';
    userId?: string;
  }
): Promise<string> {
  try {
    const systemPrompt = `You are a title generator. Given a user's message, respond with ONLY a short, descriptive title (max 60 characters).

IMPORTANT:
- Respond with ONLY the title text itself, no prefixes like "Title:" or labels
- No quotes around the title
- No punctuation at the end
- Be concise and specific
- Capture the main topic or question
- Use title case
- If it's a question, make it a statement

Examples:
User: "How do I implement authentication in Next.js?"
Response: Next.js Authentication Implementation

User: "Can you help me debug this React hook?"
Response: React Hook Debugging

User: "What's the best way to handle state management?"
Response: State Management Best Practices

User: "Tell me all about dogs"
Response: All About Dogs`;

    const messages: { role: MessageRole; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    console.log("[Title Generator] Calling AI with userTier:", options?.userTier, "userId:", options?.userId);

    const response = await sendUnifiedChatRequest(messages, {
      userTier: options?.userTier,
      userId: options?.userId,
    });

    // Clean up the response
    let title = response.content.trim();

    // Remove common prefixes
    title = title.replace(/^(Title:\s*|title:\s*)/i, "");

    // Remove leading/trailing quotes
    title = title.replace(/^["']|["']$/g, "");

    // Remove any markdown or formatting
    title = title.replace(/\*\*/g, ""); // Remove bold markdown
    title = title.replace(/\*/g, "");   // Remove italic markdown
    title = title.replace(/`/g, "");    // Remove code backticks

    // Final trim
    title = title.trim();

    // Truncate if too long
    if (title.length > 60) {
      title = title.substring(0, 57) + "...";
    }

    return title || "New Thread"; // Fallback if empty
  } catch (error) {
    console.error("Error generating thread title:", error);
    return "New Thread"; // Fallback on error
  }
}

/**
 * Checks if a thread title should be updated (i.e., it's still the default)
 *
 * @param currentTitle - The current thread title
 * @returns true if the title should be auto-generated
 */
export function shouldGenerateTitle(currentTitle: string | null): boolean {
  if (!currentTitle) return true;

  const defaultTitles = ["New thread", "New Thread", "Untitled"];
  return defaultTitles.includes(currentTitle.trim());
}
