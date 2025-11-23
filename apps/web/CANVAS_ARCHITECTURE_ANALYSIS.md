# Canvas Feature Architecture Analysis Report

**Date:** November 23, 2025
**Scope:** Canvas workflow builder feature - modularity, separation of concerns, and dependency analysis

---

## Executive Summary

The Canvas feature demonstrates a **semi-modular architecture** with clear component separation but significant **data flow coupling** and potential brittleness. While the separation of concerns at the component level is good, the hook-based state management and context provider create tight dependencies that could cause cascading failures. The feature has **critical vulnerabilities** around state synchronization and would benefit from architectural refactoring to improve resilience and testability.

**Risk Level:** Medium-High
**Modularity Score:** 6.5/10
**Separation of Concerns:** 7/10
**Maintainability Score:** 6/10

---

## 1. Current Architecture Overview

### 1.1 Directory Structure

```
src/app/canvas/
├── components/           # UI components
│   ├── CanvasShell.tsx   # Main container (orchestrator)
│   ├── CanvasViewport.tsx # React Flow integration
│   ├── NodePalette.tsx    # Node selection UI
│   ├── NodeInspector.tsx  # Node configuration UI
│   ├── WorkflowControls.tsx # Top toolbar
│   ├── CanvasDebugOverlay.tsx
│   ├── CanvasHelpTooltip.tsx
│   ├── config/           # Node-specific config panels
│   ├── edges/            # Custom edge types
│   ├── modals/           # Modal dialogs
│   └── nodes/            # Custom node components
├── hooks/               # State management
│   ├── useCanvas.ts     # Canvas CRUD operations
│   ├── useCanvasNodes.ts # Node CRUD operations
│   └── useCanvasEdges.ts # Edge CRUD operations
├── context/            # React Context
│   └── CanvasContext.tsx # Provides state to nested components
├── lib/                # Utilities
│   └── nodeRegistry.ts # Node definitions & metadata
├── types/              # Type definitions
│   └── index.ts        # Comprehensive type system
└── page.tsx            # Route entry point
```

### 1.2 Component Hierarchy

```
CanvasPage (page.tsx)
│
├─ useCanvas() ─────────────────────────┐
├─ useCanvasNodes() ───────────────────┤
├─ useCanvasEdges() ───────────────────┤
│                                       ▼
└─ CanvasShell
    │
    ├─ WorkflowControls (top toolbar)
    │   ├─ Canvas selector
    │   ├─ Create/Delete canvas
    │   ├─ Workflow mode toggle
    │   └─ View toggles
    │
    ├─ NodePalette (left sidebar)
    │   └─ NODE_DEFINITIONS from nodeRegistry
    │
    ├─ CanvasProvider
    │   │
    │   └─ CanvasViewport (React Flow)
    │       ├─ GenesisBotNode (custom node)
    │       ├─ DeletableEdge (custom edge)
    │       └─ React Flow UI (controls, minimap)
    │
    └─ NodeInspector (right sidebar)
        ├─ GenesisBotConfigPanel
        └─ Node-specific configs
```

### 1.3 Data Flow

```
User Action          Hook/Handler           Database          Local State
    │                    │                      │                  │
Add Node ────────→ onAddNode() ────────→ Supabase ────────→ setNodes()
    │              (useCanvasNodes)       INSERT         state update
    │
Update Node ──────→ onUpdateNode() ─────→ Supabase ────────→ setNodes()
    │              (useCanvasNodes)       UPDATE         state update
    │
Delete Node ──────→ onDeleteNode() ──────→ Supabase ────────→ setNodes()
    │              (useCanvasNodes)       DELETE         state update
    │
Move Node ────────→ onNodesChange() ────→ onUpdateNode() ──→ setNodes()
    │              (CanvasViewport)       (debounced)    state update
    │
Connect Nodes ─────→ onConnect() ────────→ onAddEdge() ────→ setEdges()
    │              (CanvasViewport)       (useCanvasEdges)  state update
```

---

## 2. Modularity Analysis

### 2.1 Well-Separated Components ✅

| Component | Responsibility | Coupling | Score |
|-----------|-----------------|----------|-------|
| **NodeRegistry** | Node type definitions & metadata | Low | 9/10 |
| **Types/index.ts** | Type definitions | Low | 10/10 |
| **NodePalette** | Node selection UI only | Medium | 8/10 |
| **CanvasViewport** | React Flow integration | Medium | 7/10 |
| **NodeInspector** | Node config UI | Medium | 7/10 |

**Strengths:**
- **NodeRegistry** is well-isolated and provides a single source of truth for node definitions
- Type system is comprehensive and clearly defined
- UI components have focused responsibilities
- React Flow integration is reasonably well-encapsulated

### 2.2 Tightly Coupled Areas ⚠️

