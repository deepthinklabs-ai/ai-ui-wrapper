/**
 * ElevenLabs Text-to-Speech Hook
 *
 * Provides realistic AI voices using ElevenLabs API
 */

"use client";

import { useCallback, useState, useRef } from "react";

// Popular ElevenLabs voice IDs
export const ELEVENLABS_VOICES = {
  // Male voices
  ADAM: "pNInz6obpgDQGcFmaJgB", // Deep, confident
  ANTONI: "ErXwobaYiN019PkySvjV", // Well-rounded
  ARNOLD: "VR6AewLTigWG4xSOukaG", // Crisp, strong
  CALLUM: "N2lVS1w4EtoT3dr4eOWO", // Hoarse, mature
  CHARLIE: "IKne3meq5aSn9XLyUdCD", // Casual, conversational
  CLYDE: "2EiwWnXFnvU5JabPnv8n", // Smooth, warm
  DANIEL: "onwK4e9ZLuTAKqWW03F9", // Deep, authoritative
  DAVE: "CYw3kZ02Hs0563khs1Fj", // Conversational, young
  ETHAN: "g5CIjZEefAph4nQFvHAz", // Smooth, pleasant
  FINN: "D38z5RcWu1voky8WS1ja", // Elderly, wise
  GEORGE: "JBFqnCBsd6RMkjVDRZzb", // Raspy, mature
  JOSH: "TxGEqnHWrfWFTfGW9XjX", // Young, upbeat
  LIAM: "TX3LPaxmHKxFdv7VOQHJ", // Articulate, neutral
  THOMAS: "GBv7mTt0atIp3Br8iCZE", // Calm, news anchor

  // Female voices
  BELLA: "EXAVITQu4vr4xnSDxMaL", // Soft, American (same as Sarah)
  CHARLOTTE: "XB0fDUnXU5powFXDhCwa", // Seductive, smooth
  DOROTHY: "ThT5KcBeYPX3keUQqHPh", // Pleasant, young
  EMILY: "LcfcDJNUP1GQjkzn1xUU", // Calm, conversational
  ELLI: "MF3mGyEYCl7XYWbV9V6O", // Energetic, young
  FREYA: "jsCqWAovK2LkecY7zXl4", // Expressive, mature
  GIGI: "jBpfuIE2acCO8z3wKNLl", // Childish, playful
  GLINDA: "z9fAnlkpzviPz146aGWa", // Witch-like, theatrical
  GRACE: "oWAxZDx7w5VEj9dCyTzz", // Southern accent
  MATILDA: "XrExE9yKIg1WjnnlVkGX", // Warm, pleasant
  NICOLE: "piTKgcLEGmPE4e6mEKli", // Whispery, ASMR
  RACHEL: "21m00Tcm4TlvDq8ikWAM", // Calm, narrative
};

// Character-specific voice mapping
const CHARACTER_VOICE_MAP: { [characterName: string]: string } = {
  Larry: ELEVENLABS_VOICES.CHARLIE, // Neurotic, conversational
  Cheryl: ELEVENLABS_VOICES.CHARLOTTE, // Sharp, mature
  Jeff: ELEVENLABS_VOICES.DAVE, // Anxious, young
  Susie: ELEVENLABS_VOICES.DOROTHY, // Aggressive but feminine
  Leon: ELEVENLABS_VOICES.CLYDE, // Smooth, laid back
  Richard: ELEVENLABS_VOICES.DANIEL, // Pompous, authoritative
};

type SpeechQueueItem = {
  text: string;
  characterName: string;
  voiceId: string;
  onStart?: () => void;
  onEnd?: () => void;
};

type UseElevenLabsTTSProps = {
  characterVoiceOverrides?: { [characterName: string]: string };
};

type UseElevenLabsTTSResult = {
  speak: (text: string, characterName: string, onStart?: () => void, onEnd?: () => void) => void;
  isSpeaking: boolean;
  currentSpeaker: string | null;
  cancelSpeech: () => void;
  availableVoices: Array<{ id: string; name: string }>;
};

export function useElevenLabsTTS(props?: UseElevenLabsTTSProps): UseElevenLabsTTSResult {
  const characterVoiceOverrides = props?.characterVoiceOverrides || {};
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const speechQueueRef = useRef<SpeechQueueItem[]>([]);
  const isProcessingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Convert voice object to array for dropdown
  const availableVoices = Object.entries(ELEVENLABS_VOICES).map(([name, id]) => ({
    id,
    name: name.charAt(0) + name.slice(1).toLowerCase(),
  }));

  /**
   * Get voice ID for character
   */
  const getVoiceForCharacter = useCallback(
    (characterName: string): string => {
      // Check for custom override
      if (characterVoiceOverrides[characterName]) {
        return characterVoiceOverrides[characterName];
      }

      // Use character-specific voice
      return CHARACTER_VOICE_MAP[characterName] || ELEVENLABS_VOICES.ADAM;
    },
    [characterVoiceOverrides]
  );

  /**
   * Process speech queue
   */
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || speechQueueRef.current.length === 0) {
      return;
    }

    console.log('[ElevenLabs TTS] Processing queue, items:', speechQueueRef.current.length);
    isProcessingRef.current = true;
    const item = speechQueueRef.current.shift()!;
    console.log('[ElevenLabs TTS] Speaking:', item.characterName, 'Text length:', item.text.length, 'Text preview:', item.text.substring(0, 100));

    try {
      setIsSpeaking(true);
      setCurrentSpeaker(item.characterName);
      item.onStart?.();

      // Call our API route
      const response = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: item.text,
          voiceId: item.voiceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const data = await response.json();

      // Convert base64 to audio and play
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
      currentAudioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        setCurrentSpeaker(null);
        item.onEnd?.();
        isProcessingRef.current = false;
        currentAudioRef.current = null;

        // Process next item after a short delay
        setTimeout(() => {
          processQueue();
        }, 500);
      };

      audio.onerror = () => {
        console.error('[ElevenLabs TTS] Audio playback error');
        setIsSpeaking(false);
        setCurrentSpeaker(null);
        isProcessingRef.current = false;
        currentAudioRef.current = null;
        processQueue();
      };

      audio.play();
    } catch (error) {
      console.error('[ElevenLabs TTS] Error:', error);
      setIsSpeaking(false);
      setCurrentSpeaker(null);
      item.onEnd?.();
      isProcessingRef.current = false;

      // Continue with next item
      setTimeout(() => {
        processQueue();
      }, 500);
    }
  }, []);

  /**
   * Add text to speech queue
   */
  const speak = useCallback(
    (text: string, characterName: string, onStart?: () => void, onEnd?: () => void) => {
      console.log('[ElevenLabs TTS] Queueing speech:', { characterName, textLength: text.length });

      const voiceId = getVoiceForCharacter(characterName);

      speechQueueRef.current.push({
        text,
        characterName,
        voiceId,
        onStart,
        onEnd,
      });

      processQueue();
    },
    [getVoiceForCharacter, processQueue]
  );

  /**
   * Cancel all speech
   */
  const cancelSpeech = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    speechQueueRef.current = [];
    setIsSpeaking(false);
    setCurrentSpeaker(null);
    isProcessingRef.current = false;
  }, []);

  return {
    speak,
    isSpeaking,
    currentSpeaker,
    cancelSpeech,
    availableVoices,
  };
}
