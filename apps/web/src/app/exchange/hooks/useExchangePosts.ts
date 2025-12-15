/**
 * useExchangePosts Hook
 *
 * Fetches and manages Exchange posts with filtering and pagination.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ExchangePostPreview, ListExchangePostsFilter } from '../types';

export interface UseExchangePostsResult {
  posts: ExchangePostPreview[];
  total: number;
  loading: boolean;
  error: string | null;
  filter: ListExchangePostsFilter;
  setFilter: (filter: Partial<ListExchangePostsFilter>) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

const DEFAULT_FILTER: ListExchangePostsFilter = {
  sort_by: 'created_at',
  sort_order: 'desc',
  limit: 20,
  offset: 0,
};

export function useExchangePosts(
  initialFilter: Partial<ListExchangePostsFilter> = {}
): UseExchangePostsResult {
  const [posts, setPosts] = useState<ExchangePostPreview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<ListExchangePostsFilter>({
    ...DEFAULT_FILTER,
    ...initialFilter,
  });

  const buildQueryString = useCallback((f: ListExchangePostsFilter) => {
    const params = new URLSearchParams();

    if (f.category_ids?.length) {
      params.set('category_ids', f.category_ids.join(','));
    }
    if (f.tag_names?.length) {
      params.set('tag_names', f.tag_names.join(','));
    }
    if (f.search) {
      params.set('search', f.search);
    }
    if (f.user_id) {
      params.set('user_id', f.user_id);
    }
    if (f.sort_by) {
      params.set('sort_by', f.sort_by);
    }
    if (f.sort_order) {
      params.set('sort_order', f.sort_order);
    }
    if (f.limit) {
      params.set('limit', f.limit.toString());
    }
    if (f.offset !== undefined) {
      params.set('offset', f.offset.toString());
    }

    return params.toString();
  }, []);

  const fetchPosts = useCallback(async (append = false) => {
    try {
      setLoading(true);
      setError(null);

      const queryString = buildQueryString(filter);
      const response = await fetch(`/api/exchange/posts?${queryString}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch posts');
      }

      if (append) {
        setPosts((prev) => [...prev, ...(data.posts || [])]);
      } else {
        setPosts(data.posts || []);
      }
      setTotal(data.total || 0);
    } catch (err: any) {
      console.error('[useExchangePosts] Error:', err);
      setError(err.message || 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  }, [filter, buildQueryString]);

  const setFilter = useCallback((newFilter: Partial<ListExchangePostsFilter>) => {
    setFilterState((prev) => ({
      ...prev,
      ...newFilter,
      // Reset offset when filter changes (except when explicitly setting offset)
      offset: 'offset' in newFilter ? newFilter.offset : 0,
    }));
  }, []);

  const loadMore = useCallback(async () => {
    const newOffset = (filter.offset || 0) + (filter.limit || 20);
    setFilterState((prev) => ({ ...prev, offset: newOffset }));
    // The effect will trigger fetchPosts with append=true
  }, [filter.offset, filter.limit]);

  // Fetch posts when filter changes
  useEffect(() => {
    const append = (filter.offset || 0) > 0;
    fetchPosts(append);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore = posts.length < total;

  return {
    posts,
    total,
    loading,
    error,
    filter,
    setFilter,
    refresh: () => fetchPosts(false),
    loadMore,
    hasMore,
  };
}