| Area | Issue | Risk | Example |
|------|-------|------|---------|
| **Hooks → Components** | Components tightly bound to hook signatures | High | `onAddNode`, `onUpdateNode` passed through 12 props in `CanvasShell` |
| **CanvasShell → Child Components** | Props drilling is excessive | High | Node operations passed to 4 different components |
| **Context Usage** | Late binding of operations creates indirection | Medium | `useCanvasContext()` duplicates already-passed props |
| **React Flow Integration** | Tight coupling to CanvasViewport | High | Node changes must be mapped between formats |

**Critical Issue #1: Props Drilling in CanvasShell**

```typescript
// File: CanvasShell.tsx, lines 32-56
interface CanvasShellProps {
  // 14 callback props - excessive coupling!
  onSelectCanvas: (canvas: Canvas | null) => void;
  onCreateCanvas: () => void;
  onUpdateCanvas: (id: CanvasId, updates: Partial<Canvas>) => Promise<boolean>;
  onDeleteCanvas: (id: CanvasId) => Promise<boolean>;

  // Node operations
  onAddNode: (type: CanvasNodeType, position: { x: number; y: number }, config?: any) => Promise<CanvasNode | null>;
  onUpdateNode: (id: NodeId, updates: Partial<CanvasNode>) => Promise<boolean>;
  onDeleteNode: (id: NodeId) => Promise<boolean>;
  onDuplicateNode: (id: NodeId) => Promise<CanvasNode | null>;

  // Edge operations
  onAddEdge: (from: NodeId, to: NodeId, config?: Partial<CanvasEdge>) => Promise<CanvasEdge | null>;
  onUpdateEdge: (id: EdgeId, updates: Partial<CanvasEdge>) => Promise<boolean>;
  onDeleteEdge: (id: EdgeId) => Promise<boolean>;

  // Plus 3 more data props and 1 loading prop
}
```

**Problem:** Every parent component change requires changes down the entire prop chain.

### 2.3 Hook Interdependencies

```
useCanvas()
  │
  ├─ Manages: canvases, currentCanvas
  ├─ Sets up: canvases list, auto-selects first
  └─ Called by: page.tsx

useCanvasNodes(canvasId)
  │
  ├─ Depends on: canvasId (from currentCanvas)
  ├─ Manages: nodes array, loading state
  ├─ Side effect: Triggers refresh on canvasId change
  └─ Called by: page.tsx

useCanvasEdges(canvasId)
  │
  ├─ Depends on: canvasId (from currentCanvas)
  ├─ Manages: edges array, loading state
  ├─ Side effect: Triggers refresh on canvasId change
  └─ Called by: page.tsx
```

**Issue:** All three hooks manage independent loading states and have implicit dependencies on `currentCanvas` being set correctly. If `currentCanvas` changes, nodes and edges must refetch independently.

### 2.4 Context Duplication

```typescript
// File: CanvasContext.tsx, lines 19-32
interface CanvasContextValue {
  nodes: CanvasNode[];
  onAddNode: (...) => Promise<CanvasNode | null>;  // Duplicate from CanvasShell props!
  onUpdateNode: (...) => Promise<boolean>;          // Duplicate
  onDeleteNode: (...) => Promise<boolean>;          // Duplicate
  onDuplicateNode: (...) => Promise<CanvasNode | null>; // Duplicate
  edges: CanvasEdge[];
  onAddEdge: (...) => Promise<CanvasEdge | null>;  // Duplicate
  onUpdateEdge: (...) => Promise<boolean>;          // Duplicate
  onDeleteEdge: (...) => Promise<boolean>;          // Duplicate
}

// File: CanvasShell.tsx, lines 151-162
<CanvasProvider
  value={{
    nodes,
    edges,
    onAddNode,      // Being passed as-is from props
    onUpdateNode,   // Being passed as-is from props
    onDeleteNode,   // Being passed as-is from props
    // ... etc
  }}
>
```

**Problem:** The context provides the same operations already passed as props. This creates unnecessary indirection and makes it unclear which source is authoritative.

---

## 3. Potential Issues & Breaking Changes

### 3.1 Position Update Debouncing Can Cause Data Loss

**File:** `CanvasViewport.tsx`, lines 160-170

```typescript
const handleNodesChange = useCallback(
  (changes: NodeChange[]) => {
    // Apply changes to local React Flow state immediately for smooth dragging
    setReactFlowNodes((nds) => applyNodeChanges(changes, nds));

    // Debounce database updates for position changes
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        if (dragEndTimerRef.current) {
          clearTimeout(dragEndTimerRef.current);  // ← PROBLEM: Only one timer!
        }

        dragEndTimerRef.current = setTimeout(() => {
          onNodesChange([change]);  // ← Only processes last change
        }, 500);
      }
    });
  },
  [onNodesChange]
);
```

**Issue:** Using a single `dragEndTimerRef` means only the LAST position change is saved. If a user drags multiple nodes quickly, all but the last one are lost.

