/**
 * PostDetailModal Component
 *
 * Full post details modal with testing and download functionality.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useExchangePost } from '../hooks/useExchangePost';
import { useExchangeSandbox } from '../hooks/useExchangeSandbox';
import { useBotToBot } from '../hooks/useBotToBot';
import SandboxChat from './SandboxChat';
import BotToBotPanel from './BotToBotPanel';
import type { ExchangePostDetail } from '../types';

interface PostDetailModalProps {
  postId: string;
  onClose: () => void;
}

type Tab = 'details' | 'test' | 'query' | 'download';

export default function PostDetailModal({
  postId,
  onClose,
}: PostDetailModalProps) {
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

  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);

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

  const handleDownload = async (fileType: 'chatbot' | 'canvas' | 'thread' | 'bundle') => {
    if (!user?.id) return;

    setDownloadLoading(fileType);

    try {
      const res = await fetch(
        `/api/exchange/posts/${postId}/download?type=${fileType}`,
        {
          headers: {
            'x-user-id': user.id,
          },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `download.${fileType}`;

      // Download file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download error:', err);
      alert(err.message || 'Download failed');
    } finally {
      setDownloadLoading(null);
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <span className="text-slate-300">Loading post...</span>
          </div>
        </div>
      </div>
    );
  }

  if (postError || !post) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 max-w-md">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-100 mb-2">Failed to Load</h3>
            <p className="text-sm text-slate-400 mb-4">{postError || 'Post not found'}</p>
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-lg border border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getProviderIcon(post.provider)}</span>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{post.title}</h2>
              <p className="text-sm text-slate-400">
                by {post.author?.name || 'Anonymous'} · {formatDate(post.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'details'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'test'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Test
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'query'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Query
          </button>
          <button
            onClick={() => setActiveTab('download')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'download'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Download
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
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Description</h3>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap">{post.description}</p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-slate-700/50 p-4">
                  <div className="text-2xl font-bold text-slate-100">{post.download_count}</div>
                  <div className="text-xs text-slate-400">Downloads</div>
                </div>
                <div className="rounded-lg bg-slate-700/50 p-4">
                  <div className="text-2xl font-bold text-slate-100">{post.test_count}</div>
                  <div className="text-xs text-slate-400">Tests</div>
                </div>
                <div className="rounded-lg bg-slate-700/50 p-4">
                  <div className="text-lg font-semibold text-slate-100 capitalize">{post.provider || 'Unknown'}</div>
                  <div className="text-xs text-slate-400">Provider</div>
                </div>
                <div className="rounded-lg bg-slate-700/50 p-4">
                  <div className="text-lg font-semibold text-slate-100 truncate">{post.model_name || 'Unknown'}</div>
                  <div className="text-xs text-slate-400">Model</div>
                </div>
              </div>

              {/* Categories & Tags */}
              <div className="flex flex-wrap gap-2">
                {post.categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300"
                  >
                    {cat.display_name}
                  </span>
                ))}
                {post.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-slate-600 px-3 py-1 text-xs font-medium text-slate-300"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>

              {/* Files Included */}
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2">Included Files</h3>
                <div className="flex gap-3">
                  {post.chatbot_file && (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2">
                      <span className="text-lg">🤖</span>
                      <span className="text-sm text-slate-300">.chatbot</span>
                    </div>
                  )}
                  {post.canvas_file && (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2">
                      <span className="text-lg">🎨</span>
                      <span className="text-sm text-slate-300">.canvas</span>
                    </div>
                  )}
                  {post.thread_file && (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2">
                      <span className="text-lg">💬</span>
                      <span className="text-sm text-slate-300">.thread</span>
                    </div>
                  )}
                </div>
              </div>

              {/* OAuth Requirements */}
              {post.has_oauth_requirements && post.oauth_requirements && (
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-2">OAuth Requirements</h3>
                  <p className="text-xs text-slate-500 mb-2">
                    This chatbot requires OAuth connections for full functionality.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.oauth_requirements.gmail && (
                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300">
                        Gmail
                      </span>
                    )}
                    {post.oauth_requirements.calendar && (
                      <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300">
                        Calendar
                      </span>
                    )}
                    {post.oauth_requirements.sheets && (
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300">
                        Sheets
                      </span>
                    )}
                    {post.oauth_requirements.docs && (
                      <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-medium text-yellow-300">
                        Docs
                      </span>
                    )}
                    {post.oauth_requirements.slack && (
                      <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300">
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
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sandboxLoading ? 'Starting...' : 'Test Chatbot'}
                </button>
                <button
                  onClick={() => setActiveTab('download')}
                  className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
                >
                  Download Files
                </button>
              </div>
            </div>
          )}

          {/* Test Tab */}
          {activeTab === 'test' && (
            <div className="h-full flex flex-col">
              {!session ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="rounded-full bg-slate-700/50 p-6 mb-4">
                    <svg className="h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-100 mb-2">Test in Sandbox</h3>
                  <p className="text-sm text-slate-400 text-center max-w-sm mb-6">
                    Test this chatbot using your own API keys. Messages are not saved to your account.
                  </p>
                  {!post.chatbot_file ? (
                    <p className="text-sm text-amber-400">This post does not contain a chatbot to test.</p>
                  ) : !user ? (
                    <p className="text-sm text-amber-400">Please log in to test chatbots.</p>
                  ) : (
                    <button
                      onClick={handleStartTest}
                      disabled={sandboxLoading}
                      className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
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

          {/* Download Tab */}
          {activeTab === 'download' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Individual Files */}
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Individual Files</h3>
                  <div className="space-y-2">
                    {post.chatbot_file && (
                      <button
                        onClick={() => handleDownload('chatbot')}
                        disabled={downloadLoading === 'chatbot'}
                        className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🤖</span>
                          <div className="text-left">
                            <div className="text-sm font-medium text-slate-100">{post.title}.chatbot</div>
                            <div className="text-xs text-slate-400">Chatbot configuration</div>
                          </div>
                        </div>
                        {downloadLoading === 'chatbot' ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                        ) : (
                          <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                      </button>
                    )}

                    {post.canvas_file && (
                      <button
                        onClick={() => handleDownload('canvas')}
                        disabled={downloadLoading === 'canvas'}
                        className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🎨</span>
                          <div className="text-left">
                            <div className="text-sm font-medium text-slate-100">{post.title}.canvas</div>
                            <div className="text-xs text-slate-400">Canvas workflow</div>
                          </div>
                        </div>
                        {downloadLoading === 'canvas' ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                        ) : (
                          <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                      </button>
                    )}

                    {post.thread_file && (
                      <button
                        onClick={() => handleDownload('thread')}
                        disabled={downloadLoading === 'thread'}
                        className="w-full flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">💬</span>
                          <div className="text-left">
                            <div className="text-sm font-medium text-slate-100">{post.title}.thread</div>
                            <div className="text-xs text-slate-400">Conversation thread</div>
                          </div>
                        </div>
                        {downloadLoading === 'thread' ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                        ) : (
                          <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bundle Download */}
                {(post.chatbot_file || post.canvas_file || post.thread_file) && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Bundle</h3>
                    <button
                      onClick={() => handleDownload('bundle')}
                      disabled={downloadLoading === 'bundle'}
                      className="w-full flex items-center justify-between rounded-lg border-2 border-purple-500/50 bg-purple-500/10 px-4 py-4 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📦</span>
                        <div className="text-left">
                          <div className="text-sm font-medium text-slate-100">{post.title}.aiuiw</div>
                          <div className="text-xs text-slate-400">All files bundled together</div>
                        </div>
                      </div>
                      {downloadLoading === 'bundle' ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                      ) : (
                        <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
