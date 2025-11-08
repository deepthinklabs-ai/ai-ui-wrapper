/**
 * Title Generator Utility
 *
 * Automatically generates concise thread titles based on the first user message
 * using OpenAI's GPT model.
 */

import { sendChatRequest } from "./chatClient";
import type { MessageRole } from "@/types/chat";

/**
 * Generates a short, descriptive title from a user's message
 *
 * @param userMessage - The first message from the user
 * @returns A concise title (max ~60 characters)
 */
export async function generateThreadTitle(
  userMessage: string
): Promise<string> {
  try {
    const systemPrompt = `You are a title generator. Given a user's message, create a very short, descriptive title (max 60 characters).
Rules:
- Be concise and specific
- Capture the main topic or question
- Use title case
- No quotes or punctuation at the end
- If it's a question, make it a statement

Examples:
User: "How do I implement authentication in Next.js?"
Title: "Next.js Authentication Implementation"

User: "Can you help me debug this React hook?"
Title: "React Hook Debugging"

User: "What's the best way to handle state management?"
Title: "State Management Best Practices"`;

    const messages: { role: MessageRole; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const titleResponse = await sendChatRequest(messages);

    // Clean up the response (remove quotes if present, trim)
    let title = titleResponse.trim();
    title = title.replace(/^["']|["']$/g, ""); // Remove leading/trailing quotes

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
