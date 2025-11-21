/**
 * Voice Activity Detection (VAD) Hook
 *
 * Automatically detects when the user starts/stops speaking using audio analysis.
 * Can be toggled on/off via feature toggle.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type VoiceActivityDetectionOptions = {
  enabled: boolean;
  onSpeakingStart?: () => void;
  onSpeakingStop?: () => void;
  // Sensitivity: lower = more sensitive (0.0 - 1.0)
  threshold?: number;
  // Delay before considering speech stopped (ms)
  silenceDelay?: number;
};

type UseVoiceActivityDetectionResult = {
  isSpeaking: boolean;
  isListening: boolean;
  error: string | null;
};

export function useVoiceActivityDetection(
  options: VoiceActivityDetectionOptions
): UseVoiceActivityDetectionResult {
  const {
    enabled,
    onSpeakingStart,
    onSpeakingStop,
    threshold = 0.02, // Default threshold
    silenceDelay = 800, // Default 800ms of silence before stopping
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Analyze audio levels and detect speech
   */
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !enabled) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength / 255; // Normalize to 0-1

    // Check if volume exceeds threshold
    if (average > threshold) {
      // Clear any pending silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      // Start speaking if not already
      if (!isSpeaking) {
        console.log('[VAD] Speaking detected - average:', average.toFixed(4));
        setIsSpeaking(true);
        onSpeakingStart?.();
      }
    } else if (isSpeaking) {
      // Volume below threshold - wait for silence delay before stopping
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          console.log('[VAD] Silence detected - stopping');
          setIsSpeaking(false);
          onSpeakingStop?.();
          silenceTimeoutRef.current = null;
        }, silenceDelay);
      }
    }

    // Continue analyzing
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  }, [enabled, threshold, silenceDelay, isSpeaking, onSpeakingStart, onSpeakingStop]);

  /**
   * Initialize microphone and audio analysis
   */
  const startListening = useCallback(async () => {
    try {
      console.log('[VAD] Starting voice activity detection...');

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      micStreamRef.current = stream;

      // Create audio context and analyser
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setIsListening(true);
      setError(null);

      // Start analyzing
      analyzeAudio();

      console.log('[VAD] Voice activity detection started');
    } catch (err: any) {
      console.error('[VAD] Error starting voice detection:', err);
      setError(err.message || 'Failed to access microphone');
      setIsListening(false);
    }
  }, [analyzeAudio]);

  /**
   * Stop listening and clean up resources
   */
  const stopListening = useCallback(() => {
    console.log('[VAD] Stopping voice activity detection...');

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsListening(false);
    setIsSpeaking(false);

    console.log('[VAD] Voice activity detection stopped');
  }, []);

  /**
   * Start/stop listening based on enabled state
   */
  useEffect(() => {
    if (enabled && !isListening) {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }

    return () => {
      if (isListening) {
        stopListening();
      }
    };
  }, [enabled, isListening, startListening, stopListening]);

  return {
    isSpeaking,
    isListening,
    error,
  };
}
