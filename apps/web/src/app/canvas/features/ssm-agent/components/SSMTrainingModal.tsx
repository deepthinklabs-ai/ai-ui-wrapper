/**
 * SSMTrainingModal Component
 *
 * Modal container for the SSM training conversation.
 * Combines SSMChatMessages and SSMChatInput components.
 *
 * Separation:
 * - Layout and modal behavior
 * - Delegates message display to SSMChatMessages
 * - Delegates input to SSMChatInput
 * - State managed by useSSMTraining hook
 */

'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { SSMChatMessages } from './SSMChatMessages';
import { SSMChatInput } from './SSMChatInput';
import type {
  SSMTrainingMessage,
  SSMTrainingPhase,
  SSMExtractedInfo,
} from '../types/training';

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

// ============================================================================
// TYPES
// ============================================================================

export interface SSMTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeName: string;

  // State from hook
  messages: SSMTrainingMessage[];
  phase: SSMTrainingPhase;
  extractedInfo: SSMExtractedInfo;
  isLoading: boolean;
  isFinalizing: boolean;
  error: string | null;
  sessionStartedAt: string | null;

  // Actions from hook
  onSendMessage: (message: string) => Promise<void>;
  onFinalize: () => Promise<unknown>;
  onReset: () => void;
}

// ============================================================================
// COUNTDOWN TIMER COMPONENT
// ============================================================================

function CountdownTimer({ startedAt }: { startedAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      const elapsed = now - start;
      const remaining = SESSION_DURATION_MS - elapsed;

      if (remaining <= 0) {
        setTimeLeft('Expired');
        setIsExpiringSoon(true);
        return;
      }

      // Check if less than 30 minutes remaining
      setIsExpiringSoon(remaining < 30 * 60 * 1000);

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m remaining`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
      } else {
        setTimeLeft(`${seconds}s remaining`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className={`flex items-center gap-1.5 text-xs ${isExpiringSoon ? 'text-red-600' : 'text-foreground/50'}`}>
      <span>⏱️</span>
      <span>{timeLeft}</span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SSMTrainingModal({
  isOpen,
  onClose,
  nodeName,
  messages,
  phase,
  extractedInfo,
  isLoading,
  isFinalizing,
  error,
  sessionStartedAt,
  onSendMessage,
  onFinalize,
  onReset,
}: SSMTrainingModalProps) {
  // Track if mounted (for SSR safety with portal)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  /**
   * Handle backdrop click
   */
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  /**
   * Handle manual finalize
   */
  const handleFinalize = useCallback(async () => {
    await onFinalize();
  }, [onFinalize]);

  // Don't render until mounted (SSR safety) or if not open
  if (!mounted || !isOpen) return null;

  // Use portal to render modal at document.body level (outside sidebar)
  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="
          w-full max-w-2xl h-[80vh] max-h-[700px]
          bg-white rounded-2xl shadow-2xl
          flex flex-col overflow-hidden
          animate-in fade-in zoom-in-95 duration-200
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/10 bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="font-semibold text-foreground">Train SSM Monitor</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-foreground/50">{nodeName}</p>
                {sessionStartedAt && (
                  <>
                    <span className="text-foreground/30">•</span>
                    <CountdownTimer startedAt={sessionStartedAt} />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Reset button */}
            {messages.length > 0 && phase !== 'complete' && (
              <button
                onClick={onReset}
                className="
                  px-3 py-1.5 text-xs rounded-lg
                  text-foreground/60 hover:text-foreground
                  hover:bg-foreground/5
                  transition-colors
                "
                title="Start over"
              >
                Reset
              </button>
            )}

            {/* Manual finalize button */}
            {phase === 'gathering' && messages.length >= 4 && (
              <button
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="
                  px-3 py-1.5 text-xs rounded-lg
                  bg-teal-500 text-white
                  hover:bg-teal-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {isFinalizing ? 'Generating...' : 'Finish & Generate'}
              </button>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="
                w-8 h-8 flex items-center justify-center rounded-full
                text-foreground/40 hover:text-foreground hover:bg-foreground/5
                transition-colors
              "
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Session info banner */}
        {messages.length === 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs flex items-center gap-2">
            <span>⏱️</span>
            <span>
              You have 3 hours from session start to complete training. A countdown timer will appear once you begin.
            </span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-hidden">
          <SSMChatMessages
            messages={messages}
            phase={phase}
            extractedInfo={extractedInfo}
            isLoading={isLoading}
          />
        </div>

        {/* Input area */}
        <SSMChatInput
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          isDisabled={isFinalizing}
          phase={phase}
        />

        {/* Completion overlay */}
        {phase === 'complete' && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center">
            <span className="text-6xl mb-4">✅</span>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Training Complete!
            </h3>
            <p className="text-foreground/60 text-center max-w-sm mb-6">
              Your monitoring rules have been generated and applied to the SSM node.
            </p>
            <button
              onClick={onClose}
              className="
                px-6 py-2 rounded-lg
                bg-teal-500 text-white
                hover:bg-teal-600
                transition-colors
              "
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Render via portal to escape sidebar constraints
  return createPortal(modalContent, document.body);
}

// ============================================================================
// ICONS
// ============================================================================

function CloseIcon() {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export default SSMTrainingModal;
