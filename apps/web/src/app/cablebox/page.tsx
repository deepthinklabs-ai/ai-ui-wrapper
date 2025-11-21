/**
 * The Cable Box - AI-Driven Sims-Style Game
 *
 * Main page for The Cable Box feature.
 * Characters controlled by AI with customizable personalities.
 */

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserTier } from "@/hooks/useUserTier";
import { useCableBoxGame } from "@/hooks/useCableBoxGame";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";
import CableBoxScene from "@/components/cablebox/CableBoxScene";
import DialogueBox from "@/components/cablebox/DialogueBox";
import Subtitles from "@/components/cablebox/Subtitles";
import ShowCastConfig from "@/components/cablebox/ShowCastConfig";
import { SHOW_CHARACTERS, type ShowCharacter } from "@/lib/showCharacters";
import type { Character } from "@/types/cablebox";
import type { AIModel } from "@/lib/apiKeyStorage";

export default function CableBoxPage() {
  const router = useRouter();
  const { user, loadingUser } = useAuthSession();
  const { tier: userTier, loading: tierLoading } = useUserTier(user?.id);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [charactersLoaded, setCharactersLoaded] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<{ character: Character; text: string } | null>(null);
  const [unhingedMode, setUnhingedMode] = useState(false);
  const [characterVoiceOverrides, setCharacterVoiceOverrides] = useState<{ [key: string]: string }>({});

  // Text-to-speech hook (using ElevenLabs for realistic voices)
  const { speak, isSpeaking, currentSpeaker, availableVoices } = useElevenLabsTTS({
    characterVoiceOverrides,
  });

  const {
    characters,
    dialogueHistory,
    isPaused,
    gameSpeed,
    currentNews,
    addCharacter,
    removeCharacter,
    updateCharacterPersonality,
    updateCharacterPosition,
    updateCharacterModel,
    updateCharacterVoice,
    togglePause,
    setGameSpeed,
    clearDialogue,
    rewindDialogue,
    triggerCharacterReaction,
  } = useCableBoxGame({
    userId: user?.id || "",
    userTier: userTier,
    unhingedMode,
    onDialogueAdded: (characterId, characterName, text) => {
      // Find the character to show subtitle
      const character = characters.find((c) => c.id === characterId);
      if (!character) return;

      // Trigger TTS
      speak(
        text,
        characterName,
        () => {
          // On speech start - show subtitle
          setCurrentSubtitle({ character, text });
        },
        () => {
          // On speech end - hide subtitle
          setCurrentSubtitle(null);
        }
      );
    },
  });

  // Handler for toggling show characters
  const handleCharacterToggle = (showChar: ShowCharacter, model?: AIModel) => {
    const isActive = characters.some((c) => c.name === showChar.name);
    if (isActive) {
      // Find the actual character ID by name
      const character = characters.find((c) => c.name === showChar.name);
      if (character) {
        removeCharacter(character.id);
      }
    } else {
      // Add character with the selected model (or default to gpt-5)
      addCharacter(showChar.name, showChar.personality, showChar.customPrompt, model || "gpt-5");
    }
  };

  // Handler for changing character model
  const handleModelChange = (characterId: string, model: AIModel) => {
    updateCharacterModel(characterId, model);
  };

  // Handler for changing character voice
  const handleVoiceChange = (characterId: string, voiceName: string) => {
    updateCharacterVoice(characterId, voiceName);
  };

  // Update voice overrides when characters change
  useEffect(() => {
    const overrides = characters.reduce((acc, char) => {
      if (char.voiceName) {
        acc[char.name] = char.voiceName;
      }
      return acc;
    }, {} as { [key: string]: string });
    setCharacterVoiceOverrides(overrides);
  }, [characters]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loadingUser && !user) {
      router.push("/auth");
    }
  }, [loadingUser, user, router]);

  // Show loading state while checking auth or redirecting
  if (loadingUser || tierLoading || (!loadingUser && !user)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-600 border-t-transparent mx-auto"></div>
          <p className="text-slate-400">Loading Cable Box...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full justify-center overflow-hidden bg-slate-950">
      <div className="flex h-full w-full max-w-[1800px] flex-col gap-4 px-6 py-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-4xl font-bold text-slate-100 flex items-center gap-3">
              <svg className="h-10 w-10 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" className="opacity-20"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              THE SHOW
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Season 1, Episode 1 • "The News" • Live AI Comedy
            </p>
          </div>

          {/* Game Controls */}
          <div className="flex items-center gap-3">
            {/* Unhinged Mode Toggle (for Grok) */}
            <button
              onClick={() => setUnhingedMode(!unhingedMode)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 ${
                unhingedMode
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
              title="Enable wilder, more creative responses for Grok characters"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              {unhingedMode ? "Unhinged ON" : "Unhinged OFF"}
            </button>

            {/* Speed Control */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <select
                value={gameSpeed}
                onChange={(e) => setGameSpeed(Number(e.target.value))}
                className="bg-transparent text-sm text-slate-200 focus:outline-none"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>

            {/* Rewind Button */}
            <button
              onClick={() => rewindDialogue(5)}
              disabled={dialogueHistory.length === 0}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Rewind 5 interactions"
            >
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                </svg>
                Rewind
              </span>
            </button>

            {/* Pause/Play Button */}
            <button
              onClick={togglePause}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isPaused
                  ? "bg-green-600 text-white hover:bg-green-500"
                  : "bg-yellow-600 text-white hover:bg-yellow-500"
              }`}
            >
              {isPaused ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  Pause
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Show Info Banner */}
        <div className="flex-shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-300">NOW SHOWING: Curb Your AI</h4>
              <p className="mt-1 text-sm text-red-200/80">
                Watch 6 AI characters with distinct personalities navigate awkward social situations and discuss the news.
                Like Curb Your Enthusiasm meets AI. Auto-pauses after 50 interactions. Press Play when ready!
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex gap-4">
          {/* LEFT: Cast Configuration */}
          <div className="w-80 overflow-hidden">
            <ShowCastConfig
              activeCharacters={characters}
              onCharacterToggle={handleCharacterToggle}
              onModelChange={handleModelChange}
              onVoiceChange={handleVoiceChange}
              availableVoices={availableVoices}
              userTier={userTier}
            />
          </div>

          {/* MIDDLE: 3D Scene + Cast */}
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            {/* 3D Scene with Subtitles */}
            <div className="flex-1 overflow-hidden rounded-lg border border-slate-700 relative">
              <CableBoxScene
                characters={characters}
                onCharacterClick={(characterId) => {
                  setSelectedCharacterId(characterId);
                  triggerCharacterReaction(characterId);
                }}
              />

              {/* Subtitles Overlay */}
              <Subtitles
                character={currentSubtitle?.character || null}
                text={currentSubtitle?.text || ""}
                isVisible={isSpeaking && currentSubtitle !== null}
              />
            </div>

            {/* Cast List */}
            <div className="flex-shrink-0 rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Cast</h3>
              <div className="grid grid-cols-3 gap-3">
                {characters.map((character) => (
                  <div key={character.id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: character.color }}
                    />
                    <span className="text-xs text-slate-300 font-medium">{character.name}</span>
                    {character.isThinking && (
                      <span className="text-xs text-purple-400">...</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Dialogue Box */}
          <div className="w-96 overflow-hidden">
            <DialogueBox
              dialogueHistory={dialogueHistory}
              characters={characters}
              onClearDialogue={clearDialogue}
            />
          </div>
        </div>

        {/* Current News Ticker (if available) */}
        {currentNews.length > 0 && (
          <div className="flex-shrink-0 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-300">Latest News</p>
                <p className="text-sm text-blue-200 truncate">{currentNews[0].title}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
