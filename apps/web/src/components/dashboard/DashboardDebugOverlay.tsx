'use client';

/**
 * Dashboard Debug Overlay
 *
 * Admin-only overlay that shows:
 * - Current thread ID and details
 * - Current chatbot ID and details
 * - Message IDs with copy buttons
 * - Folder structure with IDs
 * - User ID
 *
 * Toggle with Ctrl+Shift+D
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { Thread, Message, FolderWithChildren } from '@/types/chat';
import type { Chatbot } from '@/types/chatbot';

interface DashboardDebugOverlayProps {
  isAdmin: boolean;
  userId?: string;
  currentThread: Thread | null;
  messages: Message[];
  chatbots: Chatbot[];
  selectedChatbotId: string | null;
  folderTree: FolderWithChildren[];
}

export default function DashboardDebugOverlay({
  isAdmin,
  userId,
  currentThread,
  messages,
  chatbots,
  selectedChatbotId,
  folderTree,
}: DashboardDebugOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['thread', 'chatbot', 'messages'])
  );

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  if (!isAdmin || !isVisible) return null;

  const selectedChatbot = chatbots.find(c => c.id === selectedChatbotId);

  // Flatten folder tree for display
  const flattenFolders = (nodes: FolderWithChildren[], depth = 0): Array<{ folder: FolderWithChildren; depth: number }> => {
    const result: Array<{ folder: FolderWithChildren; depth: number }> = [];
    for (const folder of nodes) {
      result.push({ folder, depth });
      if (folder.children && folder.children.length > 0) {
        result.push(...flattenFolders(folder.children, depth + 1));
      }
    }
    return result;
  };

  const flatFolders = flattenFolders(folderTree);

  return (
    <div className="fixed top-4 right-4 z-[9999] pointer-events-auto">
      <div className="bg-slate-900/95 text-white p-4 rounded-lg shadow-2xl border border-slate-700 max-w-sm max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-lg">🔧</span>
            <h3 className="font-bold text-sm">Admin Debug Panel</h3>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-slate-500 mb-3 pb-2 border-b border-slate-700">
          Press <kbd className="bg-slate-800 px-1 rounded">Ctrl+Shift+D</kbd> to toggle
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* User ID */}
          {userId && (
            <div className="bg-slate-800/50 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">User ID</span>
                <button
                  onClick={() => copyToClipboard(userId, 'user')}
                  className="text-slate-400 hover:text-white px-1"
                  title="Copy User ID"
                >
                  {copiedId === 'user' ? '✓' : '📋'}
                </button>
              </div>
              <div className="text-xs font-mono text-slate-300 truncate mt-1">{userId}</div>
            </div>
          )}

          {/* Current Thread Section */}
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('thread')}
              className="w-full flex items-center justify-between p-2 hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                <span className="text-xs font-bold">Current Thread</span>
              </div>
              <span className="text-slate-400 text-xs">
                {expandedSections.has('thread') ? '▼' : '▶'}
              </span>
            </button>
            {expandedSections.has('thread') && (
              <div className="px-2 pb-2">
                {currentThread ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">ID:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-green-300 truncate max-w-[180px]">
                          {currentThread.id}
                        </span>
                        <button
                          onClick={() => copyToClipboard(currentThread.id, 'thread')}
                          className="text-slate-400 hover:text-white px-1"
                        >
                          {copiedId === 'thread' ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-400">Title:</span>{' '}
                      <span className="text-slate-200">{currentThread.title || '(untitled)'}</span>
                    </div>
                    {currentThread.folder_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Folder ID:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-slate-300 truncate max-w-[140px]">
                            {currentThread.folder_id}
                          </span>
                          <button
                            onClick={() => copyToClipboard(currentThread.folder_id!, 'thread-folder')}
                            className="text-slate-400 hover:text-white px-1"
                          >
                            {copiedId === 'thread-folder' ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    )}
                    {currentThread.chatbot_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Chatbot ID:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-slate-300 truncate max-w-[140px]">
                            {currentThread.chatbot_id}
                          </span>
                          <button
                            onClick={() => copyToClipboard(currentThread.chatbot_id!, 'thread-chatbot')}
                            className="text-slate-400 hover:text-white px-1"
                          >
                            {copiedId === 'thread-chatbot' ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No thread selected</div>
                )}
              </div>
            )}
          </div>

          {/* Current Chatbot Section */}
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('chatbot')}
              className="w-full flex items-center justify-between p-2 hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                <span className="text-xs font-bold">Active Chatbot</span>
              </div>
              <span className="text-slate-400 text-xs">
                {expandedSections.has('chatbot') ? '▼' : '▶'}
              </span>
            </button>
            {expandedSections.has('chatbot') && (
              <div className="px-2 pb-2">
                {selectedChatbot ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">ID:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-purple-300 truncate max-w-[180px]">
                          {selectedChatbot.id}
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedChatbot.id, 'chatbot')}
                          className="text-slate-400 hover:text-white px-1"
                        >
                          {copiedId === 'chatbot' ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-400">Name:</span>{' '}
                      <span className="text-slate-200">{selectedChatbot.name}</span>
                    </div>
                    {selectedChatbot.folder_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Folder ID:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-slate-300 truncate max-w-[140px]">
                            {selectedChatbot.folder_id}
                          </span>
                          <button
                            onClick={() => copyToClipboard(selectedChatbot.folder_id!, 'chatbot-folder')}
                            className="text-slate-400 hover:text-white px-1"
                          >
                            {copiedId === 'chatbot-folder' ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No chatbot selected</div>
                )}
              </div>
            )}
          </div>

          {/* Messages Section */}
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('messages')}
              className="w-full flex items-center justify-between p-2 hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                <span className="text-xs font-bold">Messages ({messages.length})</span>
              </div>
              <span className="text-slate-400 text-xs">
                {expandedSections.has('messages') ? '▼' : '▶'}
              </span>
            </button>
            {expandedSections.has('messages') && (
              <div className="px-2 pb-2 max-h-48 overflow-y-auto">
                {messages.length > 0 ? (
                  <div className="space-y-1">
                    {messages.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-medium ${
                            msg.role === 'user' ? 'text-blue-300' : 'text-green-300'
                          }`}>
                            M{idx + 1}
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[100px]">
                            {msg.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-slate-500 truncate max-w-[100px]">
                            {msg.id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.id, `msg-${msg.id}`)}
                            className="text-slate-400 hover:text-white px-1"
                          >
                            {copiedId === `msg-${msg.id}` ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No messages</div>
                )}
              </div>
            )}
          </div>

          {/* Folders Section */}
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('folders')}
              className="w-full flex items-center justify-between p-2 hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                <span className="text-xs font-bold">Folders ({flatFolders.length})</span>
              </div>
              <span className="text-slate-400 text-xs">
                {expandedSections.has('folders') ? '▼' : '▶'}
              </span>
            </button>
            {expandedSections.has('folders') && (
              <div className="px-2 pb-2 max-h-48 overflow-y-auto">
                {flatFolders.length > 0 ? (
                  <div className="space-y-1">
                    {flatFolders.map(({ folder, depth }) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0"
                        style={{ paddingLeft: `${depth * 12}px` }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs">📁</span>
                          <span className="text-xs text-slate-200 truncate max-w-[120px]">
                            {folder.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-slate-500 truncate max-w-[80px]">
                            {folder.id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(folder.id, `folder-${folder.id}`)}
                            className="text-slate-400 hover:text-white px-1"
                          >
                            {copiedId === `folder-${folder.id}` ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No folders</div>
                )}
              </div>
            )}
          </div>

          {/* All Chatbots Section */}
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('all-chatbots')}
              className="w-full flex items-center justify-between p-2 hover:bg-slate-700/50"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
                <span className="text-xs font-bold">All Chatbots ({chatbots.length})</span>
              </div>
              <span className="text-slate-400 text-xs">
                {expandedSections.has('all-chatbots') ? '▼' : '▶'}
              </span>
            </button>
            {expandedSections.has('all-chatbots') && (
              <div className="px-2 pb-2 max-h-48 overflow-y-auto">
                {chatbots.length > 0 ? (
                  <div className="space-y-1">
                    {chatbots.map((chatbot, idx) => (
                      <div
                        key={chatbot.id}
                        className={`flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0 ${
                          chatbot.id === selectedChatbotId ? 'bg-purple-500/20 rounded' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-medium text-pink-300">
                            C{idx + 1}
                          </span>
                          <span className="text-xs text-slate-200 truncate max-w-[100px]">
                            {chatbot.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-slate-500 truncate max-w-[80px]">
                            {chatbot.id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(chatbot.id, `all-chatbot-${chatbot.id}`)}
                            className="text-slate-400 hover:text-white px-1"
                          >
                            {copiedId === `all-chatbot-${chatbot.id}` ? '✓' : '📋'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No chatbots</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
