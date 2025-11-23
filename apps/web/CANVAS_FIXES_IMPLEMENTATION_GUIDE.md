# Canvas Feature - Implementation Guide for Critical Fixes

This document provides concrete code examples for implementing the critical fixes identified in the architecture analysis.

---

## Fix 1: Cascade Delete Edges When Node Is Deleted

### Problem
When a node is deleted, its connected edges remain in the database, creating orphaned records.

### Location
`src/app/canvas/hooks/useCanvasNodes.ts` - `deleteNode` function (lines 184-211)

### Current Code
```typescript
const deleteNode = useCallback(
  async (id: NodeId): Promise<boolean> => {
    if (!canvasId) return false;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('canvas_nodes')
        .delete()
        .eq('id', id)
        .eq('canvas_id', canvasId);

      if (error) throw error;

      // Remove from local state
      setNodes(prev => prev.filter(node => node.id !== id));

      return true;
    } catch (err) {
      console.error('[useCanvasNodes] Error deleting node:', err);
      return false;
    } finally {
      setLoading(false);
    }
  },
  [canvasId]
);
```

### Fixed Code
```typescript
const deleteNode = useCallback(
  async (id: NodeId): Promise<boolean> => {
    if (!canvasId) return false;

    setLoading(true);

    try {
      // Step 1: Delete all edges connected to this node
      const { error: edgeDeleteError } = await supabase
        .from('canvas_edges')
        .delete()
        .or(`from_node_id.eq.${id},to_node_id.eq.${id}`);

      if (edgeDeleteError) throw edgeDeleteError;

      // Step 2: Delete the node itself
      const { error: nodeDeleteError } = await supabase
        .from('canvas_nodes')
        .delete()
        .eq('id', id)
        .eq('canvas_id', canvasId);

      if (nodeDeleteError) throw nodeDeleteError;

      // Step 3: Update local state (remove node and its edges)
      setNodes(prev => prev.filter(node => node.id !== id));

      return true;
    } catch (err) {
      console.error('[useCanvasNodes] Error deleting node:', err);
      return false;
    } finally {
      setLoading(false);
    }
  },
  [canvasId]
);
```

### Validation
After deletion, verify:
```sql
-- Should return 0 rows
SELECT * FROM canvas_edges
WHERE from_node_id = '<deleted_node_id>'
   OR to_node_id = '<deleted_node_id>';
```

### Testing
```typescript
it('should delete node and cascade-delete connected edges', async () => {
  const nodeA = await addNode('GENESIS_BOT', { x: 0, y: 0 });
  const nodeB = await addNode('GENESIS_BOT', { x: 100, y: 100 });

  const edge = await addEdge(nodeA.id, nodeB.id);
  expect(edges).toHaveLength(1);

  await deleteNode(nodeA.id);

  expect(nodes).not.toContainEqual(nodeA);
  expect(edges).toHaveLength(0); // Edge should be deleted too
});
```

---

## Fix 2: Multi-Node Position Update Debouncing

### Problem
Using a single timer (`dragEndTimerRef`) means only the last node's position change is saved. Earlier changes are overwritten.

### Location
`src/app/canvas/components/CanvasViewport.tsx` - `handleNodesChange` function (lines 154-178)

### Current Code
```typescript
// Track drag end timer for debounced database updates
const dragEndTimerRef = useRef<NodeJS.Timeout | null>(null);

const handleNodesChange = useCallback(
  (changes: NodeChange[]) => {
    // Apply changes to local React Flow state immediately
    setReactFlowNodes((nds) => applyNodeChanges(changes, nds));

    // Debounce database updates for position changes
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        if (dragEndTimerRef.current) {
          clearTimeout(dragEndTimerRef.current);  // ← PROBLEM
        }

        dragEndTimerRef.current = setTimeout(() => {
          onNodesChange([change]);  // ← Only last change saved
        }, 500);
      } else if (change.type === 'remove') {
        onNodesChange([change]);
      }
    });
  },
  [onNodesChange]
);
```

