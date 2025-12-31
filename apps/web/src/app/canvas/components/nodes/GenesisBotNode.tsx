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
          rounded-lg border-2 bg-white/85 backdrop-blur-md shadow-lg
          transition-all
          ${selected ? 'border-sky ring-2 ring-sky/50' : 'border-foreground/20'}
          ${isExpanded ? 'w-[700px]' : 'min-w-[200px]'}
        `}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="input"
          className="!bg-green-500 !border-2 !border-white"
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
                <div className="font-semibold text-foreground text-sm truncate">
                  {nodeData.label}
                </div>
                <div className="text-xs text-foreground/60">
                  {nodeData.config.model_name}
                </div>
              </div>
            </div>

            {/* Node Info */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between text-foreground/50">
                <span>Provider:</span>
                <span className="text-foreground/70 capitalize">{nodeData.config.model_provider}</span>
              </div>
              {nodeData.config.temperature !== undefined && (
                <div className="flex items-center justify-between text-foreground/50">
                  <span>Temperature:</span>
                  <span className="text-foreground/70">{nodeData.config.temperature}</span>
                </div>
              )}
            </div>

            {/* Click Hint */}
            <div className="mt-3 pt-3 border-t border-foreground/10">
              <div className="text-xs text-foreground/50 text-center">
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
          className="!bg-sky !border-2 !border-white"
        />
      </div>
    </>
  );
}
