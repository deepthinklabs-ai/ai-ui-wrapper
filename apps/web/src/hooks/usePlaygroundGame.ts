/**
 * Playground Game State Management Hook
 *
 * Main orchestration hook for The Playground game.
 * Manages characters, dialogue, and game loop.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type {
  Character,
  DialogueMessage,
  GameState,
  PersonalityTrait,
  NewsItem,
} from "@/types/playground";
import { useCharacterAI } from "./useCharacterAI";
import { useNewsIntegration } from "./useNewsIntegration";
import { getRandomCharacterColor } from "@/lib/playgroundPresets";

type UsePlaygroundGameProps = {
  userId: string;
  userTier: "free" | "pro";
  onDialogueAdded?: (characterId: string, characterName: string, text: string) => void;
};

type UsePlaygroundGameResult = {
  characters: Character[];
  dialogueHistory: DialogueMessage[];
  isPaused: boolean;
  gameSpeed: number;
  currentNews: NewsItem[];
  isLoading: boolean;
  addCharacter: (name: string, personality: PersonalityTrait[], customPrompt?: string) => void;
  removeCharacter: (characterId: string) => void;
  updateCharacterPersonality: (
    characterId: string,
    personality: PersonalityTrait[],
    customPrompt?: string
  ) => void;
  updateCharacterPosition: (characterId: string, x: number, y: number, z: number) => void;
  togglePause: () => void;
  setGameSpeed: (speed: number) => void;
  clearDialogue: () => void;
  rewindDialogue: (count?: number) => void;
  triggerCharacterReaction: (characterId: string, newsId?: string) => Promise<void>;
};

export function usePlaygroundGame({
  userId,
  userTier,
  onDialogueAdded,
}: UsePlaygroundGameProps): UsePlaygroundGameResult {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [dialogueHistory, setDialogueHistory] = useState<DialogueMessage[]>([]);
  const [isPaused, setIsPaused] = useState(true); // Start paused by default to prevent surprise costs
  const [gameSpeed, setGameSpeed] = useState(1); // 1x, 2x, 4x
  const [isLoading, setIsLoading] = useState(false);

  const characterAI = useCharacterAI({ userId, userTier });
  const { currentNews } = useNewsIntegration();

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const lastNewsIdRef = useRef<string | null>(null);
  const interactionCountRef = useRef(0);
  const MAX_INTERACTIONS_PER_SESSION = 50; // Auto-pause after 50 interactions (~$0.08-$0.12)

  /**
   * Add a new character to the game
   */
  const addCharacter = useCallback(
    (name: string, personality: PersonalityTrait[], customPrompt?: string) => {
      const newCharacter: Character = {
        id: `char-${Date.now()}-${Math.random()}`,
        name,
        position: {
          x: Math.random() * 20 - 10, // Random position in scene
          y: 0,
          z: Math.random() * 20 - 10,
        },
        rotation: Math.random() * Math.PI * 2,
        color: getRandomCharacterColor(),
        personality,
        customPrompt,
        currentActivity: "idle",
        isThinking: false,
      };

      setCharacters((prev) => [...prev, newCharacter]);
    },
    []
  );

  /**
   * Remove a character from the game
   */
  const removeCharacter = useCallback((characterId: string) => {
    setCharacters((prev) => prev.filter((char) => char.id !== characterId));
    // Remove their dialogue from history (optional - could keep for history)
    // setDialogueHistory((prev) => prev.filter((msg) => msg.characterId !== characterId));
  }, []);

  /**
   * Update character's personality
   */
  const updateCharacterPersonality = useCallback(
    (characterId: string, personality: PersonalityTrait[], customPrompt?: string) => {
      setCharacters((prev) =>
        prev.map((char) =>
          char.id === characterId
            ? { ...char, personality, customPrompt }
            : char
        )
      );
    },
    []
  );

  /**
   * Update character's position (from 3D scene)
   */
  const updateCharacterPosition = useCallback(
    (characterId: string, x: number, y: number, z: number) => {
      setCharacters((prev) =>
        prev.map((char) =>
          char.id === characterId ? { ...char, position: { x, y, z } } : char
        )
      );
    },
    []
  );

  /**
   * Toggle game pause
   */
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  /**
   * Clear all dialogue history
   */
  const clearDialogue = useCallback(() => {
    setDialogueHistory([]);
  }, []);

  /**
   * Rewind dialogue by removing the last N messages
   */
  const rewindDialogue = useCallback((count: number = 5) => {
    setDialogueHistory((prev) => {
      if (prev.length <= count) {
        return [];
      }
      return prev.slice(0, -count);
    });
  }, []);

  /**
   * Add a dialogue message
   */
  const addDialogue = useCallback((characterId: string, characterName: string, text: string, reactingTo?: string) => {
    const message: DialogueMessage = {
      id: `msg-${Date.now()}-${Math.random()}`,
      characterId,
      characterName,
      text,
      timestamp: new Date(),
      isReaction: !!reactingTo,
      reactingTo,
    };

    setDialogueHistory((prev) => [...prev, message]);

    // Notify parent component for TTS
    onDialogueAdded?.(characterId, characterName, text);
  }, [onDialogueAdded]);

  /**
   * Manually trigger a character to react (e.g., to news or another character)
   */
  const triggerCharacterReaction = useCallback(
    async (characterId: string, newsId?: string) => {
      const character = characters.find((c) => c.id === characterId);
      if (!character || character.isThinking) return;

      // Check interaction limit
      if (interactionCountRef.current >= MAX_INTERACTIONS_PER_SESSION) {
        console.log("Max interactions reached, auto-pausing game");
        setIsPaused(true);
        alert(
          `Playground auto-paused after ${MAX_INTERACTIONS_PER_SESSION} interactions to control costs.\n\n` +
          `Estimated cost this session: $${(MAX_INTERACTIONS_PER_SESSION * 0.0016).toFixed(2)} - $${(MAX_INTERACTIONS_PER_SESSION * 0.0024).toFixed(2)}\n\n` +
          `Click Play to continue (interaction counter will reset).`
        );
        interactionCountRef.current = 0;
        return;
      }

      // Increment interaction counter
      interactionCountRef.current++;

      // Mark character as thinking
      setCharacters((prev) =>
        prev.map((char) =>
          char.id === characterId ? { ...char, isThinking: true } : char
        )
      );

      try {
        let reaction: string;

        if (newsId) {
          // React to specific news
          const newsItem = currentNews.find((n) => n.id === newsId);
          if (!newsItem) return;

          reaction = await characterAI.generateReactionToNews(
            character,
            newsItem,
            dialogueHistory
          );
        } else {
          // Spontaneous comment
          reaction = await characterAI.generateSpontaneousComment(character, {
            recentNews: currentNews,
            recentDialogue: dialogueHistory,
          });
        }

        addDialogue(character.id, character.name, reaction, newsId);
      } finally {
        // Mark character as done thinking
        setCharacters((prev) =>
          prev.map((char) =>
            char.id === characterId ? { ...char, isThinking: false } : char
          )
        );
      }
    },
    [characters, currentNews, dialogueHistory, characterAI, addDialogue]
  );

  /**
   * Trigger initial reactions when game starts
   */
  useEffect(() => {
    if (!isPaused && characters.length > 0 && dialogueHistory.length === 0) {
      // Reset interaction counter when starting fresh
      interactionCountRef.current = 0;

      // Only the first character speaks about news to start the conversation
      // Others will respond to this in the game loop
      const firstCharacter = characters[0];
      triggerCharacterReaction(firstCharacter.id, currentNews[0]?.id);
    }
  }, [isPaused, characters, dialogueHistory.length, triggerCharacterReaction, currentNews]);

  /**
   * Game loop - conversational flow where characters respond to each other
   */
  useEffect(() => {
    if (isPaused || characters.length === 0 || dialogueHistory.length === 0) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    // Base interval: 8 seconds (natural conversation pace), adjusted by game speed
    const baseInterval = 8000;
    const interval = baseInterval / gameSpeed;

    gameLoopRef.current = setInterval(async () => {
      // Get the last message
      const lastMessage = dialogueHistory[dialogueHistory.length - 1];
      if (!lastMessage) return;

      // Don't let any character be currently thinking (wait for previous to finish)
      const isAnyoneThinking = characters.some((c) => c.isThinking);
      if (isAnyoneThinking) return;

      // Find a character to respond (not the last speaker)
      // Prefer characters who haven't spoken recently
      const recentSpeakers = dialogueHistory
        .slice(-3)
        .map((msg) => msg.characterId);

      // Get characters who can speak (not the last speaker)
      const eligibleCharacters = characters.filter(
        (char) => char.id !== lastMessage.characterId
      );

      if (eligibleCharacters.length === 0) return;

      // Sort by who spoke least recently
      const sortedCharacters = eligibleCharacters.sort((a, b) => {
        const aLastIndex = recentSpeakers.lastIndexOf(a.id);
        const bLastIndex = recentSpeakers.lastIndexOf(b.id);
        return aLastIndex - bLastIndex; // Lower index = spoke less recently
      });

      // Pick the character who hasn't spoken in a while
      const nextCharacter = sortedCharacters[0];

      // Mark character as thinking
      setCharacters((prev) =>
        prev.map((char) =>
          char.id === nextCharacter.id ? { ...char, isThinking: true } : char
        )
      );

      try {
        // Always respond to the last message in the conversation
        const reaction = await characterAI.generateReactionToCharacter(
          nextCharacter,
          lastMessage,
          dialogueHistory
        );
        addDialogue(
          nextCharacter.id,
          nextCharacter.name,
          reaction,
          lastMessage.id
        );
      } finally {
        // Mark character as done thinking
        setCharacters((prev) =>
          prev.map((char) =>
            char.id === nextCharacter.id ? { ...char, isThinking: false } : char
          )
        );
      }
    }, interval);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [
    isPaused,
    gameSpeed,
    characters,
    dialogueHistory,
    characterAI,
    addDialogue,
  ]);

  return {
    characters,
    dialogueHistory,
    isPaused,
    gameSpeed,
    currentNews,
    isLoading,
    addCharacter,
    removeCharacter,
    updateCharacterPersonality,
    updateCharacterPosition,
    togglePause,
    setGameSpeed,
    clearDialogue,
    rewindDialogue,
    triggerCharacterReaction,
  };
}
