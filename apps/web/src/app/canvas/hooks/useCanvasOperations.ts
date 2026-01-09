/**
 * useCanvasOperations Hook
 *
 * Phase 3, Fix #2: Centralizes all event handlers and operations for Canvas.
 * Consolidates scattered handlers from CanvasShell into a single, reusable hook.
 *
 * Benefits:
 * - Single source of truth for all Canvas operations
 * - Reusable across components
 * - Easier to test
 * - Cleaner component code
 */

import { useCallback, useState } from 'react';
import { useCanvasContext } from '../context/CanvasStateContext';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { CanvasNodeType, NodeId } from '../types';

export interface UseCanvasOperationsResult {
  // Node selection state
  selectedNodeId: NodeId | null;
  setSelectedNodeId: (id: NodeId | null) => void;

  // Event handlers
  handleNodeClick: (nodeId: NodeId) => void;
  handleCanvasClick: () => void;
  handleAddNodeFromPalette: (type: CanvasNodeType) => Promise<void>;
  handleNodesChange: (changes: NodeChange[]) => void;
  handleEdgesChange: (changes: EdgeChange[]) => void;
  handleConnect: (connection: Connection) => Promise<void>;

  // Duplicate toast state
  showDuplicateToast: boolean;
  setShowDuplicateToast: (show: boolean) => void;

  // Inspector actions
  handleUpdateSelectedNode: (updates: any) => Promise<boolean>;
  handleDeleteSelectedNode: () => void;
  handleDuplicateSelectedNode: () => void;
}

interface UseCanvasOperationsOptions {
  showInspector: boolean;
  setShowInspector: (show: boolean) => void;
}

export function useCanvasOperations({
  showInspector,
  setShowInspector,
}: UseCanvasOperationsOptions): UseCanvasOperationsResult {
  const { nodes: nodeOps, edges: edgeOps } = useCanvasContext();

  // Local state
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [showDuplicateToast, setShowDuplicateToast] = useState(false);

  /**
   * Handle node click - select node and show inspector
   */
  const handleNodeClick = useCallback(
    (nodeId: NodeId) => {
      setSelectedNodeId(nodeId);
      if (!showInspector) {
        setShowInspector(true);
      }
    },
    [showInspector, setShowInspector]
  );

  /**
   * Handle canvas click - deselect node
   */
  const handleCanvasClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  /**
   * Handle node addition from palette - add at center of viewport
   */
  const handleAddNodeFromPalette = useCallback(
    async (type: CanvasNodeType) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const newNode = await nodeOps.add(type, { x: centerX, y: centerY });
      if (newNode) {
        setSelectedNodeId(newNode.id);
        setShowInspector(true);
      }
    },
    [nodeOps, setShowInspector]
  );

  /**
   * Handle node changes from React Flow (position updates, deletions)
   */
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      changes.forEach((change) => {
        if (change.type === 'position' && 'position' in change && change.position) {
          nodeOps.update(change.id, { position: change.position });
        } else if (change.type === 'remove') {
          nodeOps.delete(change.id);
        }
      });
    },
    [nodeOps]
  );

  /**
   * Handle edge changes from React Flow (deletions)
   */
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      changes.forEach((change) => {
        if (change.type === 'remove') {
          edgeOps.delete(change.id);
        }
      });
    },
    [edgeOps]
  );

  /**
   * Handle new edge connection with duplicate detection
   */
  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (connection.source && connection.target) {
        const newEdge = await edgeOps.add(connection.source, connection.target, {
          from_port: connection.sourceHandle || undefined,
          to_port: connection.targetHandle || undefined,
        });

        // Show duplicate toast if edge creation returned null (duplicate detected)
        if (newEdge === null) {
          setShowDuplicateToast(true);
          setTimeout(() => setShowDuplicateToast(false), 3000);
        }
      }
    },
    [edgeOps]
  );

  /**
   * Update selected node (for inspector)
   */
  const handleUpdateSelectedNode = useCallback(
    async (updates: any): Promise<boolean> => {
      if (selectedNodeId) {
        return await nodeOps.update(selectedNodeId, updates);
      }
      return false;
    },
    [selectedNodeId, nodeOps]
  );

  /**
   * Delete selected node (for inspector)
   */
  const handleDeleteSelectedNode = useCallback(() => {
    if (selectedNodeId) {
      nodeOps.delete(selectedNodeId);
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, nodeOps]);

  /**
   * Duplicate selected node (for inspector)
   */
  const handleDuplicateSelectedNode = useCallback(() => {
    if (selectedNodeId) {
      nodeOps.duplicate(selectedNodeId);
    }
  }, [selectedNodeId, nodeOps]);

  return {
    // State
    selectedNodeId,
    setSelectedNodeId,
    showDuplicateToast,
    setShowDuplicateToast,

    // Event handlers
    handleNodeClick,
    handleCanvasClick,
    handleAddNodeFromPalette,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,

    // Inspector actions
    handleUpdateSelectedNode,
    handleDeleteSelectedNode,
    handleDuplicateSelectedNode,
  };
}