### Fixed Code
```typescript
// Track drag end timers per node (Map instead of single ref)
const dragEndTimersRef = useRef<Map<NodeId, NodeJS.Timeout>>(new Map());

const handleNodesChange = useCallback(
  (changes: NodeChange[]) => {
    // Apply changes to local React Flow state immediately for smooth dragging
    setReactFlowNodes((nds) => applyNodeChanges(changes, nds));

    // Process each change independently
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        const nodeId = change.id;

        // Clear existing timer for this specific node (if any)
        const existingTimer = dragEndTimersRef.current.get(nodeId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Create new timer for this node
        const newTimer = setTimeout(() => {
          // Save this node's position to database
          onNodesChange([change]);

          // Clean up the timer reference
          dragEndTimersRef.current.delete(nodeId);
        }, 500);

        // Store timer reference for this node
        dragEndTimersRef.current.set(nodeId, newTimer);

        console.debug(`[CanvasViewport] Scheduled position update for node ${nodeId}`);
      } else if (change.type === 'remove') {
        // Handle node removal immediately
        onNodesChange([change]);
      }
    });
  },
  [onNodesChange]
);

// Cleanup timers on component unmount
useEffect(() => {
  return () => {
    dragEndTimersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    dragEndTimersRef.current.clear();
    console.debug('[CanvasViewport] Cleaned up position update timers');
  };
}, []);
```

### Testing
```typescript
it('should save position updates for all dragged nodes', async () => {
  const nodeA = await addNode('GENESIS_BOT', { x: 0, y: 0 });
  const nodeB = await addNode('GENESIS_BOT', { x: 100, y: 100 });

  // Simulate dragging both nodes
  act(() => {
    handleNodesChange([
      { id: nodeA.id, type: 'position', position: { x: 50, y: 50 }, dragging: false },
      { id: nodeB.id, type: 'position', position: { x: 150, y: 150 }, dragging: false },
    ]);
  });

  // Wait for debounce
  await new Promise(resolve => setTimeout(resolve, 600));

  // Both positions should be updated
  expect(nodes.find(n => n.id === nodeA.id)?.position).toEqual({ x: 50, y: 50 });
  expect(nodes.find(n => n.id === nodeB.id)?.position).toEqual({ x: 150, y: 150 });
});
```

---

## Fix 3: Prevent Silent Duplicate Edge Creation

### Problem
The edge duplicate check incorrectly handles undefined config values, allowing duplicates to be created silently.

### Location
`src/app/canvas/hooks/useCanvasEdges.ts` - `addEdge` function (lines 61-118)

### Current Code
```typescript
const addEdge = useCallback(
  async (
    from: NodeId,
    to: NodeId,
    config?: Partial<CanvasEdge>
  ): Promise<CanvasEdge | null> => {
    if (!canvasId) return null;

    setLoading(true);

    try {
      // Check if edge already exists
      const existingEdge = edges.find(
        e =>
          e.from_node_id === from &&
          e.to_node_id === to &&
          e.from_port === config?.from_port &&  // ← undefined if config is missing
          e.to_port === config?.to_port         // ← undefined if config is missing
      );

      if (existingEdge) {
        console.warn('[useCanvasEdges] Edge already exists');
        return existingEdge;  // ← Silent return
      }

      // ... rest of implementation
    } catch (err) {
      console.error('[useCanvasEdges] Error adding edge:', err);
      return null;
    } finally {
      setLoading(false);
    }
  },
  [canvasId, edges]
);
```

### Fixed Code
```typescript
const addEdge = useCallback(
  async (
    from: NodeId,
    to: NodeId,
    config?: Partial<CanvasEdge>
  ): Promise<CanvasEdge | null> => {
    if (!canvasId) return null;

    setLoading(true);

    try {
      // Normalize port values (use null for undefined)
      const fromPort = config?.from_port ?? null;
      const toPort = config?.to_port ?? null;

      // Check if edge already exists with these exact endpoints
      const existingEdge = edges.find(
        e =>
          e.from_node_id === from &&
          e.to_node_id === to &&
          e.from_port === fromPort &&  // ← Now compares null to null correctly
          e.to_port === toPort         // ← Now compares null to null correctly
      );

      if (existingEdge) {
        console.warn('[useCanvasEdges] Edge already exists', {
          from,
          to,
          fromPort,
          toPort,
          existingId: existingEdge.id,
          timestamp: new Date().toISOString(),
        });
        return null;  // ← Return null instead of existing edge
      }

      const newEdge = {
        canvas_id: canvasId,
        from_node_id: from,
        to_node_id: to,
        from_port: fromPort,
        to_port: toPort,
        label: config?.label,
        animated: config?.animated || false,
        condition: config?.condition,
        transform: config?.transform,
        metadata: config?.metadata || {},
      };

      const { data, error } = await supabase
        .from('canvas_edges')
        .insert(newEdge)
        .select()
        .single();

      if (error) throw error;

      setEdges(prev => [...prev, data]);

      console.debug('[useCanvasEdges] Edge created', {
        id: data.id,
        from,
        to,
        fromPort,
        toPort,
      });

      return data;
    } catch (err) {
      console.error('[useCanvasEdges] Error adding edge:', err);
      return null;
    } finally {
      setLoading(false);
    }
  },
  [canvasId, edges]
);
```

