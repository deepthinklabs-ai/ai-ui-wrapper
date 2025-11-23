# Canvas Feature - Detailed Dependency Analysis

Comprehensive dependency mapping and impact analysis for the Canvas feature.

---

## 1. File-Level Dependencies

### Core Type System
```
types/index.ts (504 lines)
  └─ All types are centralized here
  ├─ No dependencies on other canvas files
  └─ Dependencies: @/lib/apiKeyStorage (AIModel type)

  Imported by:
  ├─ components/CanvasShell.tsx
  ├─ components/CanvasViewport.tsx
  ├─ components/NodeInspector.tsx
  ├─ components/NodePalette.tsx
  ├─ components/WorkflowControls.tsx
  ├─ components/config/GenesisBotConfigPanel.tsx
  ├─ hooks/useCanvas.ts
  ├─ hooks/useCanvasNodes.ts
  ├─ hooks/useCanvasEdges.ts
  ├─ context/CanvasContext.tsx
  └─ lib/nodeRegistry.ts

  Risk Level: CRITICAL
  If changed: All 11 files must be updated
  Stability: STABLE (types rarely change)
```

### Node Registry
```
lib/nodeRegistry.ts (479 lines)
  ├─ NODE_DEFINITIONS: Defines all node types
  ├─ NODE_CATEGORIES: Node groupings
  ├─ Helper functions: createDefaultNode, getNodesByCategory, etc.
  └─ No database dependencies

  Dependencies:
  └─ types/index.ts (for type definitions)

  Imported by:
  ├─ components/CanvasViewport.tsx (line 28: NODE_DEFINITIONS)
  ├─ components/NodePalette.tsx (line 12: NODE_DEFINITIONS, NODE_CATEGORIES)
  ├─ components/NodeInspector.tsx (line 12: NODE_DEFINITIONS)
  ├─ hooks/useCanvasNodes.ts (line 20: createDefaultNode)
  └─ components/nodes/GenesisBotNode.tsx (probably)

  Risk Level: HIGH
  If changed:
  - Adding new node type: affects 4 components
  - Changing NODE_DEFINITIONS structure: breaks CanvasViewport rendering
  - Changing helper functions: breaks useCanvasNodes.addNode()

  Stability: MODERATE (frequently extended with new node types)
```

### Hooks - useCanvas
```
hooks/useCanvas.ts (251 lines)
  ├─ Functions:
  │   ├─ useCanvas(userId)
  │   ├─ refreshCanvases()
  │   ├─ createCanvas()
  │   ├─ updateCanvas()
  │   ├─ deleteCanvas()
  │   ├─ selectCanvas()
  │   └─ cloneTemplate() [partial - TODO]
  │
  ├─ Dependencies:
  │   ├─ types/index.ts (Canvas, CanvasId, CreateCanvasInput, UseCanvasResult)
  │   └─ @/lib/supabaseClient (supabase)
  │
  └─ Exports:
      └─ useCanvas function with result type UseCanvasResult

  Called by:
  └─ page.tsx (line ~15): const canvas = useCanvas(userId)

  Impact:
  - If supabase client changes: Hook breaks
  - If Canvas type changes: Hook breaks
  - If useCanvasNodes dep changes: No direct impact

  Risk Level: MEDIUM
  Stability: STABLE (core canvas CRUD)
```

### Hooks - useCanvasNodes
```
hooks/useCanvasNodes.ts (245 lines)
  ├─ Functions:
  │   ├─ useCanvasNodes(canvasId)
  │   ├─ refreshNodes()
  │   ├─ addNode(type, position, config)
  │   ├─ updateNode(id, updates)
  │   ├─ deleteNode(id)
  │   └─ duplicateNode(id) [⚠️ NO CASCADE DELETE]
  │
  ├─ Dependencies:
  │   ├─ types/index.ts (CanvasNode, CanvasNodeType, etc.)
  │   ├─ @/lib/supabaseClient
  │   └─ lib/nodeRegistry.ts (createDefaultNode)
  │
  └─ Called by:
      └─ page.tsx: const nodes = useCanvasNodes(currentCanvas?.id)

  Depends on:
  └─ currentCanvas being set (implicit - through canvasId param)

  Risk Level: HIGH
  ⚠️ Critical Issue: deleteNode doesn't cascade delete edges
     This is the most dangerous dependency gap
```

