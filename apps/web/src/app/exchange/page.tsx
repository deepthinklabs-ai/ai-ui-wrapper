/**
 * Exchange Page
 *
 * Main marketplace page where users can browse, test, and download chatbots.
 */

"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useExchangeCategories } from './hooks/useExchangeCategories';
import { useExchangePosts } from './hooks/useExchangePosts';
import ExchangeFilters from './components/ExchangeFilters';
import ExchangeGrid from './components/ExchangeGrid';
import PostDetailModal from './components/PostDetailModal';
import UploadWizard from './components/UploadWizard';

/**
 * Inner component that uses useSearchParams (requires Suspense boundary)
 */
function ExchangePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [preselectedThreadId, setPreselectedThreadId] = useState<string | null>(null);

  // Check for share query parameters (e.g., from "Share to Exchange" button)
  useEffect(() => {
    const shareType = searchParams.get('share');
    const threadId = searchParams.get('threadId');

    if (shareType === 'thread' && threadId) {
      setPreselectedThreadId(threadId);
      setShowUploadWizard(true);
      // Clean up the URL without triggering a navigation
      window.history.replaceState({}, '', '/exchange');
    }
  }, [searchParams]);

  // Fetch categories
  const {
    categories,
    loading: categoriesLoading,
  } = useExchangeCategories();

  // Fetch posts
  const {
    posts,
    total,
    loading: postsLoading,
    error: postsError,
    filter,
    setFilter,
    loadMore,
    hasMore,
  } = useExchangePosts();

  const handlePostClick = (postId: string) => {
    setSelectedPostId(postId);
    // For now, just log the click - modal will be implemented later
    console.log('[Exchange] Post clicked:', postId);
    // TODO: Open PostDetailModal
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/30 bg-white/40 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 rounded-lg border border-white/40 bg-white/60 px-3 py-2 text-sm font-medium text-foreground hover:bg-white/80 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Dashboard
              </button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Exchange</h1>
                <p className="text-sm text-foreground/60">
                  Discover and share chatbots, canvases, and conversations
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUploadWizard(true)}
              className="rounded-lg bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky/80 transition-colors"
            >
              Post to Exchange
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          {/* Sidebar - Filters */}
          <aside className="lg:col-span-1 mb-6 lg:mb-0">
            <div className="rounded-lg border border-white/30 bg-white/60 backdrop-blur-md p-4 sticky top-24">
              <ExchangeFilters
                categories={categories}
                filter={filter}
                onFilterChange={setFilter}
                loading={categoriesLoading || postsLoading}
              />
            </div>
          </aside>

          {/* Main Content - Posts Grid */}
          <div className="lg:col-span-3">
            {/* Results count */}
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-foreground/60">
                {postsLoading && posts.length === 0
                  ? 'Loading...'
                  : `${total} post${total === 1 ? '' : 's'} found`}
              </p>
            </div>

            {/* Posts Grid */}
            <ExchangeGrid
              posts={posts}
              loading={postsLoading}
              error={postsError}
              onPostClick={handlePostClick}
              onLoadMore={loadMore}
              hasMore={hasMore}
            />
          </div>
        </div>
      </main>

      {/* Post Detail Modal */}
      {selectedPostId && (
        <PostDetailModal
          postId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
        />
      )}

      {/* Upload Wizard */}
      {showUploadWizard && (
        <UploadWizard
          categories={categories}
          preselectedThreadId={preselectedThreadId}
          onClose={() => {
            setShowUploadWizard(false);
            setPreselectedThreadId(null);
          }}
          onSuccess={() => {
            setShowUploadWizard(false);
            setPreselectedThreadId(null);
            // Refresh posts after successful upload
            setFilter({ ...filter });
          }}
        />
      )}
    </div>
  );
}

/**
 * Exchange Page wrapper with Suspense boundary for useSearchParams
 */
export default function ExchangePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground/60">Loading...</div>
      </div>
    }>
      <ExchangePageContent />
    </Suspense>
  );
}
