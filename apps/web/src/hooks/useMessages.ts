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
};

type UseMessagesResult = {
  messages: Message[];
  loadingMessages: boolean;
  messagesError: string | null;
  sendInFlight: boolean;
  summarizeInFlight: boolean;
  sendMessage: (content: string, files?: File[]) => Promise<void>;
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

  const sendMessage = async (content: string, files?: File[]) => {
    if (!threadId || (!content.trim() && (!files || files.length === 0))) return;

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
          thread_id: threadId,
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

      // 4) Call unified AI client (routes to OpenAI or Claude based on selected model)
      const replyText = await sendUnifiedChatRequest(payloadMessages);

      // 5) Insert assistant reply into DB
      const { data: insertedAssistant, error: insertAssistantError } =
        await supabase
          .from("messages")
          .insert({
            thread_id: threadId,
            role: "assistant",
            content: replyText,
            model: getSelectedModel(), // Use user's selected model
          })
          .select()
          .single();

      if (insertAssistantError) throw insertAssistantError;
      if (!insertedAssistant)
        throw new Error("Failed to insert assistant message");

      // 6) Optimistically add assistant message
      setMessages((prev) => [...prev, insertedAssistant as Message]);

      // 7) Auto-generate thread title if this is the first message
      if (messages.length === 0) {
        try {
          // Fetch the current thread to check its title
          const { data: threadData, error: threadError } = await supabase
            .from("threads")
            .select("title")
            .eq("id", threadId)
            .single();

          if (!threadError && threadData && shouldGenerateTitle(threadData.title)) {
            // Generate a title based on the user's first message
            const newTitle = await generateThreadTitle(content);

            // Update the thread title in the database
            const { error: updateError } = await supabase
              .from("threads")
              .update({ title: newTitle })
              .eq("id", threadId);

            if (updateError) {
              console.error("Error updating thread title:", updateError);
            } else {
              console.log("Thread title auto-generated:", newTitle);
              // Notify parent component to refresh threads list
              options?.onThreadTitleUpdated?.();
            }
          }
        } catch (titleErr) {
          console.error("Error in title generation:", titleErr);
          // Don't fail the message send if title generation fails
        }
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

    const summaryBody = await sendUnifiedChatRequest(payloadMessages);
    return summaryBody;
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