**Scenario:**
1. Drag Node A → position {100, 100}
2. Drag Node B → position {200, 200}
3. Both changes call `handleNodesChange`
4. First timer for Node A is set
5. Node B's timer OVERWRITES the first one
6. Node A's position change never gets saved to database

**Risk:** Medium (affects multi-node operations)

### 3.2 Node Deletion Without Edge Cascading

**File:** `CanvasShell.tsx`, lines 175-176

```typescript
} else if (change.type === 'remove') {
  onDeleteNode(change.id);  // Only deletes node, not connected edges!
}
```

**File:** `useCanvasNodes.ts`, lines 184-211

```typescript
const deleteNode = useCallback(
  async (id: NodeId): Promise<boolean> => {
    // ... deletes only the node
    const { error } = await supabase
      .from('canvas_nodes')
      .delete()
      .eq('id', id)
      .eq('canvas_id', canvasId);
    // No cascade delete of edges!
  },
  [canvasId]
);
```

**Issue:** Deleting a node leaves orphaned edges in the database. These edges will appear in the UI as connecting to non-existent nodes.

**Scenario:**
1. Create Node A → Node B edge
2. Delete Node A
3. Edge still exists in database
4. CanvasViewport tries to render edge with missing source node
5. Potential rendering error or dangling connection

**Risk:** High (data integrity issue)

### 3.3 Race Condition in Canvas Selection

**File:** `useCanvas.ts`, lines 51-54

```typescript
useEffect(() => {
  if (!userId) return;
  refreshCanvases();
}, [userId]);

// But later in refreshCanvases()...
// Auto-select first canvas if none selected
if (!currentCanvas && data && data.length > 0) {
  setCurrentCanvas(data[0]);  // Auto-select, but...
}
```

**Issue:** When a user switches from one canvas to another:
1. `currentCanvas` changes → triggers `useCanvasNodes` refresh
2. Before nodes finish loading, `useCanvasEdges` might fetch for old canvas
3. Results can interleave

**Race Condition:**
```
Time  Action
─────────────────────────────────────────
t1    User clicks Canvas B
t2    useCanvas: setCurrentCanvas(B)
t3    useCanvasNodes: starts fetching nodes for B
t4    But currentCanvas dependency might be stale
t5    useCanvasEdges: starts fetching edges for old canvas still
t6    Network responses arrive out of order
      → Could render nodes from B with edges from A
```

**Risk:** Medium (data consistency issue)

### 3.4 React Flow Format Conversion Issues

**File:** `CanvasViewport.tsx`, lines 84-121

```typescript
// Convert CanvasNode[] to React Flow Node[]
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
      // ...
    };
  });
  setReactFlowNodes(convertedNodes);
}, [nodes, selectedNodeId, nodeTypes]);
```

**Issue:** The conversion duplicates data between `CanvasNode` and React Flow `Node`. Changes to the conversion logic must be manually synchronized:

| Data | Stored In | Conversion | Risk |
|------|-----------|-----------|------|
| node.config | CanvasNode | Copied to data.config | ✅ Auto-synced |
| node.label | CanvasNode | Copied to data.label | ✅ Auto-synced |
| node.position | CanvasNode | Copied directly | ✅ Auto-synced |
| node.type | CanvasNode | Mapped to nodeType | ⚠️ Mapping required |
| node.selected | Local state | Used for isSelected | ⚠️ Must stay in sync |

**Risk:** Low-Medium (but source of confusion)

### 3.5 Edge Duplicate Check Logic Flaw

**File:** `useCanvasEdges.ts`, lines 72-84

```typescript
const addEdge = useCallback(
  async (from: NodeId, to: NodeId, config?: Partial<CanvasEdge>): Promise<CanvasEdge | null> => {
    // Check if edge already exists
    const existingEdge = edges.find(
      e =>
        e.from_node_id === from &&
        e.to_node_id === to &&
        e.from_port === config?.from_port &&  // ← Problem: config might be undefined
        e.to_port === config?.to_port         // ← Problem: ports might be undefined
    );

    if (existingEdge) {
      console.warn('[useCanvasEdges] Edge already exists');
      return existingEdge;  // ← Returns existing edge silently
    }
```

**Issue:**
- `config` is optional, so `config?.from_port` is always `undefined` when `config` is not provided
- This means the duplicate check fails to catch duplicates with the same nodes but without port specification
- The function returns the existing edge instead of creating a new one, but silently (only console.warn)

**Scenario:**
```typescript
// First connection
await onAddEdge(nodeA.id, nodeB.id);  // config undefined
// Result: Edge created with from_port: undefined, to_port: undefined

// Second connection attempt (user tries again)
await onAddEdge(nodeA.id, nodeB.id);  // config still undefined
// Expected: Get error or warning
// Actual: Returns existing edge silently, UI might show duplicate
```

