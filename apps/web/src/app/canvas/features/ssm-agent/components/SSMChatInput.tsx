/**
 * SSMChatInput Component
 *
 * Input field and send button for the training conversation.
 * Handles message composition and submission.
 *
 * Separation:
 * - Pure presentation component
 * - Calls parent callback to send message
 * - Local state for input value only
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { SSMTrainingPhase } from '../types/training';

// ============================================================================
// TYPES
// ============================================================================

export interface SSMChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  isLoading?: boolean;
  isDisabled?: boolean;
  phase: SSMTrainingPhase;
  placeholder?: string;
}

// ============================================================================
// PHASE-SPECIFIC PLACEHOLDERS
// ============================================================================

const PHASE_PLACEHOLDERS: Record<SSMTrainingPhase, string> = {
  greeting: 'Tell me what you want to monitor...',
  gathering: 'Describe your requirements...',
  clarifying: 'Answer the clarifying question...',
  summarizing: 'Review the summary...',
  confirming: 'Type "yes" to confirm or describe changes...',
  generating: 'Generating your rules...',
  complete: 'Training complete!',
};

// ============================================================================
// QUICK RESPONSES
// ============================================================================

interface QuickResponse {
  label: string;
  value: string;
  phases: SSMTrainingPhase[];
}

const QUICK_RESPONSES: QuickResponse[] = [
  { label: 'Looks good', value: 'Looks good, generate the rules.', phases: ['gathering', 'clarifying'] },
  { label: 'Yes, confirm', value: 'Yes, that looks correct.', phases: ['confirming'] },
  { label: 'Make changes', value: "I'd like to make some changes.", phases: ['confirming'] },
  { label: 'Add more', value: 'I want to add more monitoring rules.', phases: ['summarizing'] },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SSMChatInput({
  onSendMessage,
  isLoading = false,
  isDisabled = false,
  phase,
  placeholder,
}: SSMChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus input on mount and phase change
  useEffect(() => {
    if (!isDisabled && !isLoading) {
      textareaRef.current?.focus();
    }
  }, [phase, isDisabled, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  /**
   * Handle send
   */
  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isLoading || isDisabled) return;

    setInputValue('');
    await onSendMessage(message);
  }, [inputValue, isLoading, isDisabled, onSendMessage]);

  /**
   * Handle key press (Enter to send, Shift+Enter for newline)
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  /**
   * Handle quick response click
   */
  const handleQuickResponse = useCallback(async (value: string) => {
    if (isLoading || isDisabled) return;
    await onSendMessage(value);
  }, [isLoading, isDisabled, onSendMessage]);

  // Get available quick responses for current phase
  const availableQuickResponses = QUICK_RESPONSES.filter(qr =>
    qr.phases.includes(phase)
  );

  // Determine if input should be disabled
  const inputDisabled = isDisabled || isLoading || phase === 'generating' || phase === 'complete';

  // Get placeholder text
  const displayPlaceholder = placeholder || PHASE_PLACEHOLDERS[phase];

  return (
    <div className="border-t border-foreground/10 bg-white/50">
      {/* Quick responses */}
      {availableQuickResponses.length > 0 && !inputDisabled && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {availableQuickResponses.map((qr) => (
            <button
              key={qr.label}
              onClick={() => handleQuickResponse(qr.value)}
              disabled={isLoading}
              className="
                px-3 py-1.5 text-xs rounded-full
                bg-teal-50 text-teal-700 border border-teal-200
                hover:bg-teal-100 hover:border-teal-300
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {qr.label}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-4">
        <div className="flex items-end gap-2">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={displayPlaceholder}
              disabled={inputDisabled}
              rows={1}
              className="
                w-full px-4 py-3 pr-12
                border border-foreground/20 rounded-2xl
                text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                disabled:bg-foreground/5 disabled:text-foreground/30 disabled:cursor-not-allowed
                placeholder:text-foreground/30
              "
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />

            {/* Character count (when typing) */}
            {inputValue.length > 50 && (
              <div className="absolute right-14 bottom-3 text-xs text-foreground/30">
                {inputValue.length}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || inputDisabled}
            className="
              flex items-center justify-center
              w-12 h-12 rounded-full
              bg-teal-500 text-white
              hover:bg-teal-600
              disabled:bg-foreground/20 disabled:text-foreground/40 disabled:cursor-not-allowed
              transition-colors
            "
            title={inputDisabled ? 'Cannot send right now' : 'Send message'}
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>

        {/* Helper text */}
        <div className="mt-2 text-xs text-foreground/40 text-center">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function SendIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="w-5 h-5 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default SSMChatInput;
