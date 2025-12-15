/**
 * useExchangePost Hook
 *
 * Fetches a single Exchange post by ID with full details.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { ExchangePostDetail } from '../types';

interface UseExchangePostResult {
  post: ExchangePostDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useExchangePost(postId: string | null): UseExchangePostResult {
  const { user } = useAuthSession();
  const [post, setPost] = useState<ExchangePostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) {
      setPost(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (user?.id) {
        headers['x-user-id'] = user.id;
      }

      const res = await fetch(`/api/exchange/posts/${postId}`, { headers });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch post');
      }

      setPost(data.post);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch post');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId, user?.id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  return {
    post,
    loading,
    error,
    refetch: fetchPost,
  };
}

export default useExchangePost;
