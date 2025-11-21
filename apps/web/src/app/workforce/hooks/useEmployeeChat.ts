/**
 * useEmployeeChat Hook
 * Unified hook for managing chat sessions with Virtual Employees
 * Handles both training sessions and instruction sessions
 */

'use client';

import { useState, useCallback } from 'react';
import type { VirtualEmployee, Team, TrainingMessage, InstructionMessage } from '../types';
import { sendEmployeeChat, generateSummaryAndUpdatePrompt } from '../lib/employeeAIClient';
import { supabase } from '@/lib/supabaseClient';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

type UseEmployeeChatOptions = {
  userId: string;
  userTier: 'free' | 'pro';
  isTraining?: boolean;
};

type UseEmployeeChatResult = {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  endTrainingSession: (notifyEmployee?: VirtualEmployee | null) => Promise<boolean>;
  clearMessages: () => void;
};

export function useEmployeeChat(
  employee: VirtualEmployee | null,
  team: Team | null,
  options: UseEmployeeChatOptions
): UseEmployeeChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { userId, userTier, isTraining = false } = options;

  // Send a message to the employee
  const sendMessage = useCallback(
    async (content: string) => {
      if (!employee || !team) {
        setError('Employee and team are required');
        return;
      }

      setLoading(true);
      setError(null);

      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      try {
        // Get training summaries (for non-training mode)
        const trainingSummaries: string[] = [];
        if (!isTraining) {
          // TODO: Fetch from database
          // const { data } = await supabase
          //   .from('training_sessions')
          //   .select('summary')
          //   .eq('virtual_employee_id', employee.id)
          //   .not('summary', 'is', null);
          // trainingSummaries = data?.map(s => s.summary) || [];
        }

        // Call AI
        const response = await sendEmployeeChat(
          employee,
          team,
          [...messages, userMessage],
          {
            userId,
            userTier,
            isTraining,
            trainingSummaries,
          }
        );

        // Add assistant message
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.content,
          created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Save to database
        if (isTraining) {
          // Create session if doesn't exist
          if (!sessionId) {
            const { data: session } = await supabase
              .from('training_sessions')
              .insert({
                team_id: team.id,
                virtual_employee_id: employee.id,
              })
              .select()
              .single();

            if (session) {
              setSessionId(session.id);
            }
          }

          // Save messages
          if (sessionId) {
            await supabase.from('training_messages').insert([
              {
                training_session_id: sessionId,
                role: 'user',
                content: userMessage.content,
              },
              {
                training_session_id: sessionId,
                role: 'assistant',
                content: assistantMessage.content,
              },
            ]);
          }
        } else {
          // TODO: Save instruction messages
        }
      } catch (err: any) {
        console.error('Error sending message:', err);
        setError(err.message || 'Failed to send message');
      } finally {
        setLoading(false);
      }
    },
    [employee, team, messages, userId, userTier, isTraining, sessionId]
  );

  // End training session and update system prompt
  const endTrainingSession = useCallback(async (notifyEmployee?: VirtualEmployee | null): Promise<boolean> => {
    if (!employee || !sessionId || !isTraining) {
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // OPTIMIZED: Generate summary and update prompt in a single AI call (2x faster!)
      const { summary, updatedPrompt } = await generateSummaryAndUpdatePrompt(
        employee,
        messages.map((m) => ({ role: m.role, content: m.content })),
        { userId, userTier },
        notifyEmployee
      );

      // Save session
      await supabase
        .from('training_sessions')
        .update({
          ended_at: new Date().toISOString(),
          summary,
          prompt_updates: 'Updated based on training session',
        })
        .eq('id', sessionId);

      // Update employee
      await supabase
        .from('virtual_employees')
        .update({
          system_prompt: updatedPrompt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee.id);

      return true;
    } catch (err: any) {
      console.error('Error ending training session:', err);
      setError(err.message || 'Failed to end training session');
      return false;
    } finally {
      setLoading(false);
    }
  }, [employee, sessionId, isTraining, messages, userId, userTier]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    endTrainingSession,
    clearMessages,
  };
}
