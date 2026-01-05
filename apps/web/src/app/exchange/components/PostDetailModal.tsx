/**
 * PostDetailModal Component
 *
 * Full post details modal with testing and download functionality.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useExchangePost } from '../hooks/useExchangePost';
import { useExchangeSandbox } from '../hooks/useExchangeSandbox';
import { useBotToBot } from '../hooks/useBotToBot';
import { useExchangeImport } from '../hooks/useExchangeImport';
import SandboxChat from './SandboxChat';
import BotToBotPanel from './BotToBotPanel';
import type { ExchangePostDetail } from '../types';

interface PostDetailModalProps {
  postId: string;
  onClose: () => void;
}

type Tab = 'details' | 'test' | 'query' | 'import';

export default function PostDetailModal({
  postId,
  onClose,
}: PostDetailModalProps) {
  const router = useRouter();
  const { user } = useAuthSession();
  const { post, loading: postLoading, error: postError } = useExchangePost(postId);
  const {
    session,
    messages,
    loading: sandboxLoading,
    sending,
    error: sandboxError,
    rateLimitWait,
    startSession,
    sendMessage,
    endSession,
    clearError,
  } = useExchangeSandbox();

  const {
    sending: botQuerySending,
    error: botQueryError,
    lastResult: botQueryResult,
    remainingQueries,
    sendQuery: sendBotQuery,
    clearError: clearBotQueryError,
    clearResult: clearBotQueryResult,
  } = useBotToBot();

  // Import functionality
  const {
    importThread,
    isImporting,
    error: importError,
    clearError: clearImportError,
    lastResult: importResult,
    clearResult: clearImportResult,
  } = useExchangeImport({
    userId: user?.id,
    onImportComplete: (result) => {
      console.log('[PostDetailModal] Import complete:', result);
    },
    onImportError: (error) => {
      console.error('[PostDetailModal] Import error:', error);
    },
  });

  const [activeTab, setActiveTab] = useState<Tab>('details');

  // Wrapper for sendBotQuery that includes the target post ID
  const handleBotQuery = useCallback(
    async (query: string, context?: string) => {
      return sendBotQuery(postId, query, context);
    },
    [postId, sendBotQuery]
  );

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Cleanup session on modal close
  useEffect(() => {
    return () => {
      if (session) {
        endSession();
      }
    };
  }, []);

  const handleStartTest = async () => {
    const success = await startSession(postId);
    if (success) {
      setActiveTab('test');
    }
  };

  /**
   * Handle importing a thread from this Exchange post
   */
  const handleImportThread = async () => {
    if (!user?.id) return;

    clearImportError();
    clearImportResult();

    const result = await importThread(postId);
    // Result handling is done via the hook's callbacks
  };

  /**
   * Navigate to the imported thread in the dashboard
   */
  const handleGoToThread = () => {
    if (importResult?.thread_id) {
      router.push(`/dashboard?thread=${importResult.thread_id}`);
      onClose();
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getProviderIcon = (provider?: string) => {
    switch (provider) {
      case 'openai':
        return '🤖';
      case 'claude':
        return '🟣';
      case 'grok':
        return '⚡';
      case 'gemini':
        return '🔷';
      default:
        return '🤖';
    }
  };

  if (postLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="rounded-lg border border-white/30 bg-white/80 backdrop-blur-md p-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
            <span className="text-foreground/80">Loading post...</span>
          </div>
        </div>
      </div>
    );
  }

  if (postError || !post) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="rounded-lg border border-white/30 bg-white/80 backdrop-blur-md p-8 max-w-md">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Failed to Load</h3>
            <p className="text-sm text-foreground/60 mb-4">{postError || 'Post not found'}</p>
            <button
              onClick={onClose}
              className="rounded-lg bg-foreground/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/20"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-lg border border-white/30 bg-white/80 backdrop-blur-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getProviderIcon(post.provider)}</span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{post.title}</h2>
              <p className="text-sm text-foreground/60">
                by {post.author?.name || 'Anonymous'} · {formatDate(post.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/30">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'border-b-2 border-sky text-sky'
                : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'test'
                ? 'border-b-2 border-sky text-sky'
                : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            Test
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'query'
                ? 'border-b-2 border-sky text-sky'
                : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            Query
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'border-b-2 border-sky text-sky'
                : 'text-foreground/60 hover:text-foreground'
            }`}
          >
            Import
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="h-full overflow-y-auto p-6 space-y-6">
              {/* Description */}
              {post.description && (
                <div>
                  <h3 className="text-sm font-medium text-foreground/80 mb-2">Description</h3>
                  <p className="text-sm text-foreground/60 whitespace-pre-wrap">{post.description}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-foreground/5 p-4">
                  <div className="text-2xl font-bold text-foreground">{post.download_count}</div>
                  <div className="text-xs text-foreground/60">Downloads</div>
                </div>
                <div className="rounded-lg bg-foreground/5 p-4">
                  <div className="text-2xl font-bold text-foreground">{post.test_count}</div>
                  <div className="text-xs text-foreground/60">Tests</div>
                </div>
                <div className="rounded-lg bg-foreground/5 p-4">
                  <div className="text-lg font-semibold text-foreground capitalize">{post.provider || 'Unknown'}</div>
                  <div className="text-xs text-foreground/60">Provider</div>
                </div>
                <div className="rounded-lg bg-foreground/5 p-4">
                  <div className="text-lg font-semibold text-foreground truncate">{post.model_name || 'Unknown'}</div>
                  <div className="text-xs text-foreground/60">Model</div>
                </div>
              </div>

              {/* Categories & Tags */}
              <div className="flex flex-wrap gap-2">
                {post.categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="rounded-full bg-sky/20 px-3 py-1 text-xs font-medium text-sky"
                  >
                    {cat.display_name}
                  </span>
                ))}
                {post.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground/80"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>

              {/* Files Included */}
              <div>
                <h3 className="text-sm font-medium text-foreground/80 mb-2">Included Files</h3>
                <div className="flex gap-3">
                  {post.chatbot_file && (
                    <div className="flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2">
                      <span className="text-lg">🤖</span>
                      <span className="text-sm text-foreground/80">.chatbot</span>
                    </div>
                  )}
                  {post.canvas_file && (
                    <div className="flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2">
                      <span className="text-lg">🎨</span>
                      <span className="text-sm text-foreground/80">.canvas</span>
                    </div>
                  )}
                  {post.thread_file && (
                    <div className="flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2">
                      <span className="text-lg">💬</span>
                      <span className="text-sm text-foreground/80">.thread</span>
                    </div>
                  )}
                </div>
              </div>

              {/* OAuth Requirements */}
              {post.has_oauth_requirements && post.oauth_requirements && (
                <div>
                  <h3 className="text-sm font-medium text-foreground/80 mb-2">OAuth Requirements</h3>
                  <p className="text-xs text-foreground/50 mb-2">
                    This chatbot requires OAuth connections for full functionality.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.oauth_requirements.gmail && (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-600">
                        Gmail
                      </span>
                    )}
                    {post.oauth_requirements.calendar && (
                      <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-600">
                        Calendar
                      </span>
                    )}
                    {post.oauth_requirements.sheets && (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-600">
                        Sheets
                      </span>
                    )}
                    {post.oauth_requirements.docs && (
                      <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-600">
                        Docs
                      </span>
                    )}
                    {post.oauth_requirements.slack && (
                      <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-600">
                        Slack
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleStartTest}
                  disabled={sandboxLoading || !post.chatbot_file}
                  className="flex-1 rounded-lg bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sandboxLoading ? 'Starting...' : 'Test Chatbot'}
                </button>
                <button
                  onClick={() => setActiveTab('import')}
                  disabled={!post.thread_file}
                  className="flex-1 rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/80 disabled:opacity-50 transition-colors"
                >
                  Import to My Threads
                </button>
              </div>
            </div>
          )}

          {/* Test Tab */}
          {activeTab === 'test' && (
            <div className="h-full flex flex-col">
              {!session ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="rounded-full bg-foreground/10 p-6 mb-4">
                    <svg className="h-12 w-12 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Test in Sandbox</h3>
                  <p className="text-sm text-foreground/60 text-center max-w-sm mb-6">
                    Test this chatbot using your own API keys. Messages are not saved to your account.
                  </p>
                  {!post.chatbot_file ? (
                    <p className="text-sm text-amber-600">This post does not contain a chatbot to test.</p>
                  ) : !user ? (
                    <p className="text-sm text-amber-600">Please log in to test chatbots.</p>
                  ) : (
                    <button
                      onClick={handleStartTest}
                      disabled={sandboxLoading}
                      className="rounded-lg bg-sky px-6 py-2 text-sm font-medium text-white hover:bg-sky/80 disabled:opacity-50 transition-colors"
                    >
                      {sandboxLoading ? 'Starting Session...' : 'Start Test Session'}
                    </button>
                  )}
                </div>
              ) : (
                <SandboxChat
                  messages={messages}
                  sending={sending}
                  error={sandboxError}
                  rateLimitWait={rateLimitWait}
                  onSendMessage={sendMessage}
                  onClearError={clearError}
                  chatbotName={post.title}
                  provider={post.provider}
                />
              )}
            </div>
          )}

          {/* Query Tab (Bot-to-Bot) */}
          {activeTab === 'query' && (
            <div className="h-full flex flex-col">
              {!post.chatbot_file ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <p className="text-sm text-amber-400">This post does not contain a chatbot to query.</p>
                </div>
              ) : !user ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <p className="text-sm text-amber-400">Please log in to use bot-to-bot queries.</p>
                </div>
              ) : (
                <BotToBotPanel
                  targetPostId={postId}
                  targetTitle={post.title}
                  targetProvider={post.provider}
                  onSendQuery={handleBotQuery}
                  sending={botQuerySending}
                  error={botQueryError}
                  lastResult={botQueryResult}
                  remainingQueries={remainingQueries}
                  onClearError={clearBotQueryError}
                  onClearResult={clearBotQueryResult}
                />
              )}
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Success State */}
                {importResult?.success && (
                  <div className="rounded-lg bg-green-500/10 border border-green-500/50 p-6 text-center">
                    <div className="mx-auto h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                      <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-green-700 mb-2">Import Successful!</h3>
                    <p className="text-sm text-green-600 mb-4">
                      "{importResult.title}" has been added to your threads
                      {importResult.message_count && importResult.message_count > 0
                        ? ` with ${importResult.message_count} messages`
                        : ''}.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleGoToThread}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                      >
                        Open Thread
                      </button>
                      <button
                        onClick={() => {
                          clearImportResult();
                        }}
                        className="rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/80 transition-colors"
                      >
                        Import Another
                      </button>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {importError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/50 p-4">
                    <div className="flex items-start gap-3">
                      <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-700">Import Failed</p>
                        <p className="text-xs text-red-600 mt-1">{importError}</p>
                      </div>
                      <button
                        onClick={clearImportError}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Import Options (only show if no success result) */}
                {!importResult?.success && (
                  <>
                    {/* Thread Import */}
                    {post.thread_file ? (
                      <div>
                        <h3 className="text-sm font-medium text-foreground/80 mb-3">Import Thread</h3>
                        <div className="rounded-lg border-2 border-sky/50 bg-sky/5 p-6">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="h-12 w-12 rounded-lg bg-sky/20 flex items-center justify-center">
                              <span className="text-2xl">💬</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">{post.title}</div>
                              <div className="text-xs text-foreground/60">
                                Import this thread directly to your dashboard
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-foreground/50 mb-4">
                            This will create a new thread in your account with the content from this Exchange post.
                            The thread will appear in your sidebar under "Threads".
                          </p>
                          <button
                            onClick={handleImportThread}
                            disabled={isImporting || !user}
                            className="w-full rounded-lg bg-sky px-4 py-3 text-sm font-medium text-white hover:bg-sky/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                          >
                            {isImporting ? (
                              <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Importing...
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Import to My Threads
                              </>
                            )}
                          </button>
                          {!user && (
                            <p className="text-xs text-amber-600 mt-2 text-center">
                              Please log in to import threads
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="mx-auto h-12 w-12 rounded-full bg-foreground/10 flex items-center justify-center mb-4">
                          <svg className="h-6 w-6 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-foreground mb-2">No Thread Available</h3>
                        <p className="text-sm text-foreground/60">
                          This post does not contain a thread file to import.
                        </p>
                      </div>
                    )}

                    {/* Future: Chatbot/Canvas import options could go here */}
                    {(post.chatbot_file || post.canvas_file) && (
                      <div className="border-t border-white/30 pt-4">
                        <h3 className="text-sm font-medium text-foreground/80 mb-3">Other Files</h3>
                        <p className="text-xs text-foreground/50 mb-3">
                          This post also contains the following files. Direct import for these file types is coming soon.
                        </p>
                        <div className="flex gap-2">
                          {post.chatbot_file && (
                            <div className="flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2">
                              <span className="text-lg">🤖</span>
                              <span className="text-xs text-foreground/60">.chatbot</span>
                            </div>
                          )}
                          {post.canvas_file && (
                            <div className="flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2">
                              <span className="text-lg">🎨</span>
                              <span className="text-xs text-foreground/60">.canvas</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
