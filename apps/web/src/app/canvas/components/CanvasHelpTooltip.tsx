'use client';

/**
 * Canvas Help Tooltip
 *
 * Shows keyboard shortcuts and tips for canvas operations
 */

import React, { useState } from 'react';

export default function CanvasHelpTooltip() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
        title="Show help"
      >
        ?
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-slate-900/95 text-white p-4 rounded-lg shadow-2xl border border-slate-700 max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Canvas Controls</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <span className="text-blue-400 font-bold">→</span>
          <span><strong>Click edge</strong> → Press <kbd className="bg-slate-800 px-1 rounded">Delete</kbd> to remove connection</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-green-400 font-bold">→</span>
          <span><strong>Drag</strong> from green/blue circles to connect nodes</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-yellow-400 font-bold">→</span>
          <span><strong>Click node</strong> to expand/chat</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-purple-400 font-bold">→</span>
          <span><strong>Ctrl+Shift+D</strong> for debug labels (admin)</span>
        </div>
      </div>
    </div>
  );
}
