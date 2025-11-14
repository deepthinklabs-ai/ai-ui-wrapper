/**
 * Character Configuration Panel
 *
 * Add, remove, and configure AI character personalities.
 */

"use client";

import React, { useState } from "react";
import type { Character, PersonalityTrait } from "@/types/playground";
import { PERSONALITY_PRESETS } from "@/lib/playgroundPresets";

type CharacterConfigProps = {
  characters: Character[];
  onAddCharacter: (name: string, personality: PersonalityTrait[], customPrompt?: string) => void;
  onRemoveCharacter: (characterId: string) => void;
  onUpdatePersonality: (
    characterId: string,
    personality: PersonalityTrait[],
    customPrompt?: string
  ) => void;
};

export default function CharacterConfig({
  characters,
  onAddCharacter,
  onRemoveCharacter,
  onUpdatePersonality,
}: CharacterConfigProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(PERSONALITY_PRESETS[0].id);
  const [customPrompt, setCustomPrompt] = useState("");
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);

  const handleAddCharacter = () => {
    if (!newCharacterName.trim()) {
      alert("Please enter a character name");
      return;
    }

    const preset = PERSONALITY_PRESETS.find((p) => p.id === selectedPreset);
    if (!preset) return;

    onAddCharacter(newCharacterName, preset.traits, customPrompt || undefined);

    // Reset form
    setNewCharacterName("");
    setCustomPrompt("");
    setSelectedPreset(PERSONALITY_PRESETS[0].id);
    setShowAddModal(false);
  };

  const handleRemoveCharacter = (characterId: string) => {
    if (confirm("Are you sure you want to remove this character?")) {
      onRemoveCharacter(characterId);
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-slate-700 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-slate-200">Characters</h3>
          {characters.length > 0 && (
            <span className="text-xs text-slate-500">({characters.length})</span>
          )}
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-500 transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Character List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              className="h-12 w-12 text-slate-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="text-sm text-slate-400 mb-3">
              No characters yet. Add some to get started!
            </p>
          </div>
        ) : (
          characters.map((character) => (
            <div
              key={character.id}
              className="rounded border border-slate-700 bg-slate-800 p-3"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: character.color }}
                  />
                  <span className="text-sm font-semibold text-slate-200">
                    {character.name}
                  </span>
                  {character.isThinking && (
                    <span className="text-xs text-purple-400">Thinking...</span>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveCharacter(character.id)}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                  title="Remove character"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Top traits */}
              <div className="space-y-1">
                {character.personality
                  .sort((a, b) => b.weight - a.weight)
                  .slice(0, 3)
                  .map((trait, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                          style={{ width: `${trait.weight}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-20 text-right">
                        {trait.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Character Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-100">Add Character</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Character Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Character Name
                </label>
                <input
                  type="text"
                  value={newCharacterName}
                  onChange={(e) => setNewCharacterName(e.target.value)}
                  placeholder="e.g., Alice, Bob, Charlie"
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              {/* Personality Preset */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Personality Preset
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  {PERSONALITY_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                {selectedPreset && (
                  <p className="mt-2 text-xs text-slate-400">
                    {PERSONALITY_PRESETS.find((p) => p.id === selectedPreset)?.description}
                  </p>
                )}
              </div>

              {/* Custom Prompt (Optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Custom Instructions (Optional)
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Add custom personality instructions..."
                  rows={3}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-700 px-6 py-4">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCharacter}
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors"
              >
                Add Character
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