**Risk:** Medium (silent failures, confusing UX)

---

## 4. Dependency Graph

### 4.1 Component Dependencies

```
Legend: ──→ depends on
        ~~→ tightly coupled
        ··→ loosely coupled

NodeRegistry
  ──→ TYPE: CanvasNodeType
  ──→ TYPE: NodeDefinition

Types/index.ts
  ──→ External: AIModel from @/lib/apiKeyStorage

CanvasShell (CENTRAL HUB)
  ~~→ CanvasViewport (passes 3 handler sets + 2 state props)
  ~~→ NodeInspector (passes 4 handlers)
  ~~→ NodePalette (passes 1 handler)
  ~~→ WorkflowControls (passes 8 props)
  ~~→ CanvasProvider (wraps children with context)

CanvasViewport
  ──→ NodeRegistry (NODE_DEFINITIONS)
  ──→ GenesisBotNode (custom node component)
  ──→ DeletableEdge (custom edge type)
  ··→ useCanvasContext() (optional, could use props)

NodeInspector
  ──→ NodeRegistry (NODE_DEFINITIONS)
  ──→ GenesisBotConfigPanel (node-specific config)
  ··→ Could benefit from useCanvasContext()

NodePalette
  ──→ NodeRegistry (NODE_DEFINITIONS, NODE_CATEGORIES)

WorkflowControls
  ──→ No dependencies (pure props-based)

CanvasContext
  ··→ Optional dependency for components

useCanvas()
  ──→ Supabase client
  ──→ currentCanvas state (implicit dependency)

useCanvasNodes()
  ──→ Supabase client
  ──→ canvasId param
  ──→ createDefaultNode() from NodeRegistry

useCanvasEdges()
  ──→ Supabase client
  ──→ canvasId param
```

### 4.2 Data Dependencies

```
Database (Supabase)
  ├─ canvases table
  │   ├─ loaded by useCanvas()
  │   └─ used to set currentCanvas
  │
  ├─ canvas_nodes table
  │   ├─ depends on: currentCanvas.id
  │   ├─ loaded by useCanvasNodes(canvasId)
  │   ├─ written by: addNode, updateNode, deleteNode
  │   └─ displayed by: CanvasViewport
  │
  ├─ canvas_edges table
  │   ├─ depends on: currentCanvas.id
  │   ├─ loaded by useCanvasEdges(canvasId)
  │   ├─ written by: addEdge, updateEdge, deleteEdge
  │   └─ displayed by: CanvasViewport
  │
  └─ canvas_templates table
      ├─ read by: useCanvas.cloneTemplate()
      ├─ creates nodes from template
      └─ TODO: Edge mapping not implemented
```

### 4.3 Dependency Flow During Initialization

```
page.tsx loads
  │
  ├─ useCanvas(userId)
  │   └─ Supabase.canvases.select() → canvases[]
  │       └─ Auto-select first canvas → currentCanvas
  │
  ├─ useCanvasNodes(currentCanvas?.id)
  │   └─ Effect: currentCanvas changed → refresh
  │       └─ Supabase.canvas_nodes.select(canvas_id) → nodes[]
  │
  ├─ useCanvasEdges(currentCanvas?.id)
  │   └─ Effect: currentCanvas changed → refresh
  │       └─ Supabase.canvas_edges.select(canvas_id) → edges[]
  │
  └─ <CanvasShell> renders
      └─ <CanvasProvider value={{nodes, edges, ...}}>
          └─ <CanvasViewport nodes={nodes} edges={edges} />
              └─ React Flow renders nodes/edges
                  └─ Maps CanvasNode → React Flow Node
```

---

## 5. State Management Issues

### 5.1 Multiple Sources of Truth

| State | Storage | Authority | Risk |
|-------|---------|-----------|------|
| nodes | useState (useCanvasNodes) | Local state | ✅ Single source |
| edges | useState (useCanvasEdges) | Local state | ✅ Single source |
| currentCanvas | useState (useCanvas) | Local state | ✅ Single source |
| selectedNodeId | useState (CanvasShell) | Local state | ✅ Single source |
| selectedEdgeId | useState (CanvasViewport) | Local state | ⚠️ Not in context |
| reactFlowNodes | useState (CanvasViewport) | Local state | ⚠️ Duplicate of nodes |
| reactFlowEdges | useState (CanvasViewport) | Local state | ⚠️ Duplicate of edges |

**Issue:** React Flow maintains its own copies of node/edge state for performance. This creates two sources of truth:
- `nodes` from useCanvasNodes
- `reactFlowNodes` in CanvasViewport state

If they diverge, the UI and underlying data will be out of sync.

**Scenario:**
```typescript
// useCanvasNodes adds node N1
setNodes([...prev, N1]);

// CanvasViewport hasn't updated yet
// But CanvasViewport still has old nodes
// User deletes N1 from React Flow
// React Flow deletes from reactFlowNodes
// But useCanvasNodes still has N1
// Deletion handler finds N1 in nodes array
// Deletes from database
// User tries to undo - can't, N1 is gone from state too
```

