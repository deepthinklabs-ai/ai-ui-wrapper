"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Message, MessageRole } from "@/types/chat";
import { sendChatRequest } from "@/lib/chatClient";

type UseMessagesResult = {
  messages: Message[];
  loadingMessages: boolean;
  messagesError: string | null;
  sendInFlight: boolean;
  summarizeInFlight: boolean;
  sendMessage: (content: string) => Promise<void>;
  summarizeThread: () => Promise<void>;
  refreshMessages: () => Promise<void>;
};

export function useMessages(threadId: string | null): UseMessagesResult {
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

  const sendMessage = async (content: string) => {
    if (!threadId || !content.trim()) return;

    setSendInFlight(true);
    try {
      // 1) Insert user message into DB
      const { data: insertedUser, error: insertUserError } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          role: "user",
          content,
          model: null,
        })
        .select()
        .single();

      if (insertUserError) throw insertUserError;
      if (!insertedUser) throw new Error("Failed to insert user message");

      // 2) Optimistically add user message to local state
      setMessages((prev) => [...prev, insertedUser as Message]);

      // 3) Build payload for chat API (full conversation + new message)
      const payloadMessages: { role: MessageRole; content: string }[] = [
        ...messages,
        insertedUser as Message,
      ].map((m) => ({
        role: m.role as MessageRole,
        content: m.content,
      }));

      // 4) Call centralized chat client
      const replyText = await sendChatRequest(payloadMessages);

      // 5) Insert assistant reply into DB
      const { data: insertedAssistant, error: insertAssistantError } =
        await supabase
          .from("messages")
          .insert({
            thread_id: threadId,
            role: "assistant",
            content: replyText,
            model: "gpt-4o-mini", // adjust if needed
          })
          .select()
          .single();

      if (insertAssistantError) throw insertAssistantError;
      if (!insertedAssistant)
        throw new Error("Failed to insert assistant message");

      // 6) Optimistically add assistant message
      setMessages((prev) => [...prev, insertedAssistant as Message]);

      // 7) FINAL: force a full refresh from DB to ensure consistency
      await refreshMessages();
    } catch (err: any) {
      console.error("Error sending message:", err);
      setMessagesError(err.message ?? "Error sending message");
    } finally {
      setSendInFlight(false);
    }
  };

  const summarizeThread = async () => {
    if (!threadId || messages.length === 0) return;

    setSummarizeInFlight(true);
    try {
      const systemPrompt =
        "You are an expert summarizer. Summarize the ENTIRE thread, including all major topics and decisions. " +
        "Use sections: Summary, Topics, Key actions.";

      const payloadMessages: { role: MessageRole; content: string }[] = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as MessageRole,
          content: m.content,
        })),
      ];

      const summaryBody = await sendChatRequest(payloadMessages);

      const summaryContent = `**Thread summary**\n\n${summaryBody}`;

      const { data: summaryMessage, error: insertSummaryError } = await supabase
        .from("messages")
        .insert({
          thread_id: threadId,
          role: "assistant",
          content: summaryContent,
          model: "gpt-4o-mini",
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
    refreshMessages,
  };
}
