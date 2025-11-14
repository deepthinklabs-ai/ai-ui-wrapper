/**
 * Board Room Types
 *
 * Type definitions for the Board Room feature where multiple LLMs
 * participate in discussions and converse with each other.
 */

import type { AIModel } from "@/lib/apiKeyStorage";

export type ParticipantRole = "moderator" | "participant";

export type BoardRoomParticipant = {
  id: string;
  model: AIModel;
  name: string;
  role: ParticipantRole;
  color: string; // For visual differentiation in UI
};

export type BoardRoomMessageType = "user_prompt" | "llm_response" | "llm_to_llm";

export type BoardRoomMessage = {
  id: string;
  type: BoardRoomMessageType;
  participantId: string | null; // null for user messages
  participantName: string;
  content: string;
  timestamp: Date;
  replyingTo?: string; // ID of message being replied to (for LLM-to-LLM conversations)
  sentiment?: "agree" | "disagree" | "neutral" | "question";
};

export type BoardRoomSession = {
  id: string;
  topic: string;
  participants: BoardRoomParticipant[];
  messages: BoardRoomMessage[];
  status: "idle" | "discussing" | "completed";
  createdAt: Date;
};

export type ConversationRound = {
  roundNumber: number;
  messages: BoardRoomMessage[];
};