### 5.2 Loading State Fragmentation

```typescript
// useCanvas has its own loading state
const [loading, setLoading] = useState(false);

// useCanvasNodes has its own
const [loading, setLoading] = useState(false);

// useCanvasEdges has its own
const [loading, setLoading] = useState(false);

// CanvasViewport has its own for drag timers
const dragEndTimerRef = useRef<NodeJS.Timeout | null>(null);

// Result: No unified loading indicator
// User can't tell which operation is actually loading
```

**Issue:** Three independent loading states can lead to confusing UX:
- User sees "Loading" but doesn't know if it's canvases, nodes, or edges
- If one hook fails to clear loading, the app appears stuck forever
- No way to know if all data is loaded

---

## 6. Event Handler Isolation Issues

### 6.1 Handler Coupling in CanvasViewport

**File:** `CanvasViewport.tsx`, lines 154-178

```typescript
const handleNodesChange = useCallback(
  (changes: NodeChange[]) => {
    // Handles THREE different operations:
    // 1. Apply local state changes (React Flow interactivity)
    // 2. Debounce position updates to database
    // 3. Handle node removal

    setReactFlowNodes((nds) => applyNodeChanges(changes, nds));  // Local

    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        // Database update with debouncing
        if (dragEndTimerRef.current) {
          clearTimeout(dragEndTimerRef.current);
        }
        dragEndTimerRef.current = setTimeout(() => {
          onNodesChange([change]);  // Calls CanvasShell's handler
        }, 500);
      } else if (change.type === 'remove') {
        // Immediate database deletion
        onNodesChange([change]);
      }
    });
  },
  [onNodesChange]
);
```

**Problem:** One handler does:
- ✅ React Flow state update
- ✅ Debounced database updates (position)
- ❌ Immediate database updates (removal)

This mixing of concerns makes it hard to:
- Debug which part is failing
- Change debounce timing
- Add logging or validation
- Test individual operations

### 6.2 Edge Selection State Misalignment

**File:** `CanvasViewport.tsx`, lines 195-223

```typescript
const handleEdgesChange = useCallback(
  (changes: EdgeChange[]) => {
    setReactFlowEdges((eds) => applyEdgeChanges(changes, eds));  // Local state

    changes.forEach((change) => {
      if (change.type === 'select') {
        if (change.selected) {
          // Edge selected
          setSelectedEdgeId(change.id);
          setReactFlowNodes((nds) => nds.map((node) => ({ ...node, selected: false })));
          onCanvasClick();  // Deselect node in parent  ← Problem!
        } else {
          setSelectedEdgeId(null);
        }
      } else if (change.type === 'remove') {
        onEdgesChange([change]);
      }
    });
  },
  [onEdgesChange, onCanvasClick]
);
```

**Issue:** Selecting an edge:
1. Sets `selectedEdgeId` locally
2. Clears node selection in React Flow state
3. Calls `onCanvasClick()` to deselect in parent
4. But `selectedNodeId` in CanvasShell isn't cleared

**Result:**
- React Flow: node deselected ✅
- CanvasShell state: node still selected ⚠️
- UI will show node inspector for deselected node

---

## 7. Recommendations & Refactoring Strategy

### 7.1 Priority 1: Fix Critical Data Integrity Issues

#### 1A: Implement Cascade Delete for Edges

**Current:**
```typescript
// useCanvasNodes.ts
const deleteNode = useCallback(async (id: NodeId): Promise<boolean> => {
  // Only deletes node
  await supabase.from('canvas_nodes').delete().eq('id', id);
}, [canvasId]);
```

**Recommended:**
```typescript
const deleteNode = useCallback(async (id: NodeId): Promise<boolean> => {
  try {
    // Delete all edges connected to this node
    await supabase
      .from('canvas_edges')
      .delete()
      .or(`from_node_id.eq.${id},to_node_id.eq.${id}`);

    // Then delete the node
    await supabase
      .from('canvas_nodes')
      .delete()
      .eq('id', id)
      .eq('canvas_id', canvasId);

    // Update local state
    setNodes(prev => prev.filter(node => node.id !== id));
    setEdges(prev => prev.filter(
      edge => edge.from_node_id !== id && edge.to_node_id !== id
    ));

    return true;
  } catch (err) {
    console.error('[useCanvasNodes] Error deleting node:', err);
    return false;
  }
}, [canvasId]);
```

**Impact:** Eliminates orphaned edges, improves data integrity

#### 1B: Fix Position Update Debouncing

