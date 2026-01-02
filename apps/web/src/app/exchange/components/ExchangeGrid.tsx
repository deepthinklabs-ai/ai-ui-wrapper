/**
 * ExchangeGrid Component
 *
 * Displays a grid of Exchange posts with loading and empty states.
 */

"use client";

import React from 'react';
import type { ExchangePostPreview } from '../types';
import PostCard from './PostCard';

interface ExchangeGridProps {
  posts: ExchangePostPreview[];
  loading: boolean;
  error: string | null;
  onPostClick: (postId: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function ExchangeGrid({
  posts,
  loading,
  error,
  onPostClick,
  onLoadMore,
  hasMore = false,
}: ExchangeGridProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-red-300">Error loading posts</h3>
          <p className="mt-2 text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <svg
            className="mx-auto h-16 w-16 text-foreground/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-foreground/80">No posts found</h3>
          <p className="mt-2 text-sm text-foreground/50">
            Try adjusting your filters or be the first to post!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Posts Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onClick={() => onPostClick(post.id)}
          />
        ))}

        {/* Loading skeletons */}
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="animate-pulse rounded-lg border border-white/30 bg-white/60 backdrop-blur-md p-4"
            >
              <div className="mb-3 h-5 w-3/4 rounded bg-foreground/10" />
              <div className="mb-3 space-y-2">
                <div className="h-3 w-full rounded bg-foreground/10" />
                <div className="h-3 w-2/3 rounded bg-foreground/10" />
              </div>
              <div className="mb-3 flex gap-2">
                <div className="h-5 w-16 rounded-full bg-foreground/10" />
                <div className="h-5 w-16 rounded-full bg-foreground/10" />
              </div>
              <div className="h-8 rounded bg-foreground/10" />
            </div>
          ))}
      </div>

      {/* Load More Button */}
      {hasMore && !loading && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={onLoadMore}
            className="rounded-lg border border-white/40 bg-white/60 px-6 py-2 text-sm font-medium text-foreground hover:bg-white/80 transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {/* Loading indicator for load more */}
      {loading && posts.length > 0 && (
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-2 text-foreground/60">
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
            <span>Loading more...</span>
          </div>
        </div>
      )}
    </div>
  );
}
