/**
 * Auto Send Detection Hook
 *
 * Detects when the user says "send" or "submit" in their transcription
 * and automatically triggers message submission.
 */

"use client";

import { useEffect, useRef } from "react";

type AutoSendDetectionOptions = {
  enabled: boolean;
  transcript: string;
  onSendDetected: () => void;
  // Words that trigger auto-send
  triggerWords?: string[];
};

export function useAutoSendDetection(options: AutoSendDetectionOptions) {
  const {
    enabled,
    transcript,
    onSendDetected,
    triggerWords = ['send', 'submit', 'send it', 'submit it'],
  } = options;

  const lastTranscriptRef = useRef<string>('');

  useEffect(() => {
    if (!enabled || !transcript) return;

    // Only check if transcript changed
    if (transcript === lastTranscriptRef.current) return;
    lastTranscriptRef.current = transcript;

    // Normalize transcript for comparison
    const normalizedTranscript = transcript.toLowerCase().trim();

    // Check if any trigger word appears at the end of the transcript
    const endsWithTrigger = triggerWords.some(word => {
      const normalizedWord = word.toLowerCase();

      // Check if transcript ends with the trigger word
      if (normalizedTranscript.endsWith(normalizedWord)) {
        return true;
      }

      // Check if transcript ends with trigger word + punctuation
      if (normalizedTranscript.endsWith(`${normalizedWord}.`) ||
          normalizedTranscript.endsWith(`${normalizedWord}!`) ||
          normalizedTranscript.endsWith(`${normalizedWord}?`)) {
        return true;
      }

      return false;
    });

    if (endsWithTrigger) {
      console.log('[Auto Send] Trigger word detected in transcript:', transcript);
      onSendDetected();
    }
  }, [enabled, transcript, triggerWords, onSendDetected]);
}