**Current:**
```typescript
const dragEndTimerRef = useRef<NodeJS.Timeout | null>(null);

changes.forEach((change) => {
  if (change.type === 'position' && change.dragging === false) {
    if (dragEndTimerRef.current) {
      clearTimeout(dragEndTimerRef.current);  // ← Kills previous timer!
    }
    dragEndTimerRef.current = setTimeout(() => {
      onNodesChange([change]);  // ← Only processes last change
    }, 500);
  }
});
```

**Recommended:**
```typescript
// Use Map to track timer for each node independently
const dragEndTimersRef = useRef<Map<NodeId, NodeJS.Timeout>>(new Map());

const handleNodesChange = useCallback(
  (changes: NodeChange[]) => {
    setReactFlowNodes((nds) => applyNodeChanges(changes, nds));

    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        // Clear existing timer for this node
        const existingTimer = dragEndTimersRef.current.get(change.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Set new timer for this specific node
        const newTimer = setTimeout(() => {
          onNodesChange([change]);
          dragEndTimersRef.current.delete(change.id);  // Clean up
        }, 500);

        dragEndTimersRef.current.set(change.id, newTimer);
      } else if (change.type === 'remove') {
        onNodesChange([change]);
      }
    });
  },
  [onNodesChange]
);

// Cleanup on unmount
useEffect(() => {
  return () => {
    dragEndTimersRef.current.forEach(timer => clearTimeout(timer));
  };
}, []);
```

**Impact:** Fixes multi-node drag updates, prevents data loss

#### 1C: Prevent Duplicate Edges

**Current:**
```typescript
const existingEdge = edges.find(
  e =>
    e.from_node_id === from &&
    e.to_node_id === to &&
    e.from_port === config?.from_port &&  // Always undefined if config is undefined
    e.to_port === config?.to_port         // Always undefined if config is undefined
);

if (existingEdge) {
  return existingEdge;  // Returns silently
}
```

**Recommended:**
```typescript
const addEdge = useCallback(
  async (
    from: NodeId,
    to: NodeId,
    config?: Partial<CanvasEdge>
  ): Promise<CanvasEdge | null> => {
    if (!canvasId) return null;

    try {
      // Check for existing edge more robustly
      const fromPort = config?.from_port || null;
      const toPort = config?.to_port || null;

      const existingEdge = edges.find(
        e =>
          e.from_node_id === from &&
          e.to_node_id === to &&
          e.from_port === fromPort &&  // Compare with actual values
          e.to_port === toPort         // Compare with actual values
      );

      if (existingEdge) {
        console.warn('[useCanvasEdges] Edge already exists:', {
          from,
          to,
          fromPort,
          toPort,
          existingEdgeId: existingEdge.id,
        });
        return null;  // Return null instead of existing edge
      }

      // ... create new edge
    } catch (err) {
      console.error('[useCanvasEdges] Error adding edge:', err);
      return null;
    }
  },
  [canvasId, edges]
);
```

**Impact:** Prevents silent failures and duplicate edges

### 7.2 Priority 2: Reduce Props Drilling

#### Option A: Move to Full Context (Recommended)

Create a comprehensive `CanvasStateContext` that replaces props drilling:

```typescript
// canvas/context/CanvasStateContext.tsx
interface CanvasState {
  // Canvas state
  canvases: Canvas[];
  currentCanvas: Canvas | null;
  loading: boolean;
  error: string | null;

  // Node state
  nodes: CanvasNode[];
  selectedNodeId: NodeId | null;
  showNodePalette: boolean;

  // Edge state
  edges: CanvasEdge[];
  selectedEdgeId: EdgeId | null;

  // UI state
  showInspector: boolean;
  workflowMode: boolean;
}

interface CanvasActions {
  // Canvas operations
  selectCanvas: (canvas: Canvas | null) => void;
  createCanvas: () => void;
  updateCanvas: (id: CanvasId, updates: Partial<Canvas>) => Promise<boolean>;
  deleteCanvas: (id: CanvasId) => Promise<boolean>;

  // Node operations
  addNode: (type: CanvasNodeType, position: { x: number; y: number }, config?: any) => Promise<CanvasNode | null>;
  updateNode: (id: NodeId, updates: Partial<CanvasNode>) => Promise<boolean>;
  deleteNode: (id: NodeId) => Promise<boolean>;
  duplicateNode: (id: NodeId) => Promise<CanvasNode | null>;
  selectNode: (nodeId: NodeId | null) => void;

  // Edge operations
  addEdge: (from: NodeId, to: NodeId, config?: Partial<CanvasEdge>) => Promise<CanvasEdge | null>;
  updateEdge: (id: EdgeId, updates: Partial<CanvasEdge>) => Promise<boolean>;
  deleteEdge: (id: EdgeId) => Promise<boolean>;
  selectEdge: (edgeId: EdgeId | null) => void;

  // UI operations
  toggleNodePalette: () => void;
  toggleInspector: () => void;
  toggleWorkflowMode: () => void;
}

const CanvasStateContext = createContext<CanvasState & CanvasActions | null>(null);

export function CanvasStateProvider({ children }: { children: React.ReactNode }) {
  // All state management here
  return (
    <CanvasStateContext.Provider value={combinedValue}>
      {children}
    </CanvasStateContext.Provider>
  );
}

export function useCanvasState() {
  const context = useContext(CanvasStateContext);
  if (!context) throw new Error('useCanvasState must be used within CanvasStateProvider');
  return context;
}
```

