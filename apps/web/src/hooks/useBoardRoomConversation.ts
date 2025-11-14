/**
 * Board Room Conversation Hook
 *
 * Manages the multi-LLM conversation in the Board Room.
 * Orchestrates turns, allows LLMs to respond to each other,
 * and handles agreement/disagreement between participants.
 */

"use client";

import { useState, useCallback } from "react";
import type { UserTier } from "./useUserTier";
import type {
  BoardRoomParticipant,
  BoardRoomMessage,
  BoardRoomSession,
} from "@/types/boardroom";
import { sendUnifiedChatRequest, type UnifiedChatMessage } from "@/lib/unifiedAIClient";

type UseBoardRoomConversationOptions = {
  userId: string;
  userTier: UserTier;
  participants: BoardRoomParticipant[];
  topic: string;
};

type UseBoardRoomConversationResult = {
  session: BoardRoomSession | null;
  isDiscussing: boolean;
  startDiscussion: () => Promise<void>;
  clearSession: () => void;
};

const DISCUSSION_ROUNDS = 2; // Number of rounds of discussion

export function useBoardRoomConversation({
  userId,
  userTier,
  participants,
  topic,
}: UseBoardRoomConversationOptions): UseBoardRoomConversationResult {
  const [session, setSession] = useState<BoardRoomSession | null>(null);
  const [isDiscussing, setIsDiscussing] = useState(false);

  /**
   * Generate a response from a specific LLM participant
   */
  const generateParticipantResponse = async (
    participant: BoardRoomParticipant,
    conversationHistory: BoardRoomMessage[],
    round: number
  ): Promise<BoardRoomMessage> => {
    // Build the prompt for this participant
    const otherParticipants = participants.filter((p) => p.id !== participant.id);

    // Create context from previous messages
    const previousMessages = conversationHistory
      .slice(1) // Skip initial user prompt
      .map((msg) => `${msg.participantName}: ${msg.content}`)
      .join("\n\n");

    let systemPrompt = `You are ${participant.name}, participating in a Board Room discussion with other AI models: ${otherParticipants.map((p) => p.name).join(", ")}.

Your role:
- Provide your expert perspective on the topic
- ${round > 1 ? "Respond to points made by other participants - agree, disagree, or build upon their ideas" : "Give your initial perspective"}
- Be concise but insightful (2-3 paragraphs)
- ${round > 1 ? "If you disagree with another participant, explain why respectfully" : ""}
- ${round > 1 ? "If you agree, acknowledge it and add value" : ""}
- Aim to contribute to finding the best answer

${round > 1 ? "Consider the discussion so far and provide your response." : "Provide your initial perspective on the topic."}`;

    let userPrompt = round === 1
      ? `Topic: ${topic}\n\nProvide your initial perspective on this topic.`
      : `Topic: ${topic}\n\nPrevious discussion:\n${previousMessages}\n\nNow provide your response, considering what others have said. Do you agree or disagree with any points? What would you add?`;

    const messages: UnifiedChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    try {
      const response = await sendUnifiedChatRequest(messages, {
        model: participant.model,
        userTier,
        userId,
      });

      // Analyze sentiment (simple keyword detection)
      const content = response.content.toLowerCase();
      let sentiment: "agree" | "disagree" | "neutral" | "question" = "neutral";

      if (content.includes("i agree") || content.includes("i concur") || content.includes("that's correct")) {
        sentiment = "agree";
      } else if (content.includes("i disagree") || content.includes("however") || content.includes("on the contrary")) {
        sentiment = "disagree";
      } else if (content.includes("?") && round > 1) {
        sentiment = "question";
      }

      return {
        id: `msg-${Date.now()}-${Math.random()}`,
        type: round > 1 ? "llm_to_llm" : "llm_response",
        participantId: participant.id,
        participantName: participant.name,
        content: response.content,
        timestamp: new Date(),
        sentiment: round > 1 ? sentiment : undefined,
      };
    } catch (error) {
      console.error(`Error generating response for ${participant.name}:`, error);

      // Return error message
      return {
        id: `msg-${Date.now()}-${Math.random()}`,
        type: "llm_response",
        participantId: participant.id,
        participantName: participant.name,
        content: `[Error: Unable to generate response. ${error instanceof Error ? error.message : "Unknown error"}]`,
        timestamp: new Date(),
      };
    }
  };

  /**
   * Start the Board Room discussion
   */
  const startDiscussion = useCallback(async () => {
    if (participants.length < 2 || !topic.trim()) {
      return;
    }

    setIsDiscussing(true);

    // Create initial session
    const initialMessage: BoardRoomMessage = {
      id: `msg-${Date.now()}`,
      type: "user_prompt",
      participantId: null,
      participantName: "You",
      content: topic,
      timestamp: new Date(),
    };

    const newSession: BoardRoomSession = {
      id: `session-${Date.now()}`,
      topic,
      participants,
      messages: [initialMessage],
      status: "discussing",
      createdAt: new Date(),
    };

    setSession(newSession);

    try {
      let currentMessages = [initialMessage];

      // Conduct multiple rounds of discussion
      for (let round = 1; round <= DISCUSSION_ROUNDS; round++) {
        // Each participant speaks in turn
        for (const participant of participants) {
          const response = await generateParticipantResponse(
            participant,
            currentMessages,
            round
          );

          currentMessages = [...currentMessages, response];

          // Update session with new message
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: currentMessages,
            };
          });

          // Small delay between participants for better UX
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Mark discussion as completed
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "completed",
        };
      });
    } catch (error) {
      console.error("Error during Board Room discussion:", error);
    } finally {
      setIsDiscussing(false);
    }
  }, [participants, topic, userId, userTier]);

  /**
   * Clear the current session
   */
  const clearSession = useCallback(() => {
    setSession(null);
    setIsDiscussing(false);
  }, []);

  return {
    session,
    isDiscussing,
    startDiscussion,
    clearSession,
  };
}
