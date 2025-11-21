/**
 * Cable Box Character Model Management Hook
 *
 * Manages AI model selection for each character in The Cable Box.
 * This is a separate feature module to keep code organized.
 */

"use client";

import { useCallback } from "react";
import type { Character } from "@/types/cablebox";
import type { AIModel } from "@/lib/apiKeyStorage";

type UseCableBoxCharacterModelsProps = {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
};

type UseCableBoxCharacterModelsResult = {
  updateCharacterModel: (characterId: string, model: AIModel) => void;
  addCharacterWithModel: (
    character: Omit<Character, "id">,
    model?: AIModel
  ) => Character;
};

export function useCableBoxCharacterModels({
  characters,
  setCharacters,
}: UseCableBoxCharacterModelsProps): UseCableBoxCharacterModelsResult {
  /**
   * Update the AI model for a specific character
   */
  const updateCharacterModel = useCallback(
    (characterId: string, model: AIModel) => {
      setCharacters((prev) =>
        prev.map((char) =>
          char.id === characterId ? { ...char, model } : char
        )
      );
    },
    [setCharacters]
  );

  /**
   * Add a character with a specific model
   */
  const addCharacterWithModel = useCallback(
    (character: Omit<Character, "id">, model?: AIModel): Character => {
      const newCharacter: Character = {
        ...character,
        id: `char-${Date.now()}-${Math.random()}`,
        model: model || "gpt-5", // Default to GPT-5
      };

      setCharacters((prev) => [...prev, newCharacter]);
      return newCharacter;
    },
    [setCharacters]
  );

  return {
    updateCharacterModel,
    addCharacterWithModel,
  };
}
