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
        className="fixed bottom-4 right-4 z-50 bg-sky hover:bg-sky/80 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
        title="Show help"
      >
        ?
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white/90 backdrop-blur-md text-foreground p-4 rounded-lg shadow-2xl border border-white/40 max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-foreground">Canvas Controls</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-foreground/40 hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-xs text-foreground/80">
        <div className="flex items-start gap-2">
          <span className="text-sky font-bold">→</span>
          <span><strong className="text-foreground">Click edge</strong> → Press <kbd className="bg-foreground/10 px-1 rounded text-foreground">Delete</kbd> to remove connection</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-green-600 font-bold">→</span>
          <span><strong className="text-foreground">Drag</strong> from green/blue circles to connect nodes</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-500 font-bold">→</span>
          <span><strong className="text-foreground">Click node</strong> to expand/chat</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-purple-600 font-bold">→</span>
          <span><strong className="text-foreground">Ctrl+Shift+D</strong> for debug labels (admin)</span>
        </div>
      </div>
    </div>
  );
}
