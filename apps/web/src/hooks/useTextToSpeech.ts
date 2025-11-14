/**
 * Text-to-Speech Hook
 *
 * Handles character voice synthesis with distinct voices per character.
 * Uses Web Speech API for browser-based TTS.
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type VoiceMapping = {
  [characterName: string]: string; // character name -> voice name pattern
};

// Voice preferences for each character (Web Speech API voice patterns)
const CHARACTER_VOICES: VoiceMapping = {
  Larry: "Google US English", // Male, neutral
  Cheryl: "Google UK English Female", // Female, British
  Jeff: "Microsoft David", // Male, anxious
  Susie: "Google US English", // Female, aggressive
  Leon: "Microsoft Mark", // Male, upbeat
  Richard: "Google UK English Male", // Male, pretentious
};

type SpeechQueueItem = {
  text: string;
  characterName: string;
  onStart?: () => void;
  onEnd?: () => void;
};

type UseTextToSpeechResult = {
  speak: (text: string, characterName: string, onStart?: () => void, onEnd?: () => void) => void;
  isSpeaking: boolean;
  currentSpeaker: string | null;
  cancelSpeech: () => void;
  availableVoices: SpeechSynthesisVoice[];
};

export function useTextToSpeech(): UseTextToSpeechResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speechQueueRef = useRef<SpeechQueueItem[]>([]);
  const isProcessingRef = useRef(false);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  /**
   * Find best matching voice for character
   */
  const findVoiceForCharacter = useCallback(
    (characterName: string): SpeechSynthesisVoice | null => {
      if (availableVoices.length === 0) return null;

      const preferredPattern = CHARACTER_VOICES[characterName];
      if (!preferredPattern) {
        // Default to first available voice
        return availableVoices[0];
      }

      // Try to find voice matching pattern
      const matchingVoice = availableVoices.find((voice) =>
        voice.name.includes(preferredPattern)
      );

      if (matchingVoice) return matchingVoice;

      // Fallback: Try to match gender at least
      const isFemale = characterName === "Cheryl" || characterName === "Susie";
      const genderMatch = availableVoices.find((voice) =>
        isFemale
          ? voice.name.toLowerCase().includes("female")
          : voice.name.toLowerCase().includes("male")
      );

      return genderMatch || availableVoices[0];
    },
    [availableVoices]
  );

  /**
   * Process speech queue
   */
  const processQueue = useCallback(() => {
    if (isProcessingRef.current || speechQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    const item = speechQueueRef.current.shift()!;

    const utterance = new SpeechSynthesisUtterance(item.text);
    const voice = findVoiceForCharacter(item.characterName);

    if (voice) {
      utterance.voice = voice;
    }

    // Configure speech parameters
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 1.0; // Full volume

    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentSpeaker(item.characterName);
      item.onStart?.();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentSpeaker(null);
      item.onEnd?.();
      isProcessingRef.current = false;

      // Process next item in queue after a short delay
      setTimeout(() => {
        processQueue();
      }, 500);
    };

    utterance.onerror = () => {
      console.error("Speech synthesis error");
      setIsSpeaking(false);
      setCurrentSpeaker(null);
      isProcessingRef.current = false;
      processQueue();
    };

    window.speechSynthesis.speak(utterance);
  }, [findVoiceForCharacter]);

  /**
   * Add text to speech queue
   */
  const speak = useCallback(
    (text: string, characterName: string, onStart?: () => void, onEnd?: () => void) => {
      speechQueueRef.current.push({
        text,
        characterName,
        onStart,
        onEnd,
      });

      processQueue();
    },
    [processQueue]
  );

  /**
   * Cancel all speech
   */
  const cancelSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    setIsSpeaking(false);
    setCurrentSpeaker(null);
    isProcessingRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return {
    speak,
    isSpeaking,
    currentSpeaker,
    cancelSpeech,
    availableVoices,
  };
}
