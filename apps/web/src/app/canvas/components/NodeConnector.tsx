'use client';

/**
 * Node Connector Component
 *
 * Allows connecting the current node to other nodes in the canvas.
 * Used within node modals (Genesis Bot, Boardroom, etc.)
 */

import React, { useState } from 'react';
import type { CanvasNode, NodeId } from '../types';
import { NODE_DEFINITIONS } from '../lib/nodeRegistry';

interface NodeConnectorProps {
  currentNodeId: NodeId;
  allNodes: CanvasNode[];
  existingConnections: {
    outgoing: NodeId[]; // Nodes this node connects TO
    incoming: NodeId[]; // Nodes that connect TO this node
  };
  onConnect: (targetNodeId: NodeId, direction: 'outgoing' | 'incoming') => Promise<void>;
  onDisconnect: (targetNodeId: NodeId, direction: 'outgoing' | 'incoming') => Promise<void>;
}

export default function NodeConnector({
  currentNodeId,
  allNodes,
  existingConnections,
  onConnect,
  onDisconnect,
}: NodeConnectorProps) {
  const [connectingTo, setConnectingTo] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState(false);

  // Filter out the current node
  const availableNodes = allNodes.filter(n => n.id !== currentNodeId);

  const handleConnect = async (targetNodeId: NodeId, direction: 'outgoing' | 'incoming') => {
    await onConnect(targetNodeId, direction);
    setConnectingTo(false);
    setConnectingFrom(false);
  };

  const handleDisconnect = async (targetNodeId: NodeId, direction: 'outgoing' | 'incoming') => {
    await onDisconnect(targetNodeId, direction);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Node Connections
      </h4>

      {/* Outgoing Connections (This node → Other nodes) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-300">
            Connects To (Output)
          </label>
          <button
            onClick={() => setConnectingTo(!connectingTo)}
            className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500 transition-colors"
          >
            {connectingTo ? 'Cancel' : '+ Add Connection'}
          </button>
        </div>

        {/* Existing outgoing connections */}
        {existingConnections.outgoing.length > 0 && (
          <div className="mb-2 space-y-1">
            {existingConnections.outgoing.map((nodeId) => {
              const node = allNodes.find(n => n.id === nodeId);
              if (!node) return null;
              const definition = NODE_DEFINITIONS[node.type];

              return (
                <div
                  key={nodeId}
                  className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2"
                >
                  <div className="text-lg">{definition.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-300 truncate">
                      {node.label}
                    </div>
                    <div className="text-xs text-slate-500">{definition.label}</div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(nodeId, 'outgoing')}
                    className="rounded p-1 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Remove connection"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new outgoing connection */}
        {connectingTo && (
          <div className="space-y-1 rounded border border-blue-500/50 bg-blue-500/10 p-2">
            {availableNodes
              .filter(n => !existingConnections.outgoing.includes(n.id))
              .map((node) => {
                const definition = NODE_DEFINITIONS[node.type];

                return (
                  <button
                    key={node.id}
                    onClick={() => handleConnect(node.id, 'outgoing')}
                    className="flex w-full items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 hover:bg-slate-700 transition-colors"
                  >
                    <div className="text-lg">{definition.icon}</div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-medium text-slate-300 truncate">
                        {node.label}
                      </div>
                      <div className="text-xs text-slate-500">{definition.label}</div>
                    </div>
                    <div className="text-blue-400">→</div>
                  </button>
                );
              })}
            {availableNodes.filter(n => !existingConnections.outgoing.includes(n.id)).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">
                All nodes are already connected
              </p>
            )}
          </div>
        )}

        {existingConnections.outgoing.length === 0 && !connectingTo && (
          <p className="text-xs text-slate-500">No outgoing connections</p>
        )}
      </div>

      {/* Incoming Connections (Other nodes → This node) */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-300">
            Receives From (Input)
          </label>
          <button
            onClick={() => setConnectingFrom(!connectingFrom)}
            className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 transition-colors"
          >
            {connectingFrom ? 'Cancel' : '+ Add Connection'}
          </button>
        </div>

        {/* Existing incoming connections */}
        {existingConnections.incoming.length > 0 && (
          <div className="mb-2 space-y-1">
            {existingConnections.incoming.map((nodeId) => {
              const node = allNodes.find(n => n.id === nodeId);
              if (!node) return null;
              const definition = NODE_DEFINITIONS[node.type];

              return (
                <div
                  key={nodeId}
                  className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2"
                >
                  <div className="text-lg">{definition.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-300 truncate">
                      {node.label}
                    </div>
                    <div className="text-xs text-slate-500">{definition.label}</div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(nodeId, 'incoming')}
                    className="rounded p-1 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Remove connection"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new incoming connection */}
        {connectingFrom && (
          <div className="space-y-1 rounded border border-green-500/50 bg-green-500/10 p-2">
            {availableNodes
              .filter(n => !existingConnections.incoming.includes(n.id))
              .map((node) => {
                const definition = NODE_DEFINITIONS[node.type];

                return (
                  <button
                    key={node.id}
                    onClick={() => handleConnect(node.id, 'incoming')}
                    className="flex w-full items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 hover:bg-slate-700 transition-colors"
                  >
                    <div className="text-lg">{definition.icon}</div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-medium text-slate-300 truncate">
                        {node.label}
                      </div>
                      <div className="text-xs text-slate-500">{definition.label}</div>
                    </div>
                    <div className="text-green-400">←</div>
                  </button>
                );
              })}
            {availableNodes.filter(n => !existingConnections.incoming.includes(n.id)).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">
                All nodes are already connected
              </p>
            )}
          </div>
        )}

        {existingConnections.incoming.length === 0 && !connectingFrom && (
          <p className="text-xs text-slate-500">No incoming connections</p>
        )}
      </div>
    </div>
  );
}
