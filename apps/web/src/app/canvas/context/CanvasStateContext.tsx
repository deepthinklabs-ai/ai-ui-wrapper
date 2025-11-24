'use client';

/**
 * Canvas State Context
 *
 * Phase 3: Eliminates props drilling by providing centralized state management.
 * Reduces CanvasShell props from 16 to 0 by using context.
 *
 * Provides:
 * - Canvas list and operations
 * - Nodes list and operations
 * - Edges list and operations
 * - Loading states
 * - Error states
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type {
  Canvas,
  CanvasNode,
  CanvasEdge,
  CanvasId,
  NodeId,
  EdgeId,
  CanvasNodeType,
} from '../types';
import type { LoadingState, CanvasError } from '../hooks/useCanvasState';

// Canvas operations interface
interface CanvasOperations {
  current: Canvas | null;
  list: Canvas[];
  select: (canvas: Canvas | null) => void;
  create: () => void;
  update: (id: CanvasId, updates: Partial<Canvas>) => Promise<boolean>;
  delete: (id: CanvasId) => Promise<boolean>;
}

// Node operations interface
interface NodeOperations {
  list: CanvasNode[];
  add: (type: CanvasNodeType, position: { x: number; y: number }, config?: any) => Promise<CanvasNode | null>;
  update: (id: NodeId, updates: Partial<CanvasNode>) => Promise<boolean>;
  delete: (id: NodeId) => Promise<boolean>;
  duplicate: (id: NodeId) => Promise<CanvasNode | null>;
}

// Edge operations interface
interface EdgeOperations {
  list: CanvasEdge[];
  add: (from: NodeId, to: NodeId, config?: Partial<CanvasEdge>) => Promise<CanvasEdge | null>;
  update: (id: EdgeId, updates: Partial<CanvasEdge>) => Promise<boolean>;
  delete: (id: EdgeId) => Promise<boolean>;
}

// State management interface
interface StateManagement {
  loading: LoadingState;
  error: CanvasError | null;
  isLoading: boolean;
  clearError: () => void;
}

// Complete context value
export interface CanvasStateContextValue {
  canvas: CanvasOperations;
  nodes: NodeOperations;
  edges: EdgeOperations;
  state: StateManagement;
  // Legacy loading prop for backward compatibility
  loading: boolean;
}

const CanvasStateContext = createContext<CanvasStateContextValue | null>(null);

interface CanvasStateProviderProps {
  value: CanvasStateContextValue;
  children: ReactNode;
}

/**
 * Canvas State Provider
 * Wraps the Canvas page to provide centralized state
 */
export function CanvasStateProvider({ value, children }: CanvasStateProviderProps) {
  return (
    <CanvasStateContext.Provider value={value}>
      {children}
    </CanvasStateContext.Provider>
  );
}

/**
 * Hook to access Canvas state and operations
 *
 * @throws Error if used outside CanvasStateProvider
 */
export function useCanvasContext(): CanvasStateContextValue {
  const context = useContext(CanvasStateContext);

  if (!context) {
    throw new Error('useCanvasContext must be used within CanvasStateProvider');
  }

  return context;
}

/**
 * Convenience hooks for specific parts of context
 */
export function useCanvasOperations() {
  const { canvas } = useCanvasContext();
  return canvas;
}

export function useNodeOperations() {
  const { nodes } = useCanvasContext();
  return nodes;
}

export function useEdgeOperations() {
  const { edges } = useCanvasContext();
  return edges;
}

export function useCanvasLoadingState() {
  const { state } = useCanvasContext();
  return state;
}