### Testing
```typescript
it('should prevent duplicate edges', async () => {
  const nodeA = await addNode('GENESIS_BOT', { x: 0, y: 0 });
  const nodeB = await addNode('GENESIS_BOT', { x: 100, y: 100 });

  // First edge creation
  const edge1 = await addEdge(nodeA.id, nodeB.id);
  expect(edge1).not.toBeNull();
  expect(edges).toHaveLength(1);

  // Attempt duplicate without ports
  const edge2 = await addEdge(nodeA.id, nodeB.id);
  expect(edge2).toBeNull();  // Should be rejected
  expect(edges).toHaveLength(1);  // No new edge created

  // Different ports should be allowed
  const edge3 = await addEdge(nodeA.id, nodeB.id, {
    from_port: 'output1',
    to_port: 'input1'
  });
  expect(edge3).not.toBeNull();
  expect(edges).toHaveLength(2);  // New edge created
});
```

---

## Fix 4: Consolidate Loading States

### Problem
Three independent loading states (canvases, nodes, edges) make it unclear what's being loaded.

### Location
Multiple files:
- `src/app/canvas/hooks/useCanvas.ts` - has `loading` state
- `src/app/canvas/hooks/useCanvasNodes.ts` - has `loading` state
- `src/app/canvas/hooks/useCanvasEdges.ts` - has `loading` state

### Solution: Create Unified State Hook

```typescript
// src/app/canvas/hooks/useCanvasLoadingState.ts
import { useState, useCallback } from 'react';

export interface LoadingState {
  canvases: boolean;
  nodes: boolean;
  edges: boolean;
}

export function useCanvasLoadingState() {
  const [loading, setLoading] = useState<LoadingState>({
    canvases: false,
    nodes: false,
    edges: false,
  });

  const setCanvasesLoading = useCallback((value: boolean) => {
    setLoading(prev => ({ ...prev, canvases: value }));
  }, []);

  const setNodesLoading = useCallback((value: boolean) => {
    setLoading(prev => ({ ...prev, nodes: value }));
  }, []);

  const setEdgesLoading = useCallback((value: boolean) => {
    setLoading(prev => ({ ...prev, edges: value }));
  }, []);

  // Computed states
  const isLoading = Object.values(loading).some(v => v);
  const allLoaded = !Object.values(loading).some(v => v);
  const partiallyLoaded = isLoading && !allLoaded;

  return {
    loading,
    setCanvasesLoading,
    setNodesLoading,
    setEdgesLoading,
    isLoading,
    allLoaded,
    partiallyLoaded,
  };
}
```

### Updated Hook Usage

```typescript
// src/app/canvas/hooks/useCanvas.ts (updated)
export function useCanvas(userId: string | undefined, setLoading: (value: boolean) => void): UseCanvasResult {
  // ... existing code ...

  const refreshCanvases = useCallback(async () => {
    if (!userId) return;

    setLoading(true);  // ← Use passed function instead of local state
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('canvases')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCanvases(data || []);

      if (!currentCanvas && data && data.length > 0) {
        setCurrentCanvas(data[0]);
      }
    } catch (err: any) {
      console.error('[useCanvas] Error fetching canvases:', err);
      setError(err.message || err.code || 'Failed to load canvases');
    } finally {
      setLoading(false);
    }
  }, [userId, currentCanvas, setLoading]);

  // ... rest of implementation ...
}
```

### Usage in Page Component

```typescript
// src/app/canvas/page.tsx (updated)
export default function CanvasPage() {
  const { user } = useAuthSession();
  const loadingState = useCanvasLoadingState();

  const canvas = useCanvas(user?.id, loadingState.setCanvasesLoading);
  const nodes = useCanvasNodes(canvas.currentCanvas?.id, loadingState.setNodesLoading);
  const edges = useCanvasEdges(canvas.currentCanvas?.id, loadingState.setEdgesLoading);

  if (loadingState.isLoading && !canvas.canvases.length) {
    return <CanvasLoadingScreen />;
  }

  return (
    <CanvasShell
      canvases={canvas.canvases}
      currentCanvas={canvas.currentCanvas}
      onSelectCanvas={canvas.selectCanvas}
      // ... other props ...
      loading={loadingState.partiallyLoaded}
    />
  );
}
```

---

## Fix 5: Unified Error Handling

### Location
New file: `src/app/canvas/hooks/useCanvasErrorState.ts`

### Implementation

