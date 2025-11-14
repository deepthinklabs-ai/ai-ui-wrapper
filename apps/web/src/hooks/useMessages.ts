"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Message, MessageRole } from "@/types/chat";
import { sendUnifiedChatRequest, type UnifiedContentPart } from "@/lib/unifiedAIClient";
import { generateThreadTitle, shouldGenerateTitle } from "@/lib/titleGenerator";
import { processFiles, formatFilesForMessage } from "@/lib/fileProcessor";
import { getSelectedModel } from "@/lib/apiKeyStorage";

type UseMessagesOptions = {
  onThreadTitleUpdated?: () => void;
  systemPromptAddition?: string;
  userTier?: 'free' | 'pro';
  userId?: string;
};

type UseMessagesResult = {
  messages: Message[];
  loadingMessages: boolean;
  messagesError: string | null;
  sendInFlight: boolean;
  summarizeInFlight: boolean;
  sendMessage: (content: string, files?: File[], overrideThreadId?: string) => Promise<void>;
  summarizeThread: () => Promise<void>;
  generateSummary: () => Promise<string>;
  refreshMessages: () => Promise<void>;
};

export function useMessages(
  threadId: string | null,
  options?: UseMessagesOptions
): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [sendInFlight, setSendInFlight] = useState(false);
  const [summarizeInFlight, setSummarizeInFlight] = useState(false);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    void refreshMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const refreshMessages = async () => {
    if (!threadId) return;
    setLoadingMessages(true);
    setMessagesError(null);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data ?? []);
    } catch (err: any) {
      console.error("refreshMessages error:", err);
      setMessagesError(err.message ?? "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async (content: string, files?: File[], overrideThreadId?: string) => {
    // Use overrideThreadId if provided, otherwise use the hook's threadId
    const activeThreadId = overrideThreadId || threadId;

    if (!activeThreadId || (!content.trim() && (!files || files.length === 0))) return;

    setSendInFlight(true);
    try {
      // Process files if provided
      const processedFiles = files && files.length > 0 ? await processFiles(files) : [];

      // Build the final content for database storage
      // Include text files inline in the stored message
      const textFilesContent = formatFilesForMessage(processedFiles);
      const dbContent = content + textFilesContent;

      // Store attachment metadata for later restoration
      const attachmentMetadata = processedFiles.length > 0
        ? processedFiles.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            content: f.content,
            isImage: f.isImage,
          }))
        : null;

      // 1) Insert user message into DB
      const { data: insertedUser, error: insertUserError } = await supabase
        .from("messages")
        .insert({
          thread_id: activeThreadId,
          role: "user",
          content: dbContent,
          model: null,
          attachments: attachmentMetadata,
        })
        .select()
        .single();

      if (insertUserError) throw insertUserError;
      if (!insertedUser) throw new Error("Failed to insert user message");

      // 2) Optimistically add user message to local state
      setMessages((prev) => [...prev, insertedUser as Message]);

      // 3) Build payload for chat API (full conversation + new message)
      // For previous messages, use simple string content
      const previousMessages = messages.map((m) => ({
        role: m.role as MessageRole,
        content: m.content,
      }));

      // For the new message, if there are images, use the vision format
      const imageFiles = processedFiles.filter(f => f.isImage);
      let newMessageContent: string | UnifiedContentPart[];

      if (imageFiles.length > 0) {
        // Use vision format with content parts
        const contentParts: UnifiedContentPart[] = [];

        // Add text part if there's any text
        if (content.trim() || processedFiles.some(f => !f.isImage)) {
          contentParts.push({
            type: "text",
            text: dbContent,
          });
        }

        // Add image parts
        imageFiles.forEach(img => {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${img.type};base64,${img.content}`,
            },
          });
        });

        newMessageContent = contentParts;
      } else {
        // No images, use simple string content
        newMessageContent = dbContent;
      }

      // Add system prompt if provided (for step-by-step mode or other instructions)
      const payloadMessages: Array<{ role: MessageRole; content: string | UnifiedContentPart[] }> = [];

      if (options?.systemPromptAddition) {
        payloadMessages.push({
          role: "system" as MessageRole,
          content: options.systemPromptAddition,
        });
      }

      payloadMessages.push(
        ...previousMessages,
        {
          role: "user" as MessageRole,
          content: newMessageContent,
        }
      );

      // 4) Call unified AI client (routes to OpenAI or Claude based on selected model and user tier)
      const response = await sendUnifiedChatRequest(payloadMessages, {
        userTier: options?.userTier,
        userId: options?.userId,
      });

      // 5) Insert assistant reply into DB with token usage
      // Try with token fields first (if migration has been run)
      let insertedAssistant;
      let insertAssistantError;

      const assistantMessageWithTokens = {
        thread_id: activeThreadId,
        role: "assistant",
        content: response.content,
        model: getSelectedModel(), // Use user's selected model
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.total_tokens,
      };

      const result = await supabase
        .from("messages")
        .insert(assistantMessageWithTokens)
        .select()
        .single();

      insertedAssistant = result.data;
      insertAssistantError = result.error;

      // If error (likely due to missing columns), retry without token fields
      if (insertAssistantError) {
        console.warn("Failed to insert with token fields, retrying without them. Run the database migration to enable token tracking.");
        const assistantMessageWithoutTokens = {
          thread_id: activeThreadId,
          role: "assistant",
          content: response.content,
          model: getSelectedModel(),
        };

        const retryResult = await supabase
          .from("messages")
          .insert(assistantMessageWithoutTokens)
          .select()
          .single();

        insertedAssistant = retryResult.data;
        insertAssistantError = retryResult.error;
      }

      if (insertAssistantError) throw insertAssistantError;
      if (!insertedAssistant)
        throw new Error("Failed to insert assistant message");

      // 6) Optimistically add assistant message
      setMessages((prev) => [...prev, insertedAssistant as Message]);

      // 7) Auto-generate thread title if this is the first user message
      // Check the database directly for message count to avoid race conditions with local state
      try {
        console.log("[Title Generation] Checking if we should generate title for thread:", activeThreadId);

        // Count messages in the database for this thread (excluding the one we just inserted)
        const { count, error: countError } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("thread_id", activeThreadId);

        console.log("[Title Generation] Message count in DB:", count);

        // If there are exactly 2 messages (1 user + 1 assistant we just added), this is the first exchange
        const isFirstMessage = count === 2;

        console.log("[Title Generation] isFirstMessage:", isFirstMessage);

        if (isFirstMessage) {
          // Fetch the current thread to check its title
          const { data: threadData, error: threadError } = await supabase
            .from("threads")
            .select("title")
            .eq("id", activeThreadId)
            .single();

          console.log("[Title Generation] Current thread title:", threadData?.title);
          console.log("[Title Generation] Should generate?", shouldGenerateTitle(threadData?.title ?? null));

          if (!threadError && threadData && shouldGenerateTitle(threadData.title)) {
            console.log("[Title Generation] Generating title for content:", content.substring(0, 100));

            // Generate a title based on the user's first message (use the original content without file additions)
            const newTitle = await generateThreadTitle(content, {
              userTier: options?.userTier,
              userId: options?.userId,
            });

            console.log("[Title Generation] Generated title:", newTitle);

            // Update the thread title in the database
            const { error: updateError } = await supabase
              .from("threads")
              .update({ title: newTitle })
              .eq("id", activeThreadId);

            if (updateError) {
              console.error("[Title Generation] Error updating thread title:", updateError);
            } else {
              console.log("[Title Generation] Successfully updated thread title to:", newTitle);
              // Notify parent component to refresh threads list
              options?.onThreadTitleUpdated?.();
            }
          }
        }
      } catch (titleErr) {
        console.error("[Title Generation] Error in title generation:", titleErr);
        // Don't fail the message send if title generation fails
      }

      // 8) FINAL: force a full refresh from DB to ensure consistency
      await refreshMessages();
    } catch (err: any) {
      console.error("Error sending message:", err);
      setMessagesError(err.message ?? "Error sending message");
    } finally {
      setSendInFlight(false);
    }
  };

  // Generate summary text without inserting it into the database
  const generateSummary = async (): Promise<string> => {
    if (messages.length === 0) {
      throw new Error("No messages to summarize");
    }

    // Create a comprehensive summary prompt that explicitly references the full conversation
    const conversationText = messages
      .map((m, idx) => `Message ${idx + 1} (${m.role}):\n${m.content}`)
      .join("\n\n");

    const systemPrompt = `You are an expert conversation summarizer. You will be given a COMPLETE conversation thread with ${messages.length} messages.

Your task is to provide a comprehensive summary of the ENTIRE conversation from beginning to end. Do not focus only on recent messages - analyze and summarize ALL messages in chronological order.

Required sections:
1. **Overview**: Brief summary of what this conversation is about
2. **Key Topics Discussed**: List all major topics covered throughout the thread (in order)
3. **Important Decisions & Conclusions**: Any decisions made or conclusions reached
4. **Action Items**: Tasks, next steps, or things to implement (if any)
5. **Technical Details**: Important code, configurations, or technical specifics mentioned

Be thorough and ensure you capture information from the BEGINNING, MIDDLE, and END of the conversation.`;

    const summaryPrompt = `Please summarize this complete conversation thread:\n\n${conversationText}`;

    const payloadMessages: { role: MessageRole; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: summaryPrompt },
    ];

    const response = await sendUnifiedChatRequest(payloadMessages, {
      userTier: options?.userTier,
      userId: options?.userId,
    });
    return response.content;
  };

  const summarizeThread = async () => {
    if (!threadId || messages.length === 0) return;

    setSummarizeInFlight(true);
    try {
      const summaryBody = await generateSummary();
      const summaryContent = `**Thread summary**\n\n${summaryBody}`;

      const { data: summaryMessage, error: insertSummaryError } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          role: "assistant",
          content: summaryContent,
          model: getSelectedModel(),
        })
        .select()
        .single();

      if (insertSummaryError) throw insertSummaryError;
      if (!summaryMessage)
        throw new Error("Failed to insert summary message");

      setMessages((prev) => [...prev, summaryMessage as Message]);

      // Force refresh so the message list always reflects DB state
      await refreshMessages();
    } catch (err) {
      console.error("Error summarizing thread:", err);
      // we keep messagesError for sendMessage; summaries are "nice-to-have"
    } finally {
      setSummarizeInFlight(false);
    }
  };

  return {
    messages,
    loadingMessages,
    messagesError,
    sendInFlight,
    summarizeInFlight,
    sendMessage,
    summarizeThread,
    generateSummary,
    refreshMessages,
  };
}