**Then simplify CanvasShell:**

```typescript
export default function CanvasShell() {
  const { currentCanvas, nodes, edges } = useCanvasState();

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-3">
        <WorkflowControls />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <CanvasViewport />
        <NodeInspector />
      </div>
    </div>
  );
}
```

**Benefits:**
- Eliminates 14-prop interface
- Easier to add/remove operations
- Better for testing (mock context instead of props)
- Components become self-contained

#### Option B: Extract Smaller Custom Hooks

If full context migration is too risky:

```typescript
// hooks/useCanvasState.ts
export function useCanvasState() {
  const canvas = useCanvas(userId);
  const nodes = useCanvasNodes(canvas.currentCanvas?.id);
  const edges = useCanvasEdges(canvas.currentCanvas?.id);

  return {
    canvas,
    nodes,
    edges,
  };
}

// Usage in page.tsx
const { canvas, nodes, edges } = useCanvasState();

// Pass combined object to CanvasShell
<CanvasShell state={{ canvas, nodes, edges }} />
```

### 7.3 Priority 3: Unify State Management

#### Consolidate Loading States

```typescript
// context/CanvasStateContext.tsx
interface CanvasLoadingState {
  canvases: boolean;
  nodes: boolean;
  edges: boolean;
}

// Compute composite states
const isLoading = Object.values(loadingState).some(v => v);
const allLoaded = !Object.values(loadingState).some(v => v);
const partiallyLoaded = isLoading && !allLoaded;
```

#### Unify Error Handling

```typescript
interface CanvasError {
  source: 'canvas' | 'nodes' | 'edges';
  message: string;
  code?: string;
  timestamp: number;
}

const [errors, setErrors] = useState<CanvasError[]>([]);

const addError = (error: CanvasError) => {
  setErrors(prev => [...prev, error]);
  // Auto-clear after 5 seconds
  setTimeout(() => {
    setErrors(prev => prev.filter(e => e.timestamp !== error.timestamp));
  }, 5000);
};
```

### 7.4 Priority 4: Isolate Event Handlers

#### Separate React Flow State from Database Operations

**Create separate handler modules:**

```typescript
// canvas/handlers/nodeHandlers.ts
export function createNodeHandlers(
  onAddNode: (...) => Promise<CanvasNode | null>,
  onUpdateNode: (...) => Promise<boolean>,
  onDeleteNode: (...) => Promise<boolean>
) {
  return {
    handleNodeClick(nodeId: NodeId) {
      // Just selection logic
    },

    handleNodeDragEnd(nodeId: NodeId, position: { x: number; y: number }) {
      // Debounced database update
    },

    handleNodeDelete(nodeId: NodeId) {
      // Database deletion
    },
  };
}

// canvas/handlers/edgeHandlers.ts
export function createEdgeHandlers(
  onAddEdge: (...) => Promise<CanvasEdge | null>,
  onDeleteEdge: (...) => Promise<boolean>,
  onSelectNode: (nodeId: NodeId | null) => void
) {
  return {
    handleEdgeClick(edgeId: EdgeId) {
      // Just selection logic
    },

    handleEdgeDelete(edgeId: EdgeId) {
      // Database deletion
    },

    handleEdgeCreate(from: NodeId, to: NodeId) {
      // Database creation
    },
  };
}
```

**Benefits:**
- Easier to test (handlers are pure functions)
- Easier to debug (isolated logic)
- Easier to reuse (export and compose)
- Clearer responsibility separation

### 7.5 Priority 5: Extract Shared UI Patterns

#### Create NodeOperation Components

```typescript
// canvas/components/NodeOperations.tsx
interface NodeOperationsProps {
  node: CanvasNode;
  onUpdate: (updates: Partial<CanvasNode>) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onDuplicate: () => Promise<CanvasNode | null>;
}

export function NodeOperations({
  node,
  onUpdate,
  onDelete,
  onDuplicate,
}: NodeOperationsProps) {
  // Centralize common node operation logic
  // Used by NodeInspector, context menus, etc.
}
```

#### Create Form Components for Node Config

```typescript
// canvas/components/config/NodeConfigForm.tsx
// Abstract pattern for all node config panels
// Handles validation, submission, error handling
```

---

## 8. Testing & Validation Recommendations

### 8.1 Unit Tests to Add

