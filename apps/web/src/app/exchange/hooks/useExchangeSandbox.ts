/**
 * useExchangeSandbox Hook
 *
 * Manages sandbox session lifecycle for testing Exchange chatbots.
 * Handles session creation, chat messages, and cleanup.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';

interface SandboxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface SandboxSession {
  id: string;
  post_id: string;
  messages: SandboxMessage[];
  last_query_at: string | null;
  created_at: string;
  expires_at: string;
}

interface PostInfo {
  id: string;
  title: string;
  chatbot_config: any;
  has_canvas: boolean;
  oauth_requirements?: {
    gmail?: boolean;
    calendar?: boolean;
    sheets?: boolean;
    docs?: boolean;
    slack?: boolean;
  };
}

interface UseExchangeSandboxResult {
  session: SandboxSession | null;
  postInfo: PostInfo | null;
  messages: SandboxMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  rateLimitWait: number | null;
  startSession: (postId: string) => Promise<boolean>;
  sendMessage: (message: string) => Promise<boolean>;
  endSession: () => Promise<void>;
  clearError: () => void;
}

export function useExchangeSandbox(): UseExchangeSandboxResult {
  const { user } = useAuthSession();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [postInfo, setPostInfo] = useState<PostInfo | null>(null);
  const [messages, setMessages] = useState<SandboxMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitWait, setRateLimitWait] = useState<number | null>(null);
  const rateLimitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear rate limit countdown
  useEffect(() => {
    if (rateLimitWait !== null && rateLimitWait > 0) {
      rateLimitTimerRef.current = setTimeout(() => {
        setRateLimitWait((prev) => (prev && prev > 0 ? prev - 1 : null));
      }, 1000);
    }
    return () => {
      if (rateLimitTimerRef.current) {
        clearTimeout(rateLimitTimerRef.current);
      }
    };
  }, [rateLimitWait]);

  // Cleanup on unmount or page leave
  useEffect(() => {
    const cleanup = () => {
      if (session) {
        // Fire-and-forget cleanup
        fetch(`/api/exchange/sandbox/${session.id}`, {
          method: 'DELETE',
          headers: {
            'x-user-id': user?.id || '',
          },
        }).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [session, user?.id]);

  /**
   * Start a new sandbox session for a post
   */
  const startSession = useCallback(
    async (postId: string): Promise<boolean> => {
      if (!user?.id) {
        setError('You must be logged in to test chatbots');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        // Create session
        const createRes = await fetch('/api/exchange/sandbox', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id,
          },
          body: JSON.stringify({ post_id: postId }),
        });

        const createData = await createRes.json();

        if (!createRes.ok) {
          throw new Error(createData.error || 'Failed to create session');
        }

        // Fetch session details
        const sessionRes = await fetch(
          `/api/exchange/sandbox/${createData.session_id}`,
          {
            headers: {
              'x-user-id': user.id,
            },
          }
        );

        const sessionData = await sessionRes.json();

        if (!sessionRes.ok) {
          throw new Error(sessionData.error || 'Failed to fetch session');
        }

        setSession(sessionData.session);
        setPostInfo(sessionData.post);
        setMessages(sessionData.session.messages || []);

        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to start session');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  /**
   * Send a message in the current session
   */
  const sendMessage = useCallback(
    async (message: string): Promise<boolean> => {
      if (!session || !user?.id) {
        setError('No active session');
        return false;
      }

      if (rateLimitWait && rateLimitWait > 0) {
        setError(`Please wait ${rateLimitWait} seconds`);
        return false;
      }

      setSending(true);
      setError(null);

      // Optimistically add user message
      const userMessage: SandboxMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const res = await fetch(`/api/exchange/sandbox/${session.id}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id,
          },
          body: JSON.stringify({ message }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.rateLimited) {
            setRateLimitWait(data.waitSeconds || 30);
            // Remove optimistic message
            setMessages((prev) => prev.slice(0, -1));
            throw new Error(data.error);
          }
          // Remove optimistic message on error
          setMessages((prev) => prev.slice(0, -1));
          throw new Error(data.error || 'Failed to send message');
        }

        // Add assistant response
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }

        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to send message');
        return false;
      } finally {
        setSending(false);
      }
    },
    [session, user?.id, rateLimitWait]
  );

  /**
   * End the current session
   */
  const endSession = useCallback(async () => {
    if (!session || !user?.id) return;

    try {
      await fetch(`/api/exchange/sandbox/${session.id}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': user.id,
        },
      });
    } catch (err) {
      console.error('Failed to end session:', err);
    } finally {
      setSession(null);
      setPostInfo(null);
      setMessages([]);
      setRateLimitWait(null);
    }
  }, [session, user?.id]);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    session,
    postInfo,
    messages,
    loading,
    sending,
    error,
    rateLimitWait,
    startSession,
    sendMessage,
    endSession,
    clearError,
  };
}

export default useExchangeSandbox;
