'use client';

/**
 * Workflow Controls
 *
 * Top toolbar with canvas selection, workflow execution controls,
 * and view toggles.
 */

import React, { useState } from 'react';
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
  const [isRunning, setIsRunning] = useState(false);

  const handleRunWorkflow = () => {
    if (!currentCanvas) return;

    setIsRunning(true);
    // TODO: Implement workflow execution
    setTimeout(() => {
      setIsRunning(false);
      alert('Workflow execution will be implemented in Phase 4');
    }, 1000);
  };

  const handleStopWorkflow = () => {
    setIsRunning(false);
    // TODO: Implement workflow stop
  };

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
        {/* Canvas Selector */}
        <div className="relative">
          <button
            onClick={() => setShowCanvasMenu(!showCanvasMenu)}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-750 transition-colors"
          >
            {currentCanvas ? (
              <>
                <span className="max-w-xs truncate">{currentCanvas.name}</span>
                <span className="text-xs text-slate-500">
                  ({currentCanvas.mode})
                </span>
              </>
            ) : (
              <span className="text-slate-400">Select Canvas</span>
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
              <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
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
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <div className="font-medium">{canvas.name}</div>
                        <div className="text-xs opacity-75">
                          {canvas.mode} • {new Date(canvas.updated_at).toLocaleDateString()}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">
                      No canvases yet
                    </div>
                  )}
                </div>

                {/* Create New */}
                <div className="border-t border-slate-700 p-2">
                  <button
                    onClick={() => {
                      onCreateCanvas();
                      setShowCanvasMenu(false);
                    }}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
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
                  : 'border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-red-400'
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
          {/* Run/Stop */}
          {!isRunning ? (
            <button
              onClick={handleRunWorkflow}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Run Workflow
            </button>
          ) : (
            <button
              onClick={handleStopWorkflow}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
              Stop
            </button>
          )}

          {/* Workflow Mode Toggle */}
          <button
            onClick={onToggleWorkflowMode}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              workflowMode
                ? 'bg-blue-600 text-white'
                : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
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
              ? 'bg-slate-700 text-slate-200'
              : 'border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
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
              ? 'bg-slate-700 text-slate-200'
              : 'border border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
          title="Toggle Node Inspector"
        >
          ⚙️
        </button>

        {/* Help */}
        <button
          onClick={() => alert('Canvas Help:\n\n1. Click nodes in the palette to add them\n2. Drag nodes to position them\n3. Connect nodes by dragging from output to input\n4. Click a node to configure it\n5. Click Run to execute the workflow')}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 transition-colors"
          title="Help"
        >
          ?
        </button>
      </div>
    </div>
  );
}