### Hooks - useCanvasEdges
```
hooks/useCanvasEdges.ts (202 lines)
  ├─ Functions:
  │   ├─ useCanvasEdges(canvasId)
  │   ├─ refreshEdges()
  │   ├─ addEdge(from, to, config) [⚠️ SILENT DUPLICATE CHECK]
  │   ├─ updateEdge(id, updates)
  │   └─ deleteEdge(id)
  │
  ├─ Dependencies:
  │   ├─ types/index.ts (CanvasEdge, EdgeId, NodeId, etc.)
  │   └─ @/lib/supabaseClient
  │
  └─ Called by:
      └─ page.tsx: const edges = useCanvasEdges(currentCanvas?.id)

  Depends on:
  └─ currentCanvas being set (implicit)

  Risk Level: HIGH
  ⚠️ Critical Issue: Duplicate edge check fails silently
     addEdge returns existing edge without error
```

### Context - CanvasContext
```
context/CanvasContext.tsx (56 lines)
  ├─ Creates:
  │   ├─ CanvasContext (holds CanvasContextValue)
  │   ├─ CanvasProvider component
  │   └─ useCanvasContext() hook
  │
  ├─ Dependencies:
  │   ├─ types/index.ts
  │   └─ React
  │
  ├─ Used by:
  │   ├─ CanvasShell.tsx (line 151: <CanvasProvider value={{...}}>)
  │   └─ Any child component using useCanvasContext()
  │
  └─ Provides:
      └─ CanvasContextValue interface (duplicates CanvasShell props)

  Risk Level: MEDIUM
  Issue: Duplicates props-based API, creates confusion about data flow
```

---

## 2. Component Dependency Tree

### Root Component
```
page.tsx (Canvas page route)
  │
  ├─ Uses Hooks:
  │   ├─ useAuthSession() ───→ @/hooks/useAuthSession
  │   ├─ useCanvas(userId) ──→ hooks/useCanvas.ts
  │   ├─ useCanvasNodes(id) ─→ hooks/useCanvasNodes.ts
  │   └─ useCanvasEdges(id) ─→ hooks/useCanvasEdges.ts
  │
  ├─ Passes to CanvasShell:
  │   ├─ canvases, currentCanvas, onSelectCanvas, onCreateCanvas, onUpdateCanvas, onDeleteCanvas
  │   ├─ nodes, onAddNode, onUpdateNode, onDeleteNode, onDuplicateNode
  │   ├─ edges, onAddEdge, onUpdateEdge, onDeleteEdge
  │   └─ loading
  │
  └─ Data Flow:
      page.tsx fetches → CanvasShell receives → CanvasShell distributes to children
```

### CanvasShell (Main Container)
```
CanvasShell.tsx (257 lines)
  │
  ├─ Props: 16 total (excessive)
  │   ├─ Canvas management: 4 props + 4 handlers
  │   ├─ Node management: 4 data/handler props
  │   ├─ Edge management: 3 data/handler props
  │   └─ UI state: 1 loading prop
  │
  ├─ Local State:
  │   ├─ selectedNodeId (useState)
  │   ├─ showNodePalette (useState)
  │   ├─ showInspector (useState)
  │   └─ workflowMode (useState)
  │
  ├─ Renders:
  │   ├─ WorkflowControls (passes 8 props)
  │   ├─ NodePalette (passes 1 handler)
  │   ├─ CanvasProvider
  │   │   ├─ CanvasViewport (passes 6 props + handlers)
  │   │   ├─ CanvasDebugOverlay (passes 2 props)
  │   │   ├─ CanvasHelpTooltip
  │   │   └─ NodeInspector (passes 5 handlers)
  │   └─ Loading overlay
  │
  └─ Risk Level: CRITICAL
      - 16 props is a code smell
      - Changes to any child component might require prop changes
      - No easy way to add new features without extending props
```

