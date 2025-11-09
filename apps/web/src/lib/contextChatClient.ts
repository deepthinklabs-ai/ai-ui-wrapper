/**
 * Context Chat Client
 *
 * Handles API calls for context-based questions that are isolated from
 * the main conversation thread. Uses the same LLM but with context-specific
 * prompting.
 */

import { sendUnifiedChatRequest, type UnifiedContentPart } from "./unifiedAIClient";
import type { MessageRole } from "@/types/chat";
import { processFiles, formatFilesForMessage } from "./fileProcessor";

/**
 * Sends a question about specific context to the LLM
 *
 * @param question - The user's question
 * @param contextSections - The highlighted/selected text sections to provide context
 * @param threadMessages - Optional array of previous messages from the thread for additional context
 * @param files - Optional files to include with the question
 * @returns The LLM's response
 */
export async function askContextQuestion(
  question: string,
  contextSections: string[],
  threadMessages?: { role: MessageRole; content: string }[],
  files?: File[]
): Promise<string> {
  // Process files if provided
  const processedFiles = files && files.length > 0 ? await processFiles(files) : [];
  const textFilesContent = formatFilesForMessage(processedFiles);

  // Format multiple context sections
  const formattedContext = contextSections.length === 1
    ? `The highlighted context is:
"""
${contextSections[0]}
"""`
    : `The user has highlighted ${contextSections.length} sections of text:

${contextSections.map((section, index) => `Section ${index + 1}:
"""
${section}
"""`).join('\n\n')}`;

  const systemPrompt = `You are a helpful AI assistant. The user has highlighted specific text and wants to ask a question about it.

${formattedContext}

Your primary focus should be on answering the user's question in relation to the highlighted ${contextSections.length === 1 ? 'section' : 'sections'} shown above.

If the highlighted text contains the information needed to answer the question, use it as your primary source. If the highlighted text provides partial information or context for the question but you need additional general knowledge to give a complete answer, you may supplement with your general knowledge and expertise.

IMPORTANT: Provide your answer directly without showing your reasoning process, internal thinking, or analysis steps. Just give the clear, concise answer to the user's question.`;

  const messages: { role: MessageRole; content: string | UnifiedContentPart[] }[] = [
    { role: "system", content: systemPrompt },
  ];

  // Do NOT include thread messages - only focus on highlighted sections
  // This prevents the LLM from referencing the entire conversation

  // Build the user's question with files if applicable
  const imageFiles = processedFiles.filter(f => f.isImage);
  const questionWithFiles = question + textFilesContent;

  if (imageFiles.length > 0) {
    // Use vision format with content parts
    const contentParts: UnifiedContentPart[] = [];

    // Add text part
    contentParts.push({
      type: "text",
      text: questionWithFiles,
    });

    // Add image parts
    imageFiles.forEach(img => {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${img.type};base64,${img.content}`,
        },
      });
    });

    messages.push({ role: "user", content: contentParts });
  } else {
    // No images, use simple string content
    messages.push({ role: "user", content: questionWithFiles });
  }

  const response = await sendUnifiedChatRequest(messages);
  return response;
}
