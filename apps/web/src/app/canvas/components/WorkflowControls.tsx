'use client';

/**
 * Workflow Controls
 *
 * Top toolbar with canvas selection, workflow execution controls,
 * and view toggles.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import type { Canvas, CanvasId } from '../types';

interface WorkflowControlsProps {
  currentCanvas: Canvas | null;
  canvases: Canvas[];
  onSelectCanvas: (canvas: Canvas | null) => void;
  onCreateCanvas: () => void;
  onUpdateCanvas: (id: CanvasId, updates: Partial<Canvas>) => Promise<boolean>;
  onDeleteCanvas: (id: CanvasId) => Promise<boolean>;
  workflowMode: boolean;
  onToggleWorkflowMode: () => void;
  onToggleNodePalette: () => void;
  onToggleInspector: () => void;
  showNodePalette: boolean;
  showInspector: boolean;
}

export default function WorkflowControls({
  currentCanvas,
  canvases,
  onSelectCanvas,
  onCreateCanvas,
  onUpdateCanvas,
  onDeleteCanvas,
  workflowMode,
  onToggleWorkflowMode,
  onToggleNodePalette,
  onToggleInspector,
  showNodePalette,
  showInspector,
}: WorkflowControlsProps) {
  const [showCanvasMenu, setShowCanvasMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteCanvas = async () => {
    if (!currentCanvas) return;

    if (showDeleteConfirm) {
      const success = await onDeleteCanvas(currentCanvas.id);
      if (success) {
        setShowDeleteConfirm(false);
        setShowCanvasMenu(false);
      }
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <div className="flex items-center justify-between">
      {/* Left Section - Canvas Selection */}
      <div className="flex items-center gap-3">
        {/* Back to Dashboard Button */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-lg border border-foreground/30 bg-white/60 px-3 py-2 text-sm text-foreground/60 hover:bg-white/80 hover:text-foreground transition-colors"
          title="Back to Dashboard"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        {/* Canvas Selector */}
        <div className="relative">
          <button
            onClick={() => setShowCanvasMenu(!showCanvasMenu)}
            className="flex items-center gap-2 rounded-lg border border-foreground/30 bg-white/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/80 transition-colors"
          >
            {currentCanvas ? (
              <>
                <span className="max-w-xs truncate">{currentCanvas.name}</span>
                <span className="text-xs text-foreground/50">
                  ({currentCanvas.mode})
                </span>
              </>
            ) : (
              <span className="text-foreground/60">Select Canvas</span>
            )}
            <svg
              className={`h-4 w-4 transition-transform ${showCanvasMenu ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showCanvasMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowCanvasMenu(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-lg border border-white/40 bg-white/80 backdrop-blur-md shadow-xl">
                {/* Canvas List */}
                <div className="max-h-64 overflow-y-auto p-2">
                  {canvases.length > 0 ? (
                    canvases.map(canvas => (
                      <button
                        key={canvas.id}
                        onClick={() => {
                          onSelectCanvas(canvas);
                          setShowCanvasMenu(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                          currentCanvas?.id === canvas.id
                            ? 'bg-sky text-white'
                            : 'text-foreground hover:bg-white/60'
                        }`}
                      >
                        <div className="font-medium">{canvas.name}</div>
                        <div className="text-xs opacity-75">
                          {canvas.mode} • {new Date(canvas.updated_at).toLocaleDateString()}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-foreground/60">
                      No canvases yet
                    </div>
                  )}
                </div>

                {/* Create New */}
                <div className="border-t border-white/40 p-2">
                  <button
                    onClick={() => {
                      onCreateCanvas();
                      setShowCanvasMenu(false);
                    }}
                    className="w-full rounded-lg bg-sky px-3 py-2 text-sm font-medium text-white hover:bg-sky/80 transition-colors"
                  >
                    + Create New Canvas
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Canvas Actions */}
        {currentCanvas && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteCanvas}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                showDeleteConfirm
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'border border-foreground/30 bg-white/60 text-foreground/60 hover:bg-white/80 hover:text-red-500'
              }`}
            >
              {showDeleteConfirm ? 'Confirm Delete?' : '🗑️'}
            </button>
          </div>
        )}
      </div>

      {/* Center Section - Workflow Controls */}
      {currentCanvas && (
        <div className="flex items-center gap-2">
          {/* Workflow Mode Toggle */}
          <button
            onClick={onToggleWorkflowMode}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              workflowMode
                ? 'bg-sky text-white'
                : 'border border-foreground/30 bg-white/60 text-foreground/60 hover:bg-white/80'
            }`}
          >
            {workflowMode ? '⚡ Workflow Mode' : '✏️ Edit Mode'}
          </button>
        </div>
      )}

      {/* Right Section - View Toggles */}
      <div className="flex items-center gap-2">
        {/* Node Palette Toggle */}
        <button
          onClick={onToggleNodePalette}
          className={`rounded-lg px-3 py-2 text-sm transition-colors ${
            showNodePalette
              ? 'bg-sky/20 text-foreground border border-sky/30'
              : 'border border-foreground/30 bg-white/60 text-foreground/60 hover:bg-white/80'
          }`}
          title="Toggle Node Palette"
        >
          📦
        </button>

        {/* Inspector Toggle */}
        <button
          onClick={onToggleInspector}
          className={`rounded-lg px-3 py-2 text-sm transition-colors ${
            showInspector
              ? 'bg-sky/20 text-foreground border border-sky/30'
              : 'border border-foreground/30 bg-white/60 text-foreground/60 hover:bg-white/80'
          }`}
          title="Toggle Node Inspector"
        >
          ⚙️
        </button>

        {/* Help */}
        <button
          onClick={() => alert('Canvas Help:\n\n1. Click nodes in the palette to add them\n2. Drag nodes to position them\n3. Connect nodes by dragging from output to input\n4. Click a node to configure it\n5. Click Run to execute the workflow')}
          className="rounded-lg border border-foreground/30 bg-white/60 px-3 py-2 text-sm text-foreground/60 hover:bg-white/80 transition-colors"
          title="Help"
        >
          ?
        </button>
      </div>
    </div>
  );
}
