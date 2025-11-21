/**
 * Text-to-Speech Hook
 *
 * Handles character voice synthesis with distinct voices per character.
 * Uses Web Speech API for browser-based TTS.
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";

type VoiceMapping = {
  [characterName: string]: {
    pattern: string;
    rate: number; // Speed: 0.1-10 (1 = normal)
    pitch: number; // Pitch: 0-2 (1 = normal)
    volume: number; // Volume: 0-1 (1 = full)
  };
};

// Voice preferences for each character with better tuning
const CHARACTER_VOICES: VoiceMapping = {
  Larry: {
    pattern: "Google US English",
    rate: 1.1, // Slightly faster, neurotic
    pitch: 0.95, // Slightly lower, dry
    volume: 1.0,
  },
  Cheryl: {
    pattern: "Google UK English Female",
    rate: 0.95, // Slower, measured
    pitch: 1.1, // Higher, sharp
    volume: 1.0,
  },
  Jeff: {
    pattern: "Microsoft David",
    rate: 1.2, // Fast, nervous energy
    pitch: 1.05, // Slightly higher, anxious
    volume: 0.95,
  },
  Susie: {
    pattern: "Google US English",
    rate: 1.15, // Fast, aggressive
    pitch: 0.9, // Lower, intimidating
    volume: 1.0,
  },
  Leon: {
    pattern: "Microsoft Mark",
    rate: 0.9, // Slower, laid back
    pitch: 0.85, // Lower, smooth
    volume: 1.0,
  },
  Richard: {
    pattern: "Google UK English Male",
    rate: 0.85, // Slower, pompous
    pitch: 0.9, // Lower, authoritative
    volume: 1.0,
  },
};

type SpeechQueueItem = {
  text: string;
  characterName: string;
  onStart?: () => void;
  onEnd?: () => void;
};

type UseTextToSpeechResult = {
  speak: (text: string, characterName: string, onStart?: () => void, onEnd?: () => void, customVoice?: string) => void;
  isSpeaking: boolean;
  currentSpeaker: string | null;
  cancelSpeech: () => void;
  availableVoices: SpeechSynthesisVoice[];
};

type UseTextToSpeechProps = {
  characterVoiceOverrides?: { [characterName: string]: string }; // Character name -> voice name
};

export function useTextToSpeech(props?: UseTextToSpeechProps): UseTextToSpeechResult {
  const characterVoiceOverrides = props?.characterVoiceOverrides || {};
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

      // Check if there's a custom voice override for this character
      const customVoiceName = characterVoiceOverrides[characterName];
      if (customVoiceName) {
        const customVoice = availableVoices.find((voice) => voice.name === customVoiceName);
        if (customVoice) return customVoice;
      }

      const voiceConfig = CHARACTER_VOICES[characterName];
      if (!voiceConfig) {
        // Default to first available voice
        return availableVoices[0];
      }

      // Try to find voice matching pattern
      const matchingVoice = availableVoices.find((voice) =>
        voice.name.includes(voiceConfig.pattern)
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
    [availableVoices, characterVoiceOverrides]
  );

  /**
   * Process speech queue
   */
  const processQueue = useCallback(() => {
    if (isProcessingRef.current || speechQueueRef.current.length === 0) {
      return;
    }

    console.log('[TTS] Processing queue, items:', speechQueueRef.current.length);
    isProcessingRef.current = true;
    const item = speechQueueRef.current.shift()!;
    console.log('[TTS] Speaking:', item.characterName);

    const utterance = new SpeechSynthesisUtterance(item.text);
    const voice = findVoiceForCharacter(item.characterName);

    if (voice) {
      utterance.voice = voice;
    }

    // Configure speech parameters with character-specific tuning
    const voiceConfig = CHARACTER_VOICES[item.characterName];
    if (voiceConfig) {
      utterance.rate = voiceConfig.rate;
      utterance.pitch = voiceConfig.pitch;
      utterance.volume = voiceConfig.volume;
    } else {
      // Default parameters
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
    }

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
      console.log('[TTS] Queueing speech:', { characterName, textLength: text.length });

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
