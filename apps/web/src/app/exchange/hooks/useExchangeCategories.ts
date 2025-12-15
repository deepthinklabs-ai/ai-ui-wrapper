/**
 * useExchangeCategories Hook
 *
 * Fetches and manages Exchange categories.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ExchangeCategory } from '../types';

export interface UseExchangeCategoriesResult {
  categories: ExchangeCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useExchangeCategories(): UseExchangeCategoriesResult {
  const [categories, setCategories] = useState<ExchangeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/exchange/categories');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch categories');
      }

      setCategories(data.categories || []);
    } catch (err: any) {
      console.error('[useExchangeCategories] Error:', err);
      setError(err.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    refresh: fetchCategories,
  };
}
