/**
 * PostCard Component
 *
 * Displays a preview of an Exchange post in a card format.
 */

"use client";

import React from 'react';
import type { ExchangePostPreview } from '../types';

interface PostCardProps {
  post: ExchangePostPreview;
  onClick: () => void;
}

export default function PostCard({ post, onClick }: PostCardProps) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg border border-white/30 bg-white/60 backdrop-blur-md p-4 transition-all hover:border-sky/50 hover:bg-white/80"
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-sky line-clamp-1">
          {post.title}
        </h3>
        {post.author_name && (
          <p className="text-xs text-foreground/50 mt-0.5">
            by {post.author_name}
          </p>
        )}
      </div>

      {/* Description */}
      {post.description && (
        <p className="text-sm text-foreground/60 line-clamp-2 mb-3">
          {post.description}
        </p>
      )}

      {/* File badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {post.has_chatbot && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-500/20">
            <span>🤖</span>
            Chatbot
          </span>
        )}
        {post.has_canvas && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 ring-1 ring-inset ring-purple-500/20">
            <span>🎨</span>
            Canvas
          </span>
        )}
        {post.has_thread && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 ring-1 ring-inset ring-green-500/20">
            <span>💬</span>
            Thread
          </span>
        )}
      </div>

      {/* Categories */}
      {post.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.categories.slice(0, 3).map((category) => (
            <span
              key={category}
              className="rounded-md bg-foreground/10 px-2 py-0.5 text-xs text-foreground/80"
            >
              {category}
            </span>
          ))}
          {post.categories.length > 3 && (
            <span className="rounded-md bg-foreground/10 px-2 py-0.5 text-xs text-foreground/60">
              +{post.categories.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-xs text-foreground/50"
            >
              #{tag}
            </span>
          ))}
          {post.tags.length > 4 && (
            <span className="text-xs text-foreground/40">
              +{post.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-foreground/50 border-t border-white/30 pt-3 mt-auto">
        <div className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{post.download_count}</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>{post.test_count} tests</span>
        </div>
        <div className="flex-1 text-right">
          {new Date(post.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
