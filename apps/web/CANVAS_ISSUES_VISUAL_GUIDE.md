# Canvas Feature - Visual Issue Guide

Quick visual reference for all identified issues and their fixes.

---

## Issue 1: Cascade Delete Missing

### Current Behavior
```
User deletes Node A ──→ [Canvas Database]
                       ├─ canvas_nodes
                       │  └─ Node A DELETED ✓
                       │
                       └─ canvas_edges
                          ├─ A → B ORPHANED ❌
                          ├─ C → A ORPHANED ❌
                          └─ These edges reference non-existent node!
```

### Fixed Behavior
```
User deletes Node A ──→ [Canvas Database]
                       ├─ canvas_edges
                       │  └─ Delete A → B ✓
                       │  └─ Delete C → A ✓
                       │
                       └─ canvas_nodes
                          └─ Node A DELETED ✓

Result: No orphaned edges!
```

### Code Impact
```
File: hooks/useCanvasNodes.ts
Lines: 184-211
Change: Add edge deletion before node deletion
Risk: LOW (isolated change)
Effort: 1 hour
```

---

## Issue 2: Multi-Node Drag Data Loss

### Current Behavior (BROKEN)
```
Timeline of Events:

Event: Drag Node A to (100, 100)
  ├─ handleNodesChange() called
  ├─ dragEndTimerRef.current = setTimeout(() => save(A), 500ms)
  └─ Timer ID: #1

Event: Drag Node B to (200, 200) at t=100ms
  ├─ handleNodesChange() called
  ├─ clearTimeout(#1) ← KILLS Timer #1!
  ├─ dragEndTimerRef.current = setTimeout(() => save(B), 500ms)
  └─ Timer ID: #2 (OVERWRITES #1)

At t=600ms:
  ├─ Timer #2 fires → save(B) ✓ Position 200, 200 saved
  └─ Timer #1 never fires → save(A) ❌ Position 100, 100 LOST!

Database Result:
  ├─ Node A: position still (0, 0) ❌ WRONG
  └─ Node B: position (200, 200) ✓ CORRECT
```

### Fixed Behavior (WORKS)
```
Timeline of Events:

Event: Drag Node A to (100, 100)
  ├─ dragEndTimersRef.current.set('A', setTimeout(() => save(A), 500ms))
  └─ Map: {A: Timer#1}

Event: Drag Node B to (200, 200) at t=100ms
  ├─ dragEndTimersRef.current.set('B', setTimeout(() => save(B), 500ms))
  └─ Map: {A: Timer#1, B: Timer#2}

At t=600ms:
  ├─ Timer #1 fires → save(A) ✓ Position 100, 100 saved
  └─ Timer #2 fires → save(B) ✓ Position 200, 200 saved

Database Result:
  ├─ Node A: position (100, 100) ✓ CORRECT
  └─ Node B: position (200, 200) ✓ CORRECT
```

### Code Impact
```
File: components/CanvasViewport.tsx
Lines: 80-82, 154-178
Change: Replace single ref with Map<NodeId, Timer>
Risk: LOW (event handling change)
Effort: 2 hours (includes cleanup logic)
```

---

## Issue 3: Silent Duplicate Edge Failure

### Current Behavior (BROKEN)
```
Step 1: User connects Node A → Node B (no ports specified)
  ├─ addEdge(A, B, undefined)
  ├─ Duplicate check:
  │   └─ undefined === undefined?.from_port ✓ (always true!)
  │   └─ undefined === undefined?.to_port ✓ (always true!)
  ├─ No existing edge found (wrong comparison!)
  └─ Edge created: {from: A, to: B, from_port: null, to_port: null}

Step 2: User tries to connect again
  ├─ addEdge(A, B, undefined)
  ├─ Duplicate check:
  │   └─ undefined === undefined?.from_port ✓ (always true!)
  │   └─ undefined === undefined?.to_port ✓ (always true!)
  ├─ existingEdge found ✓
  ├─ console.warn() printed (user doesn't see it!)
  └─ Returns existing edge silently ⚠️

User Sees: Nothing happens (confusing!)
Database: Still only 1 edge (correct by accident)
User Feedback: NONE ❌
```

### Fixed Behavior (WORKS)
```
Step 1: User connects Node A → Node B (no ports specified)
  ├─ addEdge(A, B, undefined)
  ├─ Normalize: fromPort = null, toPort = null
  ├─ Duplicate check: (null === null) ✓
  ├─ No existing edge found
  └─ Edge created: {from: A, to: B, from_port: null, to_port: null}

Step 2: User tries to connect again
  ├─ addEdge(A, B, undefined)
  ├─ Normalize: fromPort = null, toPort = null
  ├─ Duplicate check: (null === null) ✓
  ├─ existingEdge found ✓
  ├─ console.warn() printed + detailed logging
  └─ Returns null (error, not existing edge)

User Sees: Toast message "Edge already exists" ✓
Database: Still only 1 edge ✓
User Feedback: CLEAR ✓
```

### Code Impact
```
File: hooks/useCanvasEdges.ts
Lines: 72-84
Change: Fix port comparison logic
Risk: LOW (improves edge handling)
Effort: 1 hour
```

---

## Issue 4: Race Condition in Canvas Switching

