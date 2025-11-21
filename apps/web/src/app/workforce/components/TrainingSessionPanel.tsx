/**
 * Training Session Panel
 * Chat interface for training virtual employees
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { VirtualEmployee, Team } from '../types';
import { useEmployeeChat } from '../hooks/useEmployeeChat';

type TrainingSessionPanelProps = {
  employee: VirtualEmployee;
  team: Team;
  allEmployees: VirtualEmployee[];
  userId: string;
  userTier: 'free' | 'pro';
  onClose: () => void;
};

export default function TrainingSessionPanel({
  employee,
  team,
  allEmployees,
  userId,
  userTier,
  onClose,
}: TrainingSessionPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedNotifyEmployee, setSelectedNotifyEmployee] = useState<string | null>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter out the current employee
  const otherEmployees = allEmployees.filter(emp => emp.id !== employee.id);

  const { messages, loading, error, sendMessage, endTrainingSession, clearMessages } = useEmployeeChat(
    employee,
    team,
    {
      userId,
      userTier,
      isTraining: true,
    }
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || loading) return;

    const message = inputValue;
    setInputValue('');
    await sendMessage(message);
  };

  const handleEndSession = async () => {
    if (confirm('End this training session? The employee will be updated with what they learned.')) {
      setIsEndingSession(true);

      const notifyEmployee = selectedNotifyEmployee
        ? otherEmployees.find(e => e.id === selectedNotifyEmployee)
        : null;

      const success = await endTrainingSession(notifyEmployee);

      setIsEndingSession(false);

      if (success) {
        alert('Training session completed! Employee system prompt has been updated.');
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                Training: {employee.name}
              </h2>
              <p className="text-sm text-slate-400">{employee.title}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEndSession}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
                disabled={messages.length === 0}
              >
                End Session
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Team Mission Reminder */}
        <div className="flex-shrink-0 border-b border-slate-800 bg-blue-900/10 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Team Mission
          </div>
          <p className="mt-1 text-sm text-slate-300">{team.mission_statement}</p>
        </div>

        {/* Employee Notification Selection */}
        {otherEmployees.length > 0 && (
          <div className="flex-shrink-0 border-b border-slate-800 bg-purple-900/10 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-2">
              Who to notify when task is complete
            </div>
            <div className="flex flex-wrap gap-2">
              {otherEmployees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedNotifyEmployee(
                    selectedNotifyEmployee === emp.id ? null : emp.id
                  )}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedNotifyEmployee === emp.id
                      ? 'bg-purple-600 text-white border-2 border-purple-400'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {emp.name} ({emp.title})
                </button>
              ))}
              {selectedNotifyEmployee && (
                <button
                  type="button"
                  onClick={() => setSelectedNotifyEmployee(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium bg-red-900/20 text-red-400 border border-red-700 hover:bg-red-900/30"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-4xl">💬</div>
              <p className="mt-4 text-sm font-medium text-slate-300">
                Start training {employee.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Teach them about their role, processes, and expectations
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-semibold opacity-70">
                      {msg.role === 'user' ? 'You' : employee.name}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm">{msg.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-slate-800 px-4 py-3 text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-slate-500"></div>
                      <div className="h-2 w-2 animate-pulse rounded-full bg-slate-500 animation-delay-200"></div>
                      <div className="h-2 w-2 animate-pulse rounded-full bg-slate-500 animation-delay-400"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex-shrink-0 border-t border-slate-800 bg-red-900/20 px-4 py-2">
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {/* Input */}
        <div className="flex-shrink-0 border-t border-slate-800 p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your training instructions..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              disabled={loading}
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              disabled={loading || !inputValue.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Loading Modal for Ending Session */}
      {isEndingSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-6">
              {/* Spinning Loader */}
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-500"></div>
              </div>

              {/* Text */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-100">
                  Updating System Prompt
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Analyzing training session and updating {employee.name}'s knowledge...
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Please wait, this may take a few moments
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
