/**
 * UploadWizard Component
 *
 * Multi-step wizard for creating Exchange posts.
 * Allows users to select their chatbot config, threads, and canvases.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { supabase } from '@/lib/supabaseClient';
import type { ExchangeCategory } from '../types';

interface UploadWizardProps {
  categories: ExchangeCategory[];
  /** Pre-selected thread ID from "Share to Exchange" button */
  preselectedThreadId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ThreadOption {
  id: string;
  title: string;
  chatbot_id: string | null;
  created_at: string;
}

interface CanvasOption {
  id: string;
  name: string;
  mode: string;
  created_at: string;
}

type Step = 'details' | 'content' | 'categories' | 'review';

export default function UploadWizard({
  categories,
  preselectedThreadId,
  onClose,
  onSuccess,
}: UploadWizardProps) {
  const { user } = useAuthSession();
  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(preselectedThreadId || null);
  const [selectedCanvasId, setSelectedCanvasId] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Available options
  const [threads, setThreads] = useState<ThreadOption[]>([]);
  const [canvases, setCanvases] = useState<CanvasOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Fetch user's threads and canvases
  useEffect(() => {
    console.log('[UploadWizard] Fetch effect triggered', { userId: user?.id, preselectedThreadId });
    if (!user?.id) {
      console.log('[UploadWizard] No user ID, skipping fetch');
      return;
    }

    const fetchOptions = async () => {
      setLoadingOptions(true);
      console.log('[UploadWizard] Starting fetch for user:', user.id);
      try {
        // Fetch threads
        const { data: threadsData, error: threadsError } = await supabase
          .from('threads')
          .select('id, title, chatbot_id, created_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        console.log('[UploadWizard] Threads fetch result:', { count: threadsData?.length, error: threadsError });

        let allThreads = threadsData || [];

        // If we have a preselected thread, ensure it's in the list
        if (preselectedThreadId) {
          const preselectedInList = allThreads.find((t) => t.id === preselectedThreadId);
          if (!preselectedInList) {
            // Fetch the preselected thread directly
            console.log('[UploadWizard] Preselected thread not in list, fetching directly:', preselectedThreadId);
            const { data: preselectedData, error: preselectedError } = await supabase
              .from('threads')
              .select('id, title, chatbot_id, created_at')
              .eq('id', preselectedThreadId)
              .eq('user_id', user.id)
              .single();

            if (preselectedData && !preselectedError) {
              // Add to the beginning of the list
              allThreads = [preselectedData, ...allThreads];
              console.log('[UploadWizard] Preselected thread fetched:', preselectedData.title);
            } else {
              console.error('[UploadWizard] Failed to fetch preselected thread:', preselectedError);
            }
          }
        }

        setThreads(allThreads);

        // Fetch canvases
        const { data: canvasesData } = await supabase
          .from('canvases')
          .select('id, name, mode, created_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        setCanvases(canvasesData || []);
      } catch (err) {
        console.error('Error fetching options:', err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [user?.id, preselectedThreadId]);

  // Pre-fill title from pre-selected thread when threads are loaded
  useEffect(() => {
    if (preselectedThreadId && threads.length > 0 && !title) {
      const preselectedThread = threads.find((t) => t.id === preselectedThreadId);
      if (preselectedThread?.title) {
        setTitle(preselectedThread.title);
        console.log('[UploadWizard] Pre-filled title from thread:', preselectedThread.title);
      }
    }
  }, [preselectedThreadId, threads, title]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 'details':
        return title.trim().length > 0;
      case 'content':
        return selectedThreadId !== null;
      case 'categories':
        return selectedCategoryIds.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    switch (step) {
      case 'details':
        // Skip content step if thread is pre-selected
        if (preselectedThreadId) {
          setStep('categories');
        } else {
          setStep('content');
        }
        break;
      case 'content':
        setStep('categories');
        break;
      case 'categories':
        setStep('review');
        break;
    }
  };

  const prevStep = () => {
    switch (step) {
      case 'content':
        setStep('details');
        break;
      case 'categories':
        // Skip content step if thread is pre-selected
        if (preselectedThreadId) {
          setStep('details');
        } else {
          setStep('content');
        }
        break;
      case 'review':
        setStep('categories');
        break;
    }
  };

  // ============================================================================
  // THREAD FILE SUBMISSION HELPERS (Segmented for debugging)
  // ============================================================================

  /**
   * Fetches thread data directly from the database
   * This ensures we get the thread even if it wasn't in the initial fetch
   */
  const fetchThreadData = async (threadId: string): Promise<ThreadOption | null> => {
    if (!user?.id) {
      console.error('[UploadWizard] Cannot fetch thread: no user ID');
      return null;
    }

    console.log('[UploadWizard] Fetching thread data for:', threadId, 'user:', user.id);

    const { data, error } = await supabase
      .from('threads')
      .select('id, title, chatbot_id, created_at')
      .eq('id', threadId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('[UploadWizard] Error fetching thread:', error);
      return null;
    }

    console.log('[UploadWizard] Thread data fetched:', data);
    return data;
  };

  /**
   * Builds the thread file object for the Exchange post
   */
  const buildThreadFile = (thread: ThreadOption, postTitle: string, postDescription: string) => {
    console.log('[UploadWizard] Building thread file from:', thread);

    return {
      version: '1.0.0',
      type: 'thread',
      metadata: {
        name: postTitle,
        description: postDescription || undefined,
        original_thread_id: thread.id,
        original_thread_title: thread.title,
        chatbot_id: thread.chatbot_id,
        created_at: thread.created_at,
        exported_at: new Date().toISOString(),
      },
    };
  };

  /**
   * Submits the post to the Exchange API
   */
  const submitToExchange = async (
    userId: string,
    postTitle: string,
    postDescription: string,
    threadFile: any,
    categoryIds: string[],
    tagNames: string[]
  ) => {
    console.log('[UploadWizard] Submitting to Exchange API:', {
      title: postTitle,
      categoryIds,
      tagNames,
    });

    const response = await fetch('/api/exchange/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({
        title: postTitle,
        description: postDescription || undefined,
        thread_file: threadFile,
        category_ids: categoryIds,
        tag_names: tagNames,
      }),
    });

    const data = await response.json();
    console.log('[UploadWizard] API response:', { ok: response.ok, data });

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create post');
    }

    return data;
  };

  /**
   * Main submit handler - orchestrates the thread file submission
   */
  const handleSubmit = async () => {
    console.log('[UploadWizard] handleSubmit called', {
      userId: user?.id,
      selectedThreadId,
      title,
      selectedCategoryIds,
    });

    if (!user?.id || !selectedThreadId) {
      console.error('[UploadWizard] Missing required data:', { userId: user?.id, selectedThreadId });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch thread data directly from database
      const threadData = await fetchThreadData(selectedThreadId);
      if (!threadData) {
        throw new Error('Thread not found. Please try again or select a different thread.');
      }

      // Step 2: Build the thread file
      const threadFile = buildThreadFile(threadData, title, description);

      // Step 3: Submit to Exchange
      await submitToExchange(
        user.id,
        title,
        description,
        threadFile,
        selectedCategoryIds,
        tags
      );

      console.log('[UploadWizard] Post created successfully');
      onSuccess();
    } catch (err: any) {
      console.error('[UploadWizard] Submit error:', err);
      setError(err.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  // Derived state for UI display
  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const selectedCanvas = canvases.find((c) => c.id === selectedCanvasId);

  // Note: Threads don't have system_prompt directly - it's on the chatbot
  // For now, we just show a general security reminder

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-lg border border-white/30 bg-white/80 backdrop-blur-md flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/30 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Post to Exchange</h2>
            <p className="text-sm text-foreground/60">Share your chatbot with the community</p>
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

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 border-b border-white/30 px-6 py-3">
          {(preselectedThreadId
            ? (['details', 'categories', 'review'] as Step[])
            : (['details', 'content', 'categories', 'review'] as Step[])
          ).map((s, i, arr) => (
            <React.Fragment key={s}>
              <div
                className={`flex items-center gap-2 ${
                  step === s ? 'text-sky' : 'text-foreground/50'
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    step === s
                      ? 'bg-sky text-white'
                      : 'bg-foreground/10 text-foreground/60'
                  }`}
                >
                  {i + 1}
                </div>
                <span className="text-sm capitalize hidden sm:inline">{s}</span>
              </div>
              {i < arr.length - 1 && <div className="h-px w-8 bg-foreground/20" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Details */}
          {step === 'details' && (
            <div className="space-y-4">
              {/* Show source thread when pre-selected */}
              {preselectedThreadId && (
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-2">
                    Source Thread
                  </label>
                  <div className="w-full rounded-lg border border-white/40 bg-foreground/5 px-4 py-2 text-foreground">
                    {loadingOptions ? (
                      <span className="text-foreground/50">Loading...</span>
                    ) : selectedThread ? (
                      <span>{selectedThread.title || 'Untitled Thread'}</span>
                    ) : (
                      <span className="text-red-500">Thread not found</span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/50 mt-1">
                    This thread's config will be shared
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Post Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Awesome Chatbot"
                  className="w-full rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
                />
                {preselectedThreadId && (
                  <p className="text-xs text-foreground/50 mt-1">
                    Pre-filled from thread name. You can change it.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what your chatbot does..."
                  rows={4}
                  className="w-full rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Content Selection */}
          {step === 'content' && (
            <div className="space-y-6">
              {/* Thread Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Select a Thread (Chatbot Config) <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-foreground/50 mb-3">
                  The thread's model and system prompt will be used as the chatbot configuration.
                </p>
                {loadingOptions ? (
                  <div className="text-center py-4 text-foreground/60">Loading...</div>
                ) : threads.length === 0 ? (
                  <div className="text-center py-4 text-foreground/60">
                    No threads found. Create a thread first.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {threads.map((thread) => (
                      <button
                        key={thread.id}
                        onClick={() => setSelectedThreadId(thread.id)}
                        className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                          selectedThreadId === thread.id
                            ? 'border-sky bg-sky/10'
                            : 'border-white/40 bg-white/60 hover:bg-white/80'
                        }`}
                      >
                        <div className="font-medium text-foreground">
                          {thread.title || 'Untitled Thread'}
                        </div>
                        <div className="text-xs text-foreground/60 mt-1">
                          Model: {thread.model || 'Default'} | Created:{' '}
                          {new Date(thread.created_at).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Canvas Selection (Optional) */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Include Canvas (Optional)
                </label>
                <p className="text-xs text-foreground/50 mb-3">
                  Optionally include a canvas workflow with your chatbot.
                </p>
                {canvases.length === 0 ? (
                  <div className="text-center py-4 text-foreground/50 text-sm">
                    No canvases found.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    <button
                      onClick={() => setSelectedCanvasId(null)}
                      className={`w-full text-left rounded-lg border px-4 py-2 transition-colors ${
                        selectedCanvasId === null
                          ? 'border-sky bg-sky/10'
                          : 'border-white/40 bg-white/60 hover:bg-white/80'
                      }`}
                    >
                      <span className="text-foreground/60">None</span>
                    </button>
                    {canvases.map((canvas) => (
                      <button
                        key={canvas.id}
                        onClick={() => setSelectedCanvasId(canvas.id)}
                        className={`w-full text-left rounded-lg border px-4 py-2 transition-colors ${
                          selectedCanvasId === canvas.id
                            ? 'border-sky bg-sky/10'
                            : 'border-white/40 bg-white/60 hover:bg-white/80'
                        }`}
                      >
                        <div className="font-medium text-foreground">{canvas.name}</div>
                        <div className="text-xs text-foreground/60">Mode: {canvas.mode}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Categories & Tags */}
          {step === 'categories' && (
            <div className="space-y-6">
              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Categories <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-foreground/50 mb-3">
                  Select at least one category for your post.
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => toggleCategory(category.id)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                        selectedCategoryIds.includes(category.id)
                          ? 'bg-sky text-white'
                          : 'bg-foreground/10 text-foreground/80 hover:bg-foreground/20'
                      }`}
                    >
                      {category.display_name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Tags (Optional)
                </label>
                <p className="text-xs text-foreground/50 mb-3">
                  Add up to 10 tags to help others find your post.
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Add a tag..."
                    className="flex-1 rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-sm text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none"
                  />
                  <button
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                    className="rounded-lg bg-foreground/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/20 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1 text-sm text-foreground/80"
                      >
                        #{tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="text-foreground/50 hover:text-foreground"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Review Your Post</h3>

              {/* Security Reminder */}
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-700">Security Reminder</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Your thread metadata will be shared publicly. Please ensure your post does not reference API keys, passwords, personal information, or other sensitive data.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/30 bg-foreground/5 p-4 space-y-3">
                <div>
                  <span className="text-sm text-foreground/60">Title:</span>
                  <p className="text-foreground font-medium">{title}</p>
                </div>

                {description && (
                  <div>
                    <span className="text-sm text-foreground/60">Description:</span>
                    <p className="text-foreground/80 text-sm">{description}</p>
                  </div>
                )}

                {/* Show which thread is being shared */}
                <div>
                  <span className="text-sm text-foreground/60">Source Thread:</span>
                  <p className="text-foreground/80 text-sm">
                    {selectedThread?.title || 'Untitled Thread'}
                  </p>
                </div>

                <div>
                  <span className="text-sm text-foreground/60">Categories:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedCategoryIds.map((id) => {
                      const cat = categories.find((c) => c.id === id);
                      return (
                        <span
                          key={id}
                          className="rounded-full bg-sky/20 px-2 py-0.5 text-xs text-sky"
                        >
                          {cat?.display_name}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {tags.length > 0 && (
                  <div>
                    <span className="text-sm text-foreground/60">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs text-foreground/80"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/50 px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/30 px-6 py-4">
          <button
            onClick={step === 'details' ? onClose : prevStep}
            className="rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/80 transition-colors"
          >
            {step === 'details' ? 'Cancel' : 'Back'}
          </button>

          {step === 'review' ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-lg bg-sky px-6 py-2 text-sm font-medium text-white hover:bg-sky/80 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Publishing...' : 'Publish to Exchange'}
            </button>
          ) : (
            <button
              onClick={nextStep}
              disabled={!canProceed()}
              className="rounded-lg bg-sky px-6 py-2 text-sm font-medium text-white hover:bg-sky/80 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
