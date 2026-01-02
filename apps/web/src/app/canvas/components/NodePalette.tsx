'use client';

/**
 * Node Palette
 *
 * Left sidebar showing all available node types that can be added to the canvas.
 * Organized by category with drag-and-drop support.
 */

import React from 'react';
import type { CanvasNodeType } from '../types';
import { NODE_DEFINITIONS, getVisibleCategories, getNodesByCategory } from '../lib/nodeRegistry';

interface NodePaletteProps {
  onAddNode: (type: CanvasNodeType) => void;
}

export default function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/30 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Node Palette</h3>
        <p className="mt-1 text-xs text-foreground/60">
          Click to add nodes to canvas
        </p>
      </div>

      {/* Node Categories */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {getVisibleCategories().map(category => {
            const nodes = getNodesByCategory(category.id);
            if (nodes.length === 0) return null;

            return (
              <div key={category.id}>
                {/* Category Header */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">{category.icon}</span>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
                    {category.label}
                  </h4>
                </div>

                {/* Nodes in Category */}
                <div className="space-y-2">
                  {nodes.map(definition => (
                    <button
                      key={definition.type}
                      onClick={() => onAddNode(definition.type)}
                      className={`
                        group relative w-full rounded-lg border-2 border-white/40
                        bg-white/60 p-3 text-left transition-all
                        hover:border-${definition.color}-500 hover:bg-white/80
                        active:scale-95
                      `}
                    >
                      {/* Node Icon & Label */}
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{definition.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">
                            {definition.label}
                          </div>
                          {definition.description && (
                            <div className="mt-1 text-xs text-foreground/60 line-clamp-2">
                              {definition.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Ports Indicator */}
                      <div className="mt-2 flex items-center gap-2 text-xs text-foreground/50">
                        {definition.inputs.length > 0 && (
                          <span>↓ {definition.inputs.length} in</span>
                        )}
                        {definition.outputs.length > 0 && (
                          <span>↑ {definition.outputs.length} out</span>
                        )}
                      </div>

                      {/* Hover Effect */}
                      <div
                        className={`
                          absolute inset-0 rounded-lg opacity-0 transition-opacity
                          group-hover:opacity-100 pointer-events-none
                          bg-gradient-to-br from-${definition.color}-500/10 to-transparent
                        `}
                      />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/30 px-4 py-3">
        <p className="text-xs text-foreground/50">
          {Object.values(NODE_DEFINITIONS).filter(def => !def.hidden).length} node types available
        </p>
      </div>
    </div>
  );
}
