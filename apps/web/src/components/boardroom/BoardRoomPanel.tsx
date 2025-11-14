/**
 * Board Room Panel Component
 *
 * Main container for the Board Room feature. Manages the overall layout
 * and coordinates between participant selection, topic input, and conversation view.
 */

"use client";

import React, { useState } from "react";
import type { UserTier } from "@/hooks/useUserTier";
import type { BoardRoomParticipant, BoardRoomMessage, BoardRoomSession } from "@/types/boardroom";
import ParticipantSelector from "./ParticipantSelector";
import TopicInput from "./TopicInput";
import ConversationView from "./ConversationView";
import { useBoardRoomConversation } from "@/hooks/useBoardRoomConversation";

type BoardRoomPanelProps = {
  userId: string;
  userTier: UserTier;
};

export default function BoardRoomPanel({ userId, userTier }: BoardRoomPanelProps) {
  const [selectedParticipants, setSelectedParticipants] = useState<BoardRoomParticipant[]>([]);
  const [topic, setTopic] = useState("");

  const {
    session,
    isDiscussing,
    startDiscussion,
    clearSession,
  } = useBoardRoomConversation({
    userId,
    userTier,
    participants: selectedParticipants,
    topic,
  });

  const handleStartDiscussion = () => {
    if (selectedParticipants.length < 2) {
      alert("Please select at least 2 LLM participants for the discussion.");
      return;
    }
    if (!topic.trim()) {
      alert("Please enter a topic or question for discussion.");
      return;
    }

    startDiscussion();
  };

  const handleNewSession = () => {
    setSelectedParticipants([]);
    setTopic("");
    clearSession();
  };

  return (
    <div className="flex h-full w-full justify-center bg-slate-950 overflow-y-auto">
      <div className="flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">The Board Room</h1>
            <p className="text-sm text-slate-400 mt-1">
              Invite multiple LLMs to discuss and collaborate on your question
            </p>
          </div>
          {session && (
            <button
              onClick={handleNewSession}
              className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              New Session
            </button>
          )}
        </div>

        {!session ? (
          /* Setup View: Participant Selection & Topic Input */
          <div className="flex flex-col gap-6">
            <ParticipantSelector
              selectedParticipants={selectedParticipants}
              onParticipantsChange={setSelectedParticipants}
              userTier={userTier}
            />

            <TopicInput
              topic={topic}
              onTopicChange={setTopic}
              onStart={handleStartDiscussion}
              isStarting={isDiscussing}
              disabled={selectedParticipants.length < 2}
            />
          </div>
        ) : (
          /* Discussion View: Show the conversation */
          <div className="flex-1 min-h-[600px]">
            <ConversationView
              session={session}
              isDiscussing={isDiscussing}
            />
          </div>
        )}
      </div>
    </div>
  );
}
