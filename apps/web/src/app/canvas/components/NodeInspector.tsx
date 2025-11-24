'use client';

/**
 * Node Inspector
 *
 * Right sidebar for configuring the selected node's properties.
 * Shows different configuration options based on node type.
 */

import React, { useState } from 'react';
import type { CanvasNode, GenesisBotNodeConfig } from '../types';
import { NODE_DEFINITIONS } from '../lib/nodeRegistry';
import GenesisBotConfigPanel from './config/GenesisBotConfigPanel';
import { useCanvasContext } from '../context/CanvasStateContext';
import { useAskAnswer, QueryInput, QueryReviewPanel, AskAnswerToggle } from '../features/ask-answer';
import { findEdgeBetweenNodes } from '../features/ask-answer/lib/validation';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

interface NodeInspectorProps {
  node: CanvasNode | null;
  onUpdateNode: (updates: Partial<CanvasNode>) => void;
  onDeleteNode: () => void;
  onDuplicateNode: () => void;
  onClose: () => void;
}

export default function NodeInspector({
  node,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onClose,
}: NodeInspectorProps) {
  const [label, setLabel] = useState(node?.label || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Ask/Answer integration
  const { nodes, edges } = useCanvasContext();
  const askAnswer = useAskAnswer();

  // Find ALL connected Genesis Bot nodes (for toggle section)
  const allGenesisBotConnections = node && node.type === 'GENESIS_BOT'
    ? edges.list
        .filter(edge => edge.from_node_id === node.id || edge.to_node_id === node.id)
        .map(edge => {
          const isOutgoing = edge.from_node_id === node.id;
          const connectedNodeId = isOutgoing ? edge.to_node_id : edge.from_node_id;
          const connectedNode = nodes.list.find(n => n.id === connectedNodeId);
          return {
            edge,
            isOutgoing,
            connectedNode,
            enabled: askAnswer.isEnabled(edge.id),
          };
        })
        .filter(conn => conn.connectedNode?.type === 'GENESIS_BOT')
    : [];

  // Find connected Genesis Bot nodes with Ask/Answer ENABLED (for communication section)
  const askAnswerConnections = allGenesisBotConnections.filter(conn => conn.enabled);

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 text-5xl opacity-50">👈</div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">
          No Node Selected
        </h3>
        <p className="text-xs text-slate-500">
          Click a node on the canvas to configure it
        </p>
      </div>
    );
  }

  const definition = NODE_DEFINITIONS[node.type];

  const handleLabelUpdate = () => {
    if (label.trim() && label !== node.label) {
      onUpdateNode({ label: label.trim() });
    }
  };

  const handleDeleteClick = () => {
    if (showDeleteConfirm) {
      onDeleteNode();
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Node Inspector</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Node Info */}
      <div className="border-b border-slate-800 bg-slate-800/50 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{definition.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {definition.label}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {definition.description || 'No description available'}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {/* Basic Settings */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Basic Settings
            </h4>

            {/* Label */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-300">
                Node Label
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={handleLabelUpdate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLabelUpdate();
                    e.currentTarget.blur();
                  }
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Enter node label..."
              />
            </div>

            {/* Position */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-400">X Position</label>
                <div className="mt-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-500">
                  {Math.round(node.position.x)}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400">Y Position</label>
                <div className="mt-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-500">
                  {Math.round(node.position.y)}
                </div>
              </div>
            </div>
          </div>

          {/* Node-Specific Configuration */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Node Configuration
            </h4>

            {/* Genesis Bot Configuration */}
            {node.type === 'GENESIS_BOT' && (
              <GenesisBotConfigPanel
                config={node.config as GenesisBotNodeConfig}
                onUpdate={(updates) => onUpdateNode({ config: { ...node.config, ...updates } })}
              />
            )}

            {/* Placeholder for other node types */}
            {node.type !== 'GENESIS_BOT' && (
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-xs text-slate-400">
                  Configuration panel for {definition.label} nodes will be displayed here.
                </p>
                <div className="mt-3 space-y-2">
                  {Object.entries(node.config).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="font-medium text-slate-300">{key}:</span>{' '}
                      <span className="text-slate-500">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ask/Answer Connections - Only for Genesis Bot nodes */}
          {FEATURE_FLAGS.ASK_ANSWER && node.type === 'GENESIS_BOT' && allGenesisBotConnections.length > 0 && (
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Ask/Answer Connections
              </h4>

              <div className="space-y-3">
                {allGenesisBotConnections.map(({ edge, isOutgoing, connectedNode, enabled }) => {
                  if (!connectedNode) return null;

                  return (
                    <div key={edge.id}>
                      <div className="mb-2 text-xs text-slate-500">
                        {isOutgoing ? 'Can ask' : 'Can answer'}: {connectedNode.label}
                      </div>
                      <AskAnswerToggle
                        edgeId={edge.id}
                        fromNodeId={edge.from_node_id}
                        toNodeId={edge.to_node_id}
                        enabled={enabled}
                        onToggle={async (newEnabled) => {
                          if (newEnabled) {
                            await askAnswer.enableAskAnswer(edge.id);
                          } else {
                            await askAnswer.disableAskAnswer(edge.id);
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ask/Answer Communication - Only show if Ask/Answer is enabled */}
          {FEATURE_FLAGS.ASK_ANSWER && node.type === 'GENESIS_BOT' && askAnswerConnections.length > 0 && (
            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Conversations
              </h4>

              <div className="space-y-4">
                {askAnswerConnections.map(({ edge, isOutgoing, connectedNode }) => {
                  if (!connectedNode) return null;

                  // Check if there's a pending answer to review
                  const pendingAnswer = isOutgoing
                    ? askAnswer.getPendingAnswer(node.id, edge.id)
                    : null;

                  return (
                    <div key={edge.id} className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
                      {/* Connection Header */}
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                          <span className="text-lg">💬</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-slate-300">
                            {isOutgoing ? 'Ask' : 'Answer'} Mode
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {isOutgoing ? `→ ${connectedNode.label}` : `← ${connectedNode.label}`}
                          </div>
                        </div>
                      </div>

                      {/* Outgoing: Can send questions */}
                      {isOutgoing && (
                        <div className="space-y-3">
                          {/* Show pending answer if available */}
                          {pendingAnswer && (
                            <QueryReviewPanel
                              pendingAnswer={pendingAnswer}
                              onClear={() => askAnswer.clearAnswer(node.id, pendingAnswer.queryId)}
                              onSendNewQuery={(query) =>
                                askAnswer.sendQuery({
                                  fromNodeId: node.id,
                                  toNodeId: connectedNode.id,
                                  edgeId: edge.id,
                                  query,
                                })
                              }
                            />
                          )}

                          {/* Show query input if no pending answer */}
                          {!pendingAnswer && (
                            <QueryInput
                              fromNodeId={node.id}
                              toNodeId={connectedNode.id}
                              edgeId={edge.id}
                              onSendQuery={(query) =>
                                askAnswer.sendQuery({
                                  fromNodeId: node.id,
                                  toNodeId: connectedNode.id,
                                  edgeId: edge.id,
                                  query,
                                })
                              }
                              disabled={askAnswer.isSendingQuery}
                            />
                          )}
                        </div>
                      )}

                      {/* Incoming: This node answers questions */}
                      {!isOutgoing && (
                        <div className="rounded-md bg-slate-900/50 border border-slate-700 px-3 py-2">
                          <p className="text-xs text-slate-400">
                            This node will answer questions from{' '}
                            <span className="font-medium text-slate-300">{connectedNode.label}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ports */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ports
            </h4>

            {/* Input Ports */}
            {definition.inputs.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 text-xs text-slate-500">Inputs</div>
                <div className="space-y-1">
                  {definition.inputs.map(port => (
                    <div
                      key={port.id}
                      className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2"
                    >
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs text-slate-300">{port.label}</span>
                      <span className="ml-auto text-xs text-slate-500">{port.dataType}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output Ports */}
            {definition.outputs.length > 0 && (
              <div>
                <div className="mb-2 text-xs text-slate-500">Outputs</div>
                <div className="space-y-1">
                  {definition.outputs.map(port => (
                    <div
                      key={port.id}
                      className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2"
                    >
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-xs text-slate-300">{port.label}</span>
                      <span className="ml-auto text-xs text-slate-500">{port.dataType}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-800 p-4">
        <div className="space-y-2">
          {/* Duplicate */}
          <button
            onClick={onDuplicateNode}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Duplicate Node
          </button>

          {/* Delete */}
          <button
            onClick={handleDeleteClick}
            className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              showDeleteConfirm
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'border border-red-600/50 bg-red-600/10 text-red-400 hover:bg-red-600/20'
            }`}
          >
            {showDeleteConfirm ? 'Click Again to Confirm' : 'Delete Node'}
          </button>
        </div>
      </div>
    </div>
  );
}