### CanvasViewport (React Flow Integration)
```
CanvasViewport.tsx (369 lines)
  │
  ├─ Props: 9 total
  │   ├─ Data: nodes, edges, selectedNodeId, workflowMode
  │   ├─ Handlers: onNodeClick, onCanvasClick, onNodesChange, onEdgesChange, onConnect
  │   └─ workflowMode: boolean flag
  │
  ├─ Local State:
  │   ├─ reactFlowNodes (useState) [duplicates props.nodes]
  │   ├─ reactFlowEdges (useState) [duplicates props.edges]
  │   ├─ selectedEdgeId (useState) [NOT in context/props]
  │   └─ dragEndTimerRef (useRef) [⚠️ BUGGY]
  │
  ├─ Dependencies:
  │   ├─ @xyflow/react (ReactFlow library)
  │   ├─ lib/nodeRegistry.ts (NODE_DEFINITIONS)
  │   ├─ components/nodes/GenesisBotNode
  │   └─ components/edges/DeletableEdge
  │
  ├─ Effects:
  │   ├─ Effect 1: Convert CanvasNode[] → ReactFlow Node[]
  │   └─ Effect 2: Convert CanvasEdge[] → ReactFlow Edge[]
  │
  └─ Risk Level: CRITICAL
      - Two data sources (props.nodes vs reactFlowNodes)
      - Selected edge state not shared with parent
      - Debouncing bug with dragEndTimerRef
      - Tight coupling to React Flow types and behavior
```

### NodeInspector (Right Sidebar)
```
NodeInspector.tsx (150+ lines)
  │
  ├─ Props: 5
  │   ├─ node (CanvasNode | null)
  │   ├─ onUpdateNode(updates)
  │   ├─ onDeleteNode()
  │   ├─ onDuplicateNode()
  │   └─ onClose()
  │
  ├─ Local State:
  │   ├─ label (useState) [local copy of node.label]
  │   └─ showDeleteConfirm (useState)
  │
  ├─ Dependencies:
  │   ├─ lib/nodeRegistry.ts (NODE_DEFINITIONS)
  │   └─ config/GenesisBotConfigPanel (for node-specific config)
  │
  ├─ Rendering:
  │   ├─ Node info from NODE_DEFINITIONS
  │   ├─ Basic settings (label, position)
  │   └─ Node-specific config panels (if/else by node.type)
  │
  └─ Risk Level: MEDIUM
      - Good prop separation
      - Issue: node-specific config handled with if/else
      - Could be refactored to use factory pattern
```

### NodePalette (Left Sidebar)
```
NodePalette.tsx (100+ lines)
  │
  ├─ Props: 1
  │   └─ onAddNode(type: CanvasNodeType)
  │
  ├─ Dependencies:
  │   ├─ lib/nodeRegistry.ts
  │   │   ├─ NODE_DEFINITIONS (all node types)
  │   │   ├─ NODE_CATEGORIES (organization)
  │   │   └─ getNodesByCategory() (filter nodes)
  │   │
  │   └─ No component dependencies
  │
  └─ Risk Level: LOW
      - Well isolated
      - Self-contained UI
      - Only dependency is nodeRegistry (stable)
```

### WorkflowControls (Top Toolbar)
```
WorkflowControls.tsx (100+ lines)
  │
  ├─ Props: 8
  │   ├─ currentCanvas, canvases
  │   ├─ onSelectCanvas, onCreateCanvas, onUpdateCanvas, onDeleteCanvas
  │   ├─ workflowMode, onToggleWorkflowMode
  │   ├─ onToggleNodePalette, onToggleInspector
  │   ├─ showNodePalette, showInspector
  │   └─ TODO: Workflow execution (not implemented)
  │
  ├─ Local State:
  │   ├─ showCanvasMenu (useState)
  │   ├─ showDeleteConfirm (useState)
  │   └─ isRunning (useState) [UI only, not functional]
  │
  ├─ Dependencies:
  │   └─ types/index.ts (Canvas, CanvasId)
  │
  └─ Risk Level: LOW
      - Props are well-organized
      - No internal dependencies
      - Placeholder code for workflow execution (safe for now)
```

---

## 3. State Flow Diagram

### Initialization Sequence (Critical Path)

```
Time  Component          Action                          Result
────────────────────────────────────────────────────────────────────

t=0   page.tsx          Mounts

t=1   useAuthSession    Gets user.id
                        │
t=2   useCanvas         Called with user.id
      │                 useEffect: fetch canvases
      │                 │
t=3   Supabase          SELECT * FROM canvases
      │                 └─→ returns canvases[]
      │
t=4   useCanvas         Auto-select first canvas → setCurrentCanvas(data[0])
      │                 State: currentCanvas = Canvas
      │
t=5   useCanvasNodes    Dependency: currentCanvas.id changed
      │                 useEffect: fetch nodes
      │                 │
t=6   Supabase          SELECT * FROM canvas_nodes WHERE canvas_id
      │                 └─→ returns nodes[]
      │
t=7   useCanvasEdges    Dependency: currentCanvas.id changed
      │                 useEffect: fetch edges
      │                 │
t=8   Supabase          SELECT * FROM canvas_edges WHERE canvas_id
      │                 └─→ returns edges[]
      │
t=9   page.tsx          All hooks resolved
      │                 Passes to CanvasShell
      │
t=10  CanvasShell       Renders child components
      │
t=11  CanvasViewport    Effects: Convert nodes/edges to React Flow format
      │
t=12  React             Renders UI to user
```

