/**
 * SandboxChat Component
 *
 * Chat interface for testing Exchange chatbots in a sandbox session.
 * Messages are ephemeral and not saved to user's threads.
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SandboxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface SandboxChatProps {
  messages: SandboxMessage[];
  sending: boolean;
  error: string | null;
  rateLimitWait: number | null;
  onSendMessage: (message: string) => Promise<boolean>;
  onClearError: () => void;
  chatbotName?: string;
  provider?: string;
}

export default function SandboxChat({
  messages,
  sending,
  error,
  rateLimitWait,
  onSendMessage,
  onClearError,
  chatbotName = 'Chatbot',
  provider,
}: SandboxChatProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sending || (rateLimitWait && rateLimitWait > 0)) {
      return;
    }

    const message = inputValue.trim();
    setInputValue('');
    onClearError();

    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/30 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Sandbox Test
          </h3>
          <p className="text-xs text-foreground/60">
            Testing {chatbotName} {provider && `(${provider})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-600">
            Sandbox Mode
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="rounded-full bg-foreground/10 p-4 mb-4">
              <svg
                className="h-8 w-8 text-foreground/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h4 className="text-sm font-medium text-foreground/80">
              Start Testing
            </h4>
            <p className="text-xs text-foreground/50 mt-1 max-w-xs">
              Send a message to test this chatbot. Messages are not saved to your account.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-sky text-white'
                  : 'bg-foreground/10 text-foreground'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </div>
              <div
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-white/70' : 'text-foreground/60'
                }`}
              >
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-foreground/10 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="h-2 w-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-foreground/60">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-500/10 border border-red-500/50 px-4 py-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={onClearError}
              className="text-red-500 hover:text-red-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Rate limit countdown */}
      {rateLimitWait !== null && rateLimitWait > 0 && (
        <div className="mx-4 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/50 px-4 py-2">
          <p className="text-sm text-amber-600">
            Please wait {rateLimitWait} seconds before sending another message
          </p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-white/30 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sending || (rateLimitWait !== null && rateLimitWait > 0)}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-sm text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending || (rateLimitWait !== null && rateLimitWait > 0)}
            className="rounded-lg bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-foreground/50">
          Press Enter to send. Rate limit: 1 message per 30 seconds.
        </p>
      </form>
    </div>
  );
}
