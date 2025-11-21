/**
 * MicrophoneButton Component
 *
 * A button that toggles speech recognition with visual feedback.
 * Shows different states: idle, listening, and error.
 */

import React from 'react';

type MicrophoneButtonProps = {
  isListening: boolean;
  isSupported: boolean;
  onClick: () => void;
  disabled?: boolean;
  error?: string | null;
  autoVoiceMode?: boolean;
  pushToTalkMode?: boolean;
  isPushing?: boolean;
};

export default function MicrophoneButton({
  isListening,
  isSupported,
  onClick,
  disabled = false,
  error,
  autoVoiceMode = false,
  pushToTalkMode = false,
  isPushing = false,
}: MicrophoneButtonProps) {
  if (!isSupported) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-500 cursor-not-allowed"
        title="Speech recognition not supported in this browser"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
          <line x1="3" y1="3" x2="21" y2="21" strokeWidth={2} />
        </svg>
        Not supported
      </button>
    );
  }

  // Determine button styling based on mode and state
  const getButtonClass = () => {
    if (pushToTalkMode && isPushing) {
      return 'border-green-500 bg-green-500/20 text-green-400 animate-pulse';
    }
    if (pushToTalkMode && !isListening) {
      return 'border-blue-500 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30';
    }
    if (autoVoiceMode && !isListening) {
      return 'border-purple-500 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30';
    }
    if (isListening) {
      return 'border-red-500 bg-red-500/20 text-red-400 animate-pulse';
    }
    return 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700';
  };

  const getTitle = () => {
    if (pushToTalkMode && isPushing) {
      return 'Push-to-Talk active - Release key to stop';
    }
    if (pushToTalkMode && !isListening) {
      return 'Push-to-Talk mode active - Hold your configured key to speak\n\n💡 Tip: Use non-alphanumeric keys (Space, Tab, etc.) to avoid typing conflicts';
    }
    if (autoVoiceMode && !isListening) {
      return 'Auto-voice mode active - Start speaking to begin';
    }
    if (isListening) {
      return 'Click to stop recording';
    }
    return 'Click to start voice input';
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-all ${getButtonClass()} disabled:opacity-60 disabled:cursor-not-allowed`}
      title={getTitle()}
    >
      <svg
        className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {isListening ? (
          // Stop icon when listening
          <rect
            x="6"
            y="6"
            width="12"
            height="12"
            rx="2"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          // Microphone icon when not listening
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        )}
      </svg>
      {isPushing ? (
        <span className="font-medium">🎙️ Recording...</span>
      ) : pushToTalkMode ? (
        <span className="font-medium">🎙️ Push-to-Talk</span>
      ) : isListening ? (
        <span className="font-medium">Listening...</span>
      ) : autoVoiceMode ? (
        <span className="font-medium">🔊 Auto-voice</span>
      ) : (
        <span>Voice input</span>
      )}
    </button>
  );
}