### Race Condition Scenario (currentCanvas Change)

```
User clicks Canvas B (different from current Canvas A)
│
├─ t1: selectCanvas(B) → setCurrentCanvas(B)
│
├─ t2: useCanvasNodes detects canvasId changed
│      └─ Start fetching nodes for Canvas B
│
├─ t3: useCanvasEdges detects canvasId changed
│      └─ Start fetching edges for Canvas B
│
├─ t4: Network request 1: nodes query for B
│      └─ Response arrives (slower)
│
├─ t5: Network request 2: edges query for B
│      └─ Response arrives (faster)
│
├─ t6: setEdges() executed with edges from B ✅
│
├─ t7: setNodes() executed with nodes from B ✅
│      │
│      └─ UI renders with B's nodes and B's edges ✅
│
└─ Result: SUCCESS (queries for same canvas, responses in order)

BUT: What if there's a rapid switch?

User clicks Canvas B, then Canvas C before B's data arrives
│
├─ t1: selectCanvas(B) → setCurrentCanvas(B)
├─ t2: useCanvasNodes starts fetching nodes for B
├─ t3: useCanvasEdges starts fetching edges for B
├─ t4: selectCanvas(C) → setCurrentCanvas(C)
├─ t5: useCanvasNodes starts fetching nodes for C (cancels B request)
├─ t6: useCanvasEdges starts fetching edges for C (cancels B request)
│
├─ t7: Network response: edges for B arrives late
│      setEdges(edgesFromB) ← WRONG CANVAS!
│
├─ t8: Network response: nodes for C arrives
│      setNodes(nodesFromC) ← RIGHT CANVAS
│
└─ Result: INCONSISTENT - nodes from C, edges from B ❌
```

**This race condition is currently possible!**

---

## 4. Circular Dependency Analysis

### Potential Circular Dependencies

```
✅ SAFE - No circular dependencies detected

Verification:
  types/index.ts
    → No imports from other canvas files
    → Safe to modify

  lib/nodeRegistry.ts
    → Only imports types/index.ts
    → Safe to modify

  hooks/useCanvas.ts
    → Imports types, supabase
    → No circular imports

  hooks/useCanvasNodes.ts
    → Imports types, nodeRegistry
    → No circular imports

  hooks/useCanvasEdges.ts
    → Imports types
    → No circular imports

  context/CanvasContext.tsx
    → Imports types, React
    → No circular imports

  components/CanvasShell.tsx
    → Imports types, components, context
    → No circular imports

  CanvasViewport.tsx
    → Imports types, nodeRegistry, components
    → No circular imports
```

---

## 5. Breaking Change Impact Analysis

### If type `CanvasNode` changes

```
Impact: 11 files imported + all usages

File                              Line    Usage
──────────────────────────────────────────────────────
hooks/useCanvasNodes.ts          13,46   Type import, return type
components/CanvasShell.tsx       16      Type import, prop type
components/CanvasViewport.tsx    27      Type import, conversion
components/NodeInspector.tsx     11      Type import, prop type
components/NodePalette.tsx       11      Type import
types/index.ts                   46      Definition
context/CanvasContext.tsx        12      Type import, interface
lib/nodeRegistry.ts              None    No direct usage
components/config/*              Various Config interface
hooks/useCanvas.ts               14      Import

Risk Level: HIGH - 11 files must be updated
Mitigation: Use discriminated union types, avoid breaking property removals
```

### If `NODE_DEFINITIONS` structure changes

```
Impact: 4 components affected

1. CanvasViewport.tsx (line 28)
   Uses: NODE_DEFINITIONS[node.type]
   Impact: Node type lookup might fail

2. NodePalette.tsx (line 12)
   Uses: NODE_DEFINITIONS, NODE_CATEGORIES, getNodesByCategory()
   Impact: Node palette rendering breaks

3. NodeInspector.tsx (line 12)
   Uses: NODE_DEFINITIONS[node.type]
   Impact: Node inspector rendering breaks

4. useCanvasNodes.ts (line 20)
   Uses: createDefaultNode(type, position)
   Impact: New nodes get wrong default config

Risk Level: HIGH - 4 components affected
Mitigation: Add validation/fallbacks, deprecation warning
```

