'use client';

/**
 * Canvas Context
 *
 * Provides canvas state and operations to all canvas components,
 * including node components and modals.
 */

import React, { createContext, useContext } from 'react';
import type {
  CanvasNode,
  CanvasEdge,
  NodeId,
  EdgeId,
  CanvasNodeType,
} from '../types';

interface CanvasContextValue {
  // Nodes
  nodes: CanvasNode[];
  onAddNode: (type: CanvasNodeType, position: { x: number; y: number }, config?: any) => Promise<CanvasNode | null>;
  onUpdateNode: (id: NodeId, updates: Partial<CanvasNode>) => Promise<boolean>;
  onDeleteNode: (id: NodeId) => Promise<boolean>;
  onDuplicateNode: (id: NodeId) => Promise<CanvasNode | null>;

  // Edges
  edges: CanvasEdge[];
  onAddEdge: (from: NodeId, to: NodeId, config?: Partial<CanvasEdge>) => Promise<CanvasEdge | null>;
  onUpdateEdge: (id: EdgeId, updates: Partial<CanvasEdge>) => Promise<boolean>;
  onDeleteEdge: (id: EdgeId) => Promise<boolean>;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function CanvasProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: CanvasContextValue;
}) {
  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvasContext() {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within a CanvasProvider');
  }
  return context;
}
