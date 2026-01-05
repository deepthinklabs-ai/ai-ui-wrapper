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
  model: string | null;
  system_prompt: string | null;
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
    if (!user?.id) return;

    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        // Fetch threads
        const { data: threadsData } = await supabase
          .from('threads')
          .select('id, title, model, system_prompt, created_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        setThreads(threadsData || []);

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
  }, [user?.id]);

  // Pre-fill title from pre-selected thread when threads are loaded
  useEffect(() => {
    if (preselectedThreadId && threads.length > 0 && !title) {
      const preselectedThread = threads.find((t) => t.id === preselectedThreadId);
      if (preselectedThread?.title) {
        setTitle(preselectedThread.title);
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

  const handleSubmit = async () => {
    if (!user?.id || !selectedThreadId) return;

    setLoading(true);
    setError(null);

    try {
      // Get the selected thread's details
      const selectedThread = threads.find((t) => t.id === selectedThreadId);
      if (!selectedThread) {
        throw new Error('Selected thread not found');
      }

      // Build chatbot file from thread settings
      const chatbotFile = {
        version: '1.0.0',
        type: 'chatbot',
        metadata: {
          name: title,
          description: description || undefined,
          created_at: new Date().toISOString(),
          exported_at: new Date().toISOString(),
        },
        config: {
          model: {
            provider: getProviderFromModel(selectedThread.model || 'gpt-4o'),
            model_name: selectedThread.model || 'gpt-4o',
          },
          system_prompt: selectedThread.system_prompt || 'You are a helpful assistant.',
        },
      };

      // Get canvas data if selected
      let canvasFile = null;
      if (selectedCanvasId) {
        const { data: canvasData } = await supabase
          .from('canvases')
          .select('*')
          .eq('id', selectedCanvasId)
          .single();

        if (canvasData) {
          // Get canvas nodes and edges
          const { data: nodesData } = await supabase
            .from('canvas_nodes')
            .select('*')
            .eq('canvas_id', selectedCanvasId);

          const { data: edgesData } = await supabase
            .from('canvas_edges')
            .select('*')
            .eq('canvas_id', selectedCanvasId);

          canvasFile = {
            version: '1.0.0',
            type: 'canvas',
            metadata: {
              name: canvasData.name,
              description: canvasData.description,
              mode: canvasData.mode,
              created_at: canvasData.created_at,
              exported_at: new Date().toISOString(),
              node_count: nodesData?.length || 0,
              edge_count: edgesData?.length || 0,
            },
            nodes: (nodesData || []).map((node: any) => ({
              type: node.type,
              position: node.position,
              label: node.label,
              config: sanitizeConfig(node.config || {}),
              original_id: node.id,
            })),
            edges: (edgesData || []).map((edge: any) => ({
              from_node_ref: edge.source_node_id,
              to_node_ref: edge.target_node_id,
              label: edge.label,
              animated: edge.animated,
            })),
          };
        }
      }

      // Create the post via API
      const response = await fetch('/api/exchange/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          title,
          description: description || undefined,
          chatbot_file: chatbotFile,
          canvas_file: canvasFile,
          category_ids: selectedCategoryIds,
          tag_names: tags,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create post');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const getProviderFromModel = (model: string): string => {
    if (model.includes('gpt') || model.includes('o1') || model.includes('o3')) return 'openai';
    if (model.includes('claude')) return 'claude';
    if (model.includes('grok')) return 'grok';
    if (model.includes('gemini')) return 'gemini';
    return 'openai';
  };

  const sanitizeConfig = (config: Record<string, any>): Record<string, any> => {
    const sensitiveFields = [
      'access_token', 'refresh_token', 'oauth_tokens', 'credentials',
      'api_key', 'secret', 'password', 'token',
    ];

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(config)) {
      if (sensitiveFields.some((f) => key.toLowerCase().includes(f))) {
        continue;
      }
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeConfig(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const selectedCanvas = canvases.find((c) => c.id === selectedCanvasId);

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
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Awesome Chatbot"
                  className="w-full rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
                />
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

                <div>
                  <span className="text-sm text-foreground/60">Chatbot Config:</span>
                  <p className="text-foreground/80 text-sm">
                    {selectedThread?.title || 'Untitled Thread'} ({selectedThread?.model || 'Default model'})
                  </p>
                </div>

                {selectedCanvas && (
                  <div>
                    <span className="text-sm text-foreground/60">Canvas:</span>
                    <p className="text-foreground/80 text-sm">{selectedCanvas.name}</p>
                  </div>
                )}

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
