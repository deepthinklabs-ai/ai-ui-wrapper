/**
 * Participant Selector Component
 *
 * Allows users to select which LLM models will participate in the Board Room discussion.
 * Each participant is assigned a color for visual differentiation.
 */

"use client";

import React from "react";
import type { UserTier } from "@/hooks/useUserTier";
import type { BoardRoomParticipant } from "@/types/boardroom";
import type { AIModel } from "@/lib/apiKeyStorage";
import { AVAILABLE_MODELS } from "@/lib/apiKeyStorage";

type ParticipantSelectorProps = {
  selectedParticipants: BoardRoomParticipant[];
  onParticipantsChange: (participants: BoardRoomParticipant[]) => void;
  userTier: UserTier;
};

const PARTICIPANT_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
];

export default function ParticipantSelector({
  selectedParticipants,
  onParticipantsChange,
  userTier,
}: ParticipantSelectorProps) {
  const availableModels = userTier === "pro"
    ? AVAILABLE_MODELS
    : AVAILABLE_MODELS.filter((m) => !m.requiresPro);

  const toggleParticipant = (model: AIModel, modelLabel: string) => {
    const existing = selectedParticipants.find((p) => p.model === model);

    if (existing) {
      // Remove participant
      onParticipantsChange(selectedParticipants.filter((p) => p.model !== model));
    } else {
      // Add participant
      const colorIndex = selectedParticipants.length % PARTICIPANT_COLORS.length;
      const newParticipant: BoardRoomParticipant = {
        id: `participant-${Date.now()}-${Math.random()}`,
        model,
        name: modelLabel,
        role: "participant",
        color: PARTICIPANT_COLORS[colorIndex],
      };
      onParticipantsChange([...selectedParticipants, newParticipant]);
    }
  };

  const isSelected = (model: AIModel) => {
    return selectedParticipants.some((p) => p.model === model);
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-2">Select Participants</h2>
      <p className="text-sm text-slate-400 mb-4">
        Choose at least 2 LLM models to participate in the discussion
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {availableModels.map((modelOption) => {
          const selected = isSelected(modelOption.value);
          const participant = selectedParticipants.find((p) => p.model === modelOption.value);

          return (
            <button
              key={modelOption.value}
              onClick={() => toggleParticipant(modelOption.value, modelOption.label)}
              disabled={modelOption.requiresPro && userTier !== "pro"}
              className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                selected
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-slate-700 bg-slate-800 hover:border-slate-600"
              } ${
                modelOption.requiresPro && userTier !== "pro"
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              {/* Color indicator for selected participants */}
              {selected && participant && (
                <div
                  className="absolute top-2 right-2 w-4 h-4 rounded-full border-2 border-slate-900"
                  style={{ backgroundColor: participant.color }}
                />
              )}

              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-100">{modelOption.label}</span>
                {modelOption.requiresPro && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-1.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                    Pro
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">{modelOption.provider}</div>

              {selected && (
                <div className="mt-2 flex items-center gap-1 text-xs text-sky-400">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Selected
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedParticipants.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="text-sm text-slate-300">
            <span className="font-medium">{selectedParticipants.length}</span> participants selected
          </div>
        </div>
      )}
    </div>
  );
}