### If `supabase` client changes

```
Impact: 3 hooks affected

1. useCanvas.ts (line 13)
   Uses: supabase.from('canvases')
   Impact: Canvas CRUD fails

2. useCanvasNodes.ts (line 12)
   Uses: supabase.from('canvas_nodes')
   Impact: Node CRUD fails

3. useCanvasEdges.ts (line 12)
   Uses: supabase.from('canvas_edges')
   Impact: Edge CRUD fails

Risk Level: CRITICAL - Entire feature fails
Mitigation: Use wrapper/adapter pattern
```

---

## 6. Dependency Coupling Metrics

### High Coupling (Red Flags)

| Component | Coupled To | Type | Risk |
|-----------|-----------|------|------|
| CanvasShell | CanvasViewport | Props | HIGH |
| CanvasShell | NodeInspector | Props | HIGH |
| CanvasShell | WorkflowControls | Props | HIGH |
| CanvasViewport | NodeRegistry | Direct | MEDIUM |
| NodeInspector | NodeRegistry | Direct | MEDIUM |
| All hooks | Supabase | Direct | CRITICAL |

### Cohesion Issues

```
✅ Good Cohesion
- NodePalette: Single responsibility (display nodes)
- NodeRegistry: Single source of truth (node definitions)

⚠️ Medium Cohesion
- CanvasViewport: Handles state + effects + React Flow integration
- NodeInspector: Handles config UI + local state

❌ Poor Cohesion
- CanvasShell: Props broker + state manager + layout container
  Contains: 3 state vars + 4 handlers + 12 props passing
```

---

## 7. Refactoring Dependency Impact

### If we implement Unified CanvasStateContext

```
Before:
page.tsx
  ├─ useCanvas() ────┐
  ├─ useCanvasNodes()├─→ CanvasShell ─→ 4 children
  ├─ useCanvasEdges()┤
  └─ Pass 16 props ──┘

After:
page.tsx
  └─ CanvasStateProvider
      └─ CanvasShell (uses useCanvasState())
          ├─ WorkflowControls (uses useCanvasState())
          ├─ NodePalette (uses useCanvasState())
          ├─ CanvasViewport (uses useCanvasState())
          └─ NodeInspector (uses useCanvasState())

Impact:
✅ Reduces prop drilling
✅ Easier to add new state
❌ Context become larger
❌ Requires refactoring 5+ components
⚠️ Risk: Context updates cause re-renders of all consumers

Estimated Effort: 3-4 days
Estimated Lines Changed: 500+ lines
```

---

## 8. Dependency Graph Summary

### Critical Dependencies (Must Not Break)

```
tier1: types/index.ts
  ├─ 11 files depend on this
  └─ Changes require cascade updates

tier2: lib/nodeRegistry.ts
  ├─ 4 components depend on this
  └─ Changes may break node rendering

tier3: Supabase Client
  ├─ 3 hooks depend on this
  └─ If broken, entire feature broken
```

### Implementation Dependencies

```
For Node Operations:
  types/index.ts
    → types/index.ts + hooks/useCanvasNodes.ts
      → components/CanvasShell.tsx
        → components/NodeInspector.tsx
        → components/CanvasViewport.tsx

For Node Display:
  lib/nodeRegistry.ts
    → types/index.ts
      → components/CanvasViewport.tsx
      → components/NodePalette.tsx
      → components/NodeInspector.tsx

For Data Persistence:
  hooks/useCanvasNodes.ts
    → Supabase client
      → @/lib/supabaseClient
```

---

## Recommendations

### Short Term (Immediate)
1. Add missing imports where needed
2. Document all type changes in CHANGELOG
3. Create adapter layer for Supabase if considering replacement

### Medium Term (1-2 sprints)
1. Extract common patterns to reduce duplication
2. Create handler modules to isolate event logic
3. Add proper error boundaries for component isolation

### Long Term (Quarterly)
1. Refactor to unified context (as designed)
2. Extract node configuration to factory pattern
3. Consider model-view-presenter pattern for complex components

### Testing Strategy
1. Unit test each hook in isolation
2. Integration test hooks + context + components
3. E2E test user workflows (create canvas, add nodes, connect edges)
4. Add regression tests for identified race conditions