### Current Behavior (BROKEN)
```
Canvas A: [Node1, Node2] ── Edge1: Node1→Node2
Canvas B: [Node3, Node4] ── Edge2: Node3→Node4

User clicks Canvas B:
├─ setCurrentCanvas(B)
├─ useCanvasNodes(B.id) starts fetching
├─ useCanvasEdges(B.id) starts fetching
│
├─ REQUEST 1: SELECT * FROM canvas_nodes WHERE canvas_id = B
├─ REQUEST 2: SELECT * FROM canvas_edges WHERE canvas_id = B
│
├─ REQUEST 2 completes first (faster network)
│   └─ setEdges([Edge2]) ✓ Correct
│
├─ REQUEST 1 completes second (slower network)
│   └─ setNodes([Node3, Node4]) ✓ Correct
│
└─ UI Shows: Nodes from B + Edges from B ✓ CORRECT


BUT: Rapid Canvas Switch
────────────────────────

User clicks Canvas B, then Canvas C immediately:
├─ t1: setCurrentCanvas(B)
├─ t2: useCanvasNodes fetches Canvas B data
├─ t3: useCanvasEdges fetches Canvas B data
├─ t4: setCurrentCanvas(C) ← User switches!
├─ t5: useCanvasNodes fetches Canvas C data
├─ t6: useCanvasEdges fetches Canvas C data
│
├─ t7: Canvas B edges response arrives (late)
│   └─ setEdges(B_edges) ← WRONG! ❌
│
├─ t8: Canvas C nodes response arrives
│   └─ setNodes(C_nodes) ✓ Correct
│
└─ UI Shows: Nodes from C + Edges from B ❌ INCONSISTENT!
```

### Visual Impact
```
Expected:
┌────────────────────┐
│  Node3      Node4  │
│    \       /       │
│     Edge2         │
└────────────────────┘

Actual (Bug):
┌────────────────────┐
│  Node3      Node4  │
│    \       /       │
│     Edge1  ← WRONG!│  (from Canvas A)
└────────────────────┘
```

---

## Issue 5: State Duplication Problem

### Current Behavior
```
Data Flow:

Canvas ┐
Nodes  ├─→ [Local State]
Edges  ┘    ├─ nodes: CanvasNode[]
            ├─ edges: CanvasEdge[]
            │
            └─→ Convert to React Flow format
                 ├─ reactFlowNodes: Node[]
                 └─ reactFlowEdges: Edge[]

Problem: TWO SOURCES OF TRUTH
                ↓
When useCanvasNodes.deleteNode() runs:
  ├─ Updates: nodes state ✓
  └─ But: reactFlowNodes still has old data ⚠️

When React Flow deletes an edge:
  ├─ Updates: reactFlowEdges state ✓
  └─ But: edges state still has old data ⚠️

Result: Potential inconsistency if effects don't sync correctly
```

---

## Issue 6: Excessive Props Drilling

### Current Architecture
```
page.tsx
  │
  └─ CanvasShell (16 PROPS!)
      ├─ Props: canvases, currentCanvas, onSelectCanvas, ...
      │
      ├─ WorkflowControls (8 props)
      │   └─ Canvas selection + mode toggles
      │
      ├─ NodePalette (1 prop)
      │   └─ onAddNode
      │
      ├─ CanvasProvider (wraps with context)
      │   │
      │   ├─ CanvasViewport (6 props + 3 handlers)
      │   │   └─ React Flow integration
      │   │
      │   └─ NodeInspector (5 handlers)
      │       └─ Node configuration
      │
      └─ Loading overlay
```

### After Refactoring
```
page.tsx
  │
  └─ CanvasStateProvider
      │   (provides: useCanvasState())
      │
      ├─ CanvasShell (0 PROPS!)
      │   │
      │   ├─ WorkflowControls
      │   │   └─ Uses: useCanvasState()
      │   │
      │   ├─ NodePalette
      │   │   └─ Uses: useCanvasState()
      │   │
      │   ├─ CanvasViewport
      │   │   └─ Uses: useCanvasState()
      │   │
      │   └─ NodeInspector
      │       └─ Uses: useCanvasState()
      │
      └─ All child components access data directly
```

---

## Summary Table

| # | Issue | Severity | Fix Time | Risk | Impact |
|---|-------|----------|----------|------|--------|
| 1 | Cascade Delete | CRITICAL | 1 hr | LOW | Data integrity |
| 2 | Drag Debouncing | CRITICAL | 2 hrs | LOW | Data loss |
| 3 | Duplicate Edges | HIGH | 1 hr | LOW | Data quality |
| 4 | Race Condition | MEDIUM | 4 hrs | MEDIUM | Consistency |
| 5 | State Duplication | MEDIUM | 3 hrs | MEDIUM | Maintenance |
| 6 | Props Drilling | MEDIUM | 5 hrs | MEDIUM | Maintainability |

**Total Effort: ~22 hours across 3 phases**

---

## Implementation Timeline

```
Week 1: Emergency Fixes
├─ Mon: Fix cascade delete
├─ Tue: Fix position debouncing
├─ Wed: Fix duplicate edges
├─ Thu: Testing + debugging
└─ Fri: Deploy to staging

Week 2: State Management
├─ Mon: Create unified loading state
├─ Tue: Create unified error state
├─ Wed: Update all hooks
├─ Thu: Update components
└─ Fri: Test + deploy

Week 3: Architecture Refactoring
├─ Mon: Design CanvasStateContext
├─ Tue: Implement context provider
├─ Wed: Migrate components (1/2)
├─ Thu: Migrate components (2/2)
└─ Fri: Full testing + deploy
```

---

*Visual guide created: November 23, 2025*
