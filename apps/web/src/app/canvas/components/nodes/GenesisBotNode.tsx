'use client';

/**
 * AI Agent Node Component (internally GENESIS_BOT)
 *
 * Displays an AI Agent node in the canvas.
 * When clicked, opens a chat modal to interact with the bot.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { GenesisBotNodeConfig } from '../../types';
import GenesisBotChatModal from '../modals/GenesisBotChatModal';

export interface GenesisBotNodeData {
  label: string;
  config: GenesisBotNodeConfig;
  nodeType: string;
}

// Use any for NodeProps to avoid strict typing issues with @xyflow/react
export default function GenesisBotNode({ id, data, selected }: NodeProps<any>) {
  // Cast data for type safety internally
  const nodeData = data as GenesisBotNodeData;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Node - Can be collapsed or expanded */}
      <div
        data-node-id={id}
        className={`
          rounded-lg border-2 bg-slate-800 shadow-lg
          transition-all
          ${selected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-slate-600'}
          ${isExpanded ? 'w-[700px]' : 'min-w-[200px]'}
        `}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="!bg-green-500 !border-2 !border-slate-900"
        />

        {isExpanded ? (
          /* Expanded Chat View */
          <GenesisBotChatModal
            isOpen={true}
            onClose={() => setIsExpanded(false)}
            botConfig={nodeData.config}
            botLabel={nodeData.label}
            nodeId={id}
            inlineMode={true}
          />
        ) : (
          /* Collapsed Preview */
          <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(true)}>
            {/* Node Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl">🤖</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100 text-sm truncate">
                  {nodeData.label}
                </div>
                <div className="text-xs text-slate-400">
                  {nodeData.config.model_name}
                </div>
              </div>
            </div>

            {/* Node Info */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Provider:</span>
                <span className="text-slate-300 capitalize">{nodeData.config.model_provider}</span>
              </div>
              {nodeData.config.temperature !== undefined && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>Temperature:</span>
                  <span className="text-slate-300">{nodeData.config.temperature}</span>
                </div>
              )}
            </div>

            {/* Click Hint */}
            <div className="mt-3 pt-3 border-t border-slate-700">
              <div className="text-xs text-slate-400 text-center">
                Click to chat
              </div>
            </div>
          </div>
        )}

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!bg-blue-500 !border-2 !border-slate-900"
        />
      </div>
    </>
  );
}
