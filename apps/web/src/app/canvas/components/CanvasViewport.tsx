'use client';

/**
 * Canvas Viewport
 *
 * React Flow canvas integration for visual node-based workflow building.
 * Handles node rendering, connections, dragging, and interactions.
 */

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CanvasNode, CanvasEdge, NodeId } from '../types';
import { NODE_DEFINITIONS } from '../lib/nodeRegistry';
import GenesisBotNode from './nodes/GenesisBotNode';
import DeletableEdge from './edges/DeletableEdge';

interface CanvasViewportProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: NodeId | null;
  onNodeClick: (nodeId: NodeId) => void;
  onCanvasClick: () => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  workflowMode?: boolean;
}

export default function CanvasViewport({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  onCanvasClick,
  onNodesChange,
  onEdgesChange,
  onConnect,
  workflowMode = false,
}: CanvasViewportProps) {
  // Define custom node types
  const nodeTypes = useMemo(
    () => ({
      GENESIS_BOT: GenesisBotNode,
      // TODO: Add other custom node types here
      // TRAINING_SESSION: TrainingSessionNode,
      // BOARDROOM: BoardroomNode,
      // etc.
    }),
    []
  );

  // Define custom edge types
  const edgeTypes = useMemo(
    () => ({
      deletable: DeletableEdge,
    }),
    []
  );

  // Internal state for React Flow nodes and edges (for proper dragging and selection)
  const [reactFlowNodes, setReactFlowNodes] = useState<Node[]>([]);
  const [reactFlowEdges, setReactFlowEdges] = useState<Edge[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Track drag end timer for debounced database updates
  const dragEndTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Convert CanvasNode[] to React Flow Node[] when props change
  useEffect(() => {
    const convertedNodes: Node[] = nodes.map(node => {
      const definition = NODE_DEFINITIONS[node.type];
      const isSelected = node.id === selectedNodeId;

      // Use custom node type if available, otherwise default
      const nodeType = nodeTypes[node.type as keyof typeof nodeTypes] ? node.type : 'default';

      return {
        id: node.id,
        type: nodeType,
        position: node.position,
        data: {
          label: node.label,
          icon: definition.icon,
          color: definition.color,
          config: node.config,
          nodeType: node.type,
        },
        selected: isSelected,
        deletable: false, // Prevent node deletion via Delete key (only edges can be deleted)
        // Only apply style for default nodes (custom nodes have their own styling)
        ...(nodeType === 'default' && {
          style: {
            background: isSelected ? '#1e40af' : '#1e293b',
            border: `2px solid ${isSelected ? '#3b82f6' : '#475569'}`,
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#f1f5f9',
            fontSize: '14px',
            fontWeight: 500,
            minWidth: '180px',
          },
        }),
      };
    });
    setReactFlowNodes(convertedNodes);
  }, [nodes, selectedNodeId, nodeTypes]);

  // Convert CanvasEdge[] to React Flow Edge[] when props change
  useEffect(() => {
    const convertedEdges: Edge[] = edges.map(edge => {
      const isSelected = edge.id === selectedEdgeId;

      return {
        id: edge.id,
        source: edge.from_node_id,
        target: edge.to_node_id,
        sourceHandle: edge.from_port || undefined,
        targetHandle: edge.to_port || undefined,
        type: 'deletable', // Use custom deletable edge
        selected: isSelected, // CRITICAL: Set selected state
        animated: workflowMode,
        deletable: true, // Allow edge deletion
        interactionWidth: 20, // Wider click area for easier selection
        style: {
          stroke: workflowMode ? '#3b82f6' : '#64748b',
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: workflowMode ? '#3b82f6' : '#64748b',
        },
      };
    });
    setReactFlowEdges(convertedEdges);
  }, [edges, workflowMode, selectedEdgeId]);

  // Handle node changes (dragging, etc.)
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Apply changes to local React Flow state immediately for smooth dragging
      setReactFlowNodes((nds) => applyNodeChanges(changes, nds));

      // Debounce database updates for position changes
      changes.forEach((change) => {
        if (change.type === 'position' && change.position && change.dragging === false) {
          // Only update database when drag ends
          if (dragEndTimerRef.current) {
            clearTimeout(dragEndTimerRef.current);
          }

          dragEndTimerRef.current = setTimeout(() => {
            onNodesChange([change]);
          }, 500); // 500ms debounce
        } else if (change.type === 'remove') {
          // Handle node removal immediately
          onNodesChange([change]);
        }
      });
    },
    [onNodesChange]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedEdgeId(null); // Deselect edge when node is clicked
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  // Handle canvas click (deselect)
  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null); // Deselect edge
    onCanvasClick(); // Deselect node in parent
  }, [onCanvasClick]);

  // Handle edge changes (selection, removal, etc.)
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Apply changes to local React Flow state immediately for smooth interaction
      setReactFlowEdges((eds) => applyEdgeChanges(changes, eds));

      // Track edge selection
      changes.forEach((change) => {
        if (change.type === 'select') {
          console.log('[CanvasViewport] Edge selection change:', change);

          if (change.selected) {
            // Edge selected - deselect all nodes and track selected edge
            setSelectedEdgeId(change.id);
            setReactFlowNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
            onCanvasClick(); // Deselect node in parent
          } else {
            // Edge deselected
            setSelectedEdgeId(null);
          }
        } else if (change.type === 'remove') {
          // Handle edge removal
          console.log('[CanvasViewport] Edge removal:', change.id);
          onEdgesChange([change]);
        }
      });
    },
    [onEdgesChange, onCanvasClick]
  );

  // Handle edge click (for selection)
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      console.log('[CanvasViewport] Edge clicked:', edge.id);
    },
    []
  );

  return (
    <div className="h-full w-full bg-slate-950">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'deletable',
          animated: false,
        }}
        // Selection configuration
        nodesDraggable={true}
        nodesConnectable={true}
        nodesFocusable={true}
        edgesFocusable={true}
        edgesReconnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        // Deletion - only edges, not nodes
        deleteKeyCode="Delete"
        // Styling
        className="canvas-viewport"
        proOptions={{ hideAttribution: true }}
      >
        {/* Grid Background */}
        <Background
          gap={20}
          size={1}
          color="#334155"
          style={{ background: '#0f172a' }}
        />

        {/* Navigation Controls */}
        <Controls
          showZoom
          showFitView
          showInteractive
          style={{
            background: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
          }}
        />

        {/* MiniMap */}
        <MiniMap
          nodeColor={(node) => {
            const nodeData = node.data as any;
            const colorMap: Record<string, string> = {
              blue: '#3b82f6',
              green: '#10b981',
              purple: '#8b5cf6',
              orange: '#f59e0b',
              red: '#ef4444',
              yellow: '#eab308',
              pink: '#ec4899',
              cyan: '#06b6d4',
            };
            return colorMap[nodeData?.color] || '#64748b';
          }}
          maskColor="#0f172a99"
          style={{
            background: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>

      {/* Custom Styles */}
      <style jsx global>{`
        .canvas-viewport .react-flow__node {
          cursor: pointer;
        }

        .canvas-viewport .react-flow__node.selected {
          box-shadow: 0 0 0 2px #3b82f6;
        }

        .canvas-viewport .react-flow__handle {
          width: 10px;
          height: 10px;
          background: #64748b;
          border: 2px solid #1e293b;
        }

        .canvas-viewport .react-flow__handle-connecting {
          background: #3b82f6;
        }

        .canvas-viewport .react-flow__handle-valid {
          background: #10b981;
        }

        .canvas-viewport .react-flow__edge {
          cursor: pointer;
        }

        .canvas-viewport .react-flow__edge:hover .react-flow__edge-path {
          stroke: #ef4444;
          stroke-width: 3;
        }

        .canvas-viewport .react-flow__edge.selected .react-flow__edge-path {
          stroke: #3b82f6;
          stroke-width: 3;
        }

        .canvas-viewport .react-flow__edge-text {
          fill: #f1f5f9;
          font-size: 10px;
        }

        .canvas-viewport .react-flow__controls button {
          background: #334155;
          border: none;
          color: #f1f5f9;
        }

        .canvas-viewport .react-flow__controls button:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}
