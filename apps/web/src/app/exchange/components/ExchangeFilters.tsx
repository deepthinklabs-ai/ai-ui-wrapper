/**
 * ExchangeFilters Component
 *
 * Filter controls for searching and filtering Exchange posts.
 */

"use client";

import React, { useState, useEffect } from 'react';
import type { ExchangeCategory, ListExchangePostsFilter } from '../types';

interface ExchangeFiltersProps {
  categories: ExchangeCategory[];
  filter: ListExchangePostsFilter;
  onFilterChange: (filter: Partial<ListExchangePostsFilter>) => void;
  loading?: boolean;
}

export default function ExchangeFilters({
  categories,
  filter,
  onFilterChange,
  loading = false,
}: ExchangeFiltersProps) {
  const [searchInput, setSearchInput] = useState(filter.search || '');

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== filter.search) {
        onFilterChange({ search: searchInput || undefined });
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryToggle = (categoryId: string) => {
    const currentIds = filter.category_ids || [];
    const newIds = currentIds.includes(categoryId)
      ? currentIds.filter((id) => id !== categoryId)
      : [...currentIds, categoryId];

    onFilterChange({ category_ids: newIds.length > 0 ? newIds : undefined });
  };

  const handleSortChange = (sortBy: ListExchangePostsFilter['sort_by']) => {
    onFilterChange({ sort_by: sortBy });
  };

  const handleClearFilters = () => {
    setSearchInput('');
    onFilterChange({
      search: undefined,
      category_ids: undefined,
      tag_names: undefined,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
  };

  const hasActiveFilters =
    filter.search ||
    (filter.category_ids && filter.category_ids.length > 0) ||
    (filter.tag_names && filter.tag_names.length > 0);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search posts..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Sort and Clear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Sort by:</span>
          <select
            value={filter.sort_by || 'created_at'}
            onChange={(e) => handleSortChange(e.target.value as ListExchangePostsFilter['sort_by'])}
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
          >
            <option value="created_at">Newest</option>
            <option value="download_count">Most Downloaded</option>
            <option value="test_count">Most Tested</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Categories */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Categories
        </h4>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const isSelected = filter.category_ids?.includes(category.id);
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryToggle(category.id)}
                disabled={loading}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                } disabled:opacity-50`}
              >
                {category.display_name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
