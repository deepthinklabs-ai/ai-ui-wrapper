/**
 * useSpeechRecognition Hook
 *
 * Provides speech-to-text functionality using the Web Speech API.
 * Handles browser compatibility, permission requests, and real-time transcription.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

type UseSpeechRecognitionOptions = {
  onTranscript?: (text: string) => void;
  continuous?: boolean; // Continue listening after user stops speaking
  interimResults?: boolean; // Show interim results while speaking
  language?: string; // Language code (e.g., 'en-US')
};

export function useSpeechRecognition({
  onTranscript,
  continuous = true,
  interimResults = true,
  language = 'en-US',
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false); // Track listening state for event handlers

  // Store onTranscript in a ref to avoid effect re-runs when callback changes
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);

      // Initialize recognition
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = language;

      // Handle results
      recognition.onresult = (event: any) => {
        // Process only the latest final result
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const transcriptText = event.results[i][0].transcript.trim();
            if (transcriptText && onTranscriptRef.current) {
              setTranscript(transcriptText);
              onTranscriptRef.current(transcriptText);
            }
          }
        }
      };

      // Handle errors
      recognition.onerror = (event: any) => {
        // Only handle critical errors that should stop listening
        // Ignore 'no-speech' and 'aborted' errors as they're normal during continuous listening
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // Don't show error or stop listening for these
          return;
        }

        console.error('Speech recognition error:', event.error);

        let errorMessage = 'An error occurred';
        let shouldStopListening = true;

        switch (event.error) {
          case 'audio-capture':
            errorMessage = 'No microphone found. Please check your device.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage = 'Network error. Please check your connection.';
            shouldStopListening = false; // Network errors are temporary, keep trying
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
            shouldStopListening = false; // For unknown errors, try to continue
        }

        if (shouldStopListening) {
          setError(errorMessage);
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      // Handle end - restart if we're still supposed to be listening
      recognition.onend = () => {
        // Check the ref (not state) to see if we should restart
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (err) {
            // If restart fails, then actually stop
            console.error('Failed to restart recognition:', err);
            isListeningRef.current = false;
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [continuous, interimResults, language]); // onTranscript is stored in a ref to prevent re-runs

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    if (recognitionRef.current && !isListeningRef.current) {
      try {
        setError(null);
        setTranscript('');
        isListeningRef.current = true;
        setIsListening(true);
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting speech recognition:', err);
        setError('Failed to start speech recognition. Please try again.');
        isListeningRef.current = false;
        setIsListening(false);
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    // Use the ref to check actual state
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  return {
    isListening,
    isSupported,
    error,
    transcript,
    startListening,
    stopListening,
    toggleListening,
  };
}