```typescript
// tests/nodeRegistry.test.ts
describe('nodeRegistry', () => {
  it('should validate Genesis Bot node config', () => {
    const config = createDefaultNode('GENESIS_BOT', { x: 0, y: 0 });
    expect(config.config).toHaveProperty('model_provider');
    expect(config.config.temperature).toEqual(0.7);
  });

  it('should not allow invalid node types', () => {
    expect(() => createDefaultNode('INVALID_TYPE' as any, { x: 0, y: 0 })).toThrow();
  });
});

// tests/hooks/useCanvasNodes.test.ts
describe('useCanvasNodes', () => {
  it('should debounce position updates independently per node', async () => {
    // Test the Map-based debouncing
  });

  it('should cascade delete edges when node is deleted', async () => {
    // Test cascade behavior
  });

  it('should prevent duplicate edge creation', async () => {
    // Test duplicate detection
  });
});
```

### 8.2 Integration Tests

```typescript
// tests/integration/canvas.integration.test.ts
describe('Canvas Integration', () => {
  it('should sync data between hooks and context', () => {
    // Verify useCanvas/useCanvasNodes/useCanvasEdges stay in sync
  });

  it('should handle rapid node operations', () => {
    // Test: add node, drag it, create edge - all fast
  });

  it('should clean up timers on unmount', () => {
    // Verify no memory leaks from drag handlers
  });

  it('should recover from network errors', () => {
    // Test error handling and retry logic
  });
});
```

---

## 9. Architectural Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Canvas Feature Architecture (Proposed Refactor)                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    App Router (page.tsx)                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴──────────────┐
                ▼                            ▼
        ┌──────────────────┐        ┌────────────────────┐
        │ useCanvasState() │◄──────►│ CanvasStateContext │
        │ (composite hook) │        │ (unified provider) │
        └──────────────────┘        └────────────────────┘
                │                            │
    ┌───────────┼───────────┐               │
    ▼           ▼           ▼               ▼
┌────────┐ ┌────────┐ ┌────────┐  ┌──────────────────┐
│useCanvas│ │useCanvas│ │useCanvas│  │CanvasOperations│
│(canvas)│ │(nodes) │ │(edges) │  │(handlers)      │
└────────┘ └────────┘ └────────┘  └──────────────────┘
    │           │           │               │
    └───────────┴───────────┴───────────────┴──────┐
                                                   ▼
                                        ┌────────────────────┐
                                        │ Supabase Client    │
                                        │ (database)         │
                                        └────────────────────┘
                │
                ▼
        ┌──────────────────┐
        │  CanvasShell     │
        │ (dumb component) │
        └──────────────────┘
                │
    ┌───────────┼───────────┬──────────────┐
    ▼           ▼           ▼              ▼
┌─────────┐ ┌──────────┐ ┌───────────┐ ┌─────────┐
│Controls │ │Palette   │ │Viewport   │ │Inspector│
│         │ │          │ │(ReactFlow)│ │(Config) │
└─────────┘ └──────────┘ └───────────┘ └─────────┘
    │           │           │              │
    └───────────┴───────────┴──────────────┘
                │
    ┌───────────┴──────────────────┐
    ▼                              ▼
┌──────────────┐          ┌─────────────────┐
│NodeRegistry  │          │Node Handlers    │
│(metadata)    │          │Edge Handlers    │
└──────────────┘          │(isolated logic) │
                          └─────────────────┘
```

---

## 10. Summary of Risks by Priority

### Critical (Fix Immediately)
- **Cascade Delete Edges** - Data integrity issue
- **Multi-Node Drag Debouncing** - Data loss possibility
- **State Synchronization** - Race conditions in canvas switching

### High (Fix in Next Sprint)
- **Props Drilling** - Maintainability and testing difficulty
- **Silent Edge Duplication** - UX confusion
- **Unified Loading States** - Poor UX feedback

### Medium (Address in Refactor)
- **Event Handler Coupling** - Difficulty debugging/testing
- **React Flow Format Conversion** - Source of confusion
- **Error Handling Fragmentation** - Inconsistent error reporting

### Low (Nice to Have)
- **Test Coverage** - No current tests
- **Shared Component Patterns** - DRY principle
- **Performance Optimization** - Memoization strategies

---

## Conclusion

The Canvas feature has a solid **foundation with clear component responsibilities** but suffers from **state management coupling and data integrity issues**. The most critical improvements are:

1. **Fix data bugs** (cascade delete, multi-node drag, race conditions)
2. **Reduce prop drilling** (move to unified context)
3. **Consolidate state** (loading, errors, selection)
4. **Isolate handlers** (separate concerns)

The refactoring path is clear and can be done incrementally without a complete rewrite. The recommended approach is to implement Priority 1 fixes immediately while planning the Priority 2-3 architectural improvements.

**Estimated effort:**
- Priority 1 fixes: 2-3 days
- Priority 2 refactoring: 3-5 days
- Priority 3-4 improvements: 3-4 days
- Total: ~10 days of focused work