```typescript
export interface CanvasError {
  id: string;
  source: 'canvas' | 'nodes' | 'edges' | 'general';
  severity: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
  details?: any;
  timestamp: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useCanvasErrorState() {
  const [errors, setErrors] = useState<CanvasError[]>([]);

  const addError = useCallback((error: Omit<CanvasError, 'id' | 'timestamp'>) => {
    const errorWithMeta: CanvasError = {
      ...error,
      id: Math.random().toString(36),
      timestamp: Date.now(),
    };

    setErrors(prev => [...prev, errorWithMeta]);

    // Auto-clear non-critical errors after 5 seconds
    if (error.severity !== 'error') {
      setTimeout(() => {
        clearError(errorWithMeta.id);
      }, 5000);
    }

    return errorWithMeta.id;
  }, []);

  const clearError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const hasErrors = errors.some(e => e.severity === 'error');
  const latestError = errors[errors.length - 1];

  return {
    errors,
    addError,
    clearError,
    clearAllErrors,
    hasErrors,
    latestError,
  };
}
```

### Usage Example

```typescript
// In useCanvas hook
const handleError = (err: any, source: CanvasError['source']) => {
  addError({
    source,
    severity: 'error',
    message: err.message || 'An unexpected error occurred',
    code: err.code,
    details: err,
    action: {
      label: 'Retry',
      onClick: () => refreshCanvases(),
    },
  });
};

try {
  // ... operation ...
} catch (err) {
  handleError(err, 'canvas');
}
```

---

## Implementation Checklist

### Phase 1: Critical Fixes (1-2 days)
- [ ] Fix cascade delete edges (Fix 1)
- [ ] Fix multi-node drag debouncing (Fix 2)
- [ ] Fix duplicate edge prevention (Fix 3)
- [ ] Test each fix with unit tests
- [ ] Deploy to staging

### Phase 2: State Management (2-3 days)
- [ ] Implement unified loading state (Fix 4)
- [ ] Implement unified error handling (Fix 5)
- [ ] Update hooks to use new state management
- [ ] Update components to use new states
- [ ] Test integration

### Phase 3: Architecture Refactoring (3-5 days)
- [ ] Create unified CanvasStateContext
- [ ] Migrate from props drilling to context
- [ ] Separate event handlers into handler modules
- [ ] Full integration testing

### Deployment Steps
1. Deploy Phase 1 fixes first (lower risk)
2. Monitor for any issues
3. Deploy Phase 2 changes
4. Monitor and get stakeholder feedback
5. Plan Phase 3 refactoring

---

## Monitoring & Validation

### Metrics to Track
```typescript
// Add to error tracking
- Edge cascade delete success rate
- Position update debounce effectiveness
- Edge duplicate prevention triggers
- Loading state transitions
- Error recovery attempts
```

### Logging Points
```typescript
// Debug logging added
console.debug('[CanvasViewport] Scheduled position update for node ${nodeId}');
console.debug('[useCanvasEdges] Edge created', { id, from, to });
console.debug('[useCanvasNodes] Cascade deleting edges for node ${id}');
```

### Database Validation Queries
```sql
-- Check for orphaned edges (should be empty)
SELECT * FROM canvas_edges e
WHERE NOT EXISTS (SELECT 1 FROM canvas_nodes n WHERE n.id = e.from_node_id)
   OR NOT EXISTS (SELECT 1 FROM canvas_nodes n WHERE n.id = e.to_node_id);

-- Check position update frequency
SELECT node_id, COUNT(*) as update_count
FROM audit_log
WHERE operation = 'update_position'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY node_id;

-- Check for duplicate edges
SELECT from_node_id, to_node_id, from_port, to_port, COUNT(*) as count
FROM canvas_edges
GROUP BY from_node_id, to_node_id, from_port, to_port
HAVING COUNT(*) > 1;
```

---

## Rollback Plan

If any fix causes issues:

### Rollback Fix 1 (Cascade Delete)
1. Keep the edge deletion database queries
2. But remove from `deleteNode` function
3. Let edges remain orphaned (original behavior)
4. Add background job to clean up orphaned edges later

### Rollback Fix 2 (Debouncing)
1. Revert to single `dragEndTimerRef`
2. This may lose some position updates, but UI will be stable
3. Re-test with slower debounce timing (1000ms instead of 500ms)

### Rollback Fix 3 (Duplicate Prevention)
1. Allow duplicates again (return existing edge)
2. Add UI warning when duplicate is prevented
3. Let users decide to create edge or not

### Rollback Fix 4-5 (State Management)
1. Revert to individual loading states
2. Keep error handling as-is
3. Components will continue working as before
