/**
 * SSMChatMessages Component
 *
 * Displays the conversation history in the training modal.
 * Shows user and assistant messages with appropriate styling.
 *
 * Separation:
 * - Pure presentation component
 * - State managed by useSSMTraining hook
 * - Styling matches the dashboard chat aesthetic
 */

'use client';

import React, { useEffect, useRef } from 'react';
import type { SSMTrainingMessage, SSMTrainingPhase, SSMExtractedInfo } from '../types/training';

// ============================================================================
// TYPES
// ============================================================================

export interface SSMChatMessagesProps {
  messages: SSMTrainingMessage[];
  phase: SSMTrainingPhase;
  extractedInfo: SSMExtractedInfo;
  isLoading?: boolean;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Single message bubble
 */
function MessageBubble({ message }: { message: SSMTrainingMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-3 py-1 text-xs text-foreground/50 bg-foreground/5 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`
          max-w-[85%] px-4 py-3 rounded-2xl
          ${isUser
            ? 'bg-teal-500 text-white rounded-br-md'
            : 'bg-foreground/5 text-foreground rounded-bl-md'
          }
        `}
      >
        {/* Role indicator */}
        <div className={`text-xs mb-1 ${isUser ? 'text-teal-100' : 'text-foreground/40'}`}>
          {isUser ? 'You' : 'Monitor Trainer'}
        </div>

        {/* Message content - render markdown-like formatting */}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {renderMessageContent(message.content)}
        </div>

        {/* Timestamp */}
        <div className={`text-xs mt-2 ${isUser ? 'text-teal-200' : 'text-foreground/30'}`}>
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading indicator (typing dots)
 */
function LoadingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-foreground/5 text-foreground rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Phase indicator
 */
function PhaseIndicator({ phase }: { phase: SSMTrainingPhase }) {
  const phaseInfo: Record<SSMTrainingPhase, { label: string; icon: string; color: string }> = {
    greeting: { label: 'Getting Started', icon: '👋', color: 'text-blue-500' },
    gathering: { label: 'Gathering Info', icon: '📝', color: 'text-teal-500' },
    clarifying: { label: 'Clarifying', icon: '❓', color: 'text-amber-500' },
    summarizing: { label: 'Summarizing', icon: '📋', color: 'text-purple-500' },
    confirming: { label: 'Confirming', icon: '✓', color: 'text-green-500' },
    generating: { label: 'Generating Rules', icon: '⚙️', color: 'text-orange-500' },
    complete: { label: 'Complete', icon: '✅', color: 'text-green-600' },
  };

  const info = phaseInfo[phase];

  return (
    <div className="flex items-center justify-center gap-2 py-2 border-b border-foreground/10">
      <span className={info.color}>{info.icon}</span>
      <span className="text-xs text-foreground/50">{info.label}</span>
    </div>
  );
}

/**
 * Extracted info sidebar
 */
function ExtractedInfoPanel({ info }: { info: SSMExtractedInfo }) {
  const hasInfo = info.monitoringGoal ||
    (info.specificThreats?.length ?? 0) > 0 ||
    (info.trustedDomains?.length ?? 0) > 0;

  if (!hasInfo) return null;

  return (
    <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs">
      <div className="font-semibold text-teal-700 mb-2">Gathered So Far:</div>

      {info.monitoringGoal && (
        <div className="mb-2">
          <span className="text-teal-600">Goal: </span>
          <span className="text-foreground/70">{info.monitoringGoal}</span>
        </div>
      )}

      {info.specificThreats && info.specificThreats.length > 0 && (
        <div className="mb-2">
          <span className="text-teal-600">Threats: </span>
          <span className="text-foreground/70">{info.specificThreats.join(', ')}</span>
        </div>
      )}

      {info.trustedDomains && info.trustedDomains.length > 0 && (
        <div className="mb-2">
          <span className="text-teal-600">Trusted: </span>
          <span className="text-foreground/70">{info.trustedDomains.join(', ')}</span>
        </div>
      )}

      {info.alertOnUrgency && (
        <div className="text-amber-600">
          Will alert on urgent requests
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Render message content with basic markdown support
 */
function renderMessageContent(content: string): React.ReactNode {
  // Split by bold markers (**text**)
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SSMChatMessages({
  messages,
  phase,
  extractedInfo,
  isLoading = false,
}: SSMChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  return (
    <div className="flex flex-col h-full">
      {/* Phase indicator */}
      <PhaseIndicator phase={phase} />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-4xl mb-3">📊</span>
            <p className="text-foreground/50 text-sm">
              Start the conversation to train your Polling Monitor
            </p>
          </div>
        )}

        {/* Message list */}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Loading indicator */}
        {isLoading && <LoadingIndicator />}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Extracted info panel */}
      {phase !== 'greeting' && (
        <div className="px-4 pb-2">
          <ExtractedInfoPanel info={extractedInfo} />
        </div>
      )}
    </div>
  );
}

export default SSMChatMessages;
