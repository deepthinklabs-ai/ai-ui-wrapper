/**
 * Show Cast Configuration Component
 *
 * Allows users to select which characters from "The Show" appear
 * and which AI model each character uses.
 */

"use client";

import React from "react";
import { SHOW_CHARACTERS, type ShowCharacter } from "@/lib/showCharacters";
import { AVAILABLE_MODELS, type AIModel } from "@/lib/apiKeyStorage";
import { getAvailableModels } from "@/lib/availableModels";
import type { Character } from "@/types/cablebox";

type ShowCastConfigProps = {
  activeCharacters: Character[];
  onCharacterToggle: (showChar: ShowCharacter, model?: AIModel) => void;
  onModelChange: (characterId: string, model: AIModel) => void;
  onVoiceChange: (characterId: string, voiceName: string) => void;
  availableVoices: Array<{ id: string; name: string }>;
  userTier?: "free" | "pro";
};

const ShowCastConfig: React.FC<ShowCastConfigProps> = ({
  activeCharacters,
  onCharacterToggle,
  onModelChange,
  onVoiceChange,
  availableVoices,
  userTier,
}) => {
  const availableModels = getAvailableModels(userTier);

  const isCharacterActive = (showCharName: string) => {
    return activeCharacters.some((c) => c.name === showCharName);
  };

  const getCharacterModel = (showCharName: string): AIModel => {
    const character = activeCharacters.find((c) => c.name === showCharName);
    return (character?.model as AIModel) || "gpt-5";
  };

  const getCharacterVoice = (showCharName: string): string => {
    const character = activeCharacters.find((c) => c.name === showCharName);
    return character?.voiceName || (availableVoices[0]?.id || "");
  };

  const getCharacterId = (showCharName: string): string | undefined => {
    const character = activeCharacters.find((c) => c.name === showCharName);
    return character?.id;
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        Cast Configuration
      </h3>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {SHOW_CHARACTERS.map((showChar) => {
          const isActive = isCharacterActive(showChar.name);
          const currentModel = getCharacterModel(showChar.name);
          const currentVoice = getCharacterVoice(showChar.name);
          const characterId = getCharacterId(showChar.name);

          return (
            <div
              key={showChar.id}
              className={`rounded-lg border p-3 transition-all ${
                isActive
                  ? "border-purple-500/30 bg-purple-500/5"
                  : "border-slate-700 bg-slate-800/50"
              }`}
            >
              {/* Character Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: showChar.color }}
                  />
                  <span className="text-sm font-medium text-slate-200">
                    {showChar.name}
                  </span>
                </div>

                {/* Toggle Button */}
                <button
                  onClick={() => onCharacterToggle(showChar, currentModel)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-red-600 text-white hover:bg-red-500"
                      : "bg-green-600 text-white hover:bg-green-500"
                  }`}
                >
                  {isActive ? "Remove" : "Add"}
                </button>
              </div>

              {/* Character Description */}
              <p className="text-xs text-slate-400 mb-2">{showChar.description}</p>

              {/* Model and Voice Selection (only shown if active) */}
              {isActive && characterId && (
                <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">
                  {/* AI Model */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">AI Model:</label>
                    <select
                      value={currentModel}
                      onChange={(e) => onModelChange(characterId, e.target.value as AIModel)}
                      className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {availableModels.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label} ({model.provider})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Voice Selection */}
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Voice (ElevenLabs):</label>
                    <select
                      value={currentVoice}
                      onChange={(e) => onVoiceChange(characterId, e.target.value)}
                      className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {availableVoices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Banner */}
      <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
        <p className="text-xs text-blue-200">
          <strong>Tip:</strong> Select which characters appear, choose their AI model (GPT, Claude, Grok), and pick realistic ElevenLabs voices.
          Mix and match for unique personalities!
        </p>
      </div>
    </div>
  );
};

export default ShowCastConfig;
