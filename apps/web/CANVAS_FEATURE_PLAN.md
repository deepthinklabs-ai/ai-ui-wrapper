# Canvas Feature - Implementation Plan

## Overview
Visual n8n-style workflow builder for orchestrating Genesis Bots, Training Sessions, Boardrooms, and all AI features.

## ✅ Phase 1: Foundation (COMPLETED)

### Database Schema
- ✅ Created migration `010_canvas_tables.sql` with 8 tables:
  - `canvases` - Main canvas/workflow containers
  - `canvas_nodes` - Individual nodes (Genesis Bots, Training Sessions, etc.)
  - `canvas_edges` - Connections between nodes
  - `workflow_executions` - Runtime execution state
  - `boardroom_conversations` - Multi-bot discussions
  - `boardroom_messages` - Individual discussion messages
  - `training_session_executions` - Training session state
  - `training_interactions` - Training conversation history
  - `canvas_templates` - Pre-built templates

### Type System
- ✅ Comprehensive TypeScript types in `src/app/canvas/types/index.ts`
  - 8 node types with detailed config interfaces
  - Workflow execution types
  - Boardroom discussion types
  - Training session types
  - React Flow integration types

### Node Registry
- ✅ Central node registry in `lib/nodeRegistry.ts`
  - Node definitions with ports, icons, colors
  - Default configurations
  - Categories: bot, training, collaboration, trigger, tool, other
  - Helper functions for node creation

### Data Hooks
- ✅ `useCanvas.ts` - Canvas CRUD operations
- ✅ `useCanvasNodes.ts` - Node management
- ✅ `useCanvasEdges.ts` - Edge management

### UI Components
- ✅ Main page: `src/app/canvas/page.tsx`
  - Empty state with feature showcase
  - Auth protection
  - Canvas selection
- ✅ `CreateCanvasModal.tsx` - Create new canvas with mode selection
- ✅ `CanvasShell.tsx` - Main layout with sidebars and viewport

### Dependencies
- ✅ Installed `@xyflow/react` for visual workflow builder

## 🚧 Phase 2: Core Components (IN PROGRESS)

### Remaining Components Needed:

#### Essential Components
1. **NodePalette.tsx** - Left sidebar with draggable node types
2. **CanvasViewport.tsx** - React Flow integration
3. **NodeInspector.tsx** - Right sidebar for node configuration
4. **WorkflowControls.tsx** - Top toolbar with controls

#### Node Components (8 types)
5. **GenesisBotNode.tsx** - AI bot configuration
6. **TrainingSessionNode.tsx** - Training interface
7. **BoardroomNode.tsx** - Multi-bot discussion
8. **TriggerNode.tsx** - Workflow triggers
9. **CableChannelNode.tsx** - Cable Box integration
10. **ToolNode.tsx** - MCP/OAuth tools
11. **TerminalCommandNode.tsx** - Terminal Bot integration
12. **CustomNode.tsx** - User-defined nodes

#### Panel Components
13. **BoardroomPanel.tsx** - Boardroom discussion UI
14. **TrainingSessionPanel.tsx** - Training session interface
15. **TerminalCommandPanel.tsx** - Terminal Bot integration

### Backend Integration Needed:

#### Hooks
- `useWorkflowRunner.ts` - Execute workflows
- `useBoardroomRunner.ts` - Run boardroom discussions
- `useTrainingManager.ts` - Manage training sessions
- `useCanvasState.ts` - Local state management

#### Lib Functions
- `workflowEngine.ts` - Workflow execution logic
- `boardroomOrchestrator.ts` - Multi-bot discussion orchestration
- `trainingEngine.ts` - Training session logic
- `canvasSerializer.ts` - Save/load canvas
- `canvasValidator.ts` - Validation utilities
- `nodeSchemas.ts` - Zod validation schemas

## 📋 Phase 3: Feature Integration

### Genesis Bot Integration
- [ ] Connect to existing Workforce virtual employees
- [ ] Support all Genesis Bot capabilities (model, prompt, tools, voice)
- [ ] Real-time updates between Canvas and Workforce pages

### Training Session Integration
- [ ] Reuse Workforce training UI/logic
- [ ] Auto-update Genesis Bot system prompts
- [ ] Training session persistence
- [ ] Training analytics and improvements tracking

### Boardroom Integration
- [ ] Multi-bot conversation orchestration
- [ ] Turn-based discussion flow
- [ ] Real-time UI updates
- [ ] Summary generation
- [ ] Decision/consensus tracking

### Tool Integration
- [ ] MCP tool execution from canvas
- [ ] OAuth action integration
- [ ] Tool result visualization
- [ ] Error handling and retries

### Trigger System
- [ ] Manual triggers (button click)
- [ ] Schedule triggers (cron)
- [ ] Webhook triggers
- [ ] Event-based triggers

## 📋 Phase 4: Workflow Execution

### Execution Engine
- [ ] Topological sort for node order
- [ ] Parallel execution where possible
- [ ] Conditional branching
- [ ] Error handling and recovery
- [ ] Pause/resume capability

### Runtime State
- [ ] Real-time execution visualization
- [ ] Progress tracking
- [ ] Logging and debugging
- [ ] Performance metrics

## 📋 Phase 5: Templates & Sharing

### Templates
- [ ] Pre-built workflow templates
- [ ] Template marketplace
- [ ] Template customization
- [ ] Official vs community templates

### Import/Export
- [ ] Export canvas as JSON
- [ ] Import canvas from JSON
- [ ] Share via URL
- [ ] Duplicate canvas

## 📋 Phase 6: Advanced Features

### Collaboration
- [ ] Real-time collaborative editing (Supabase realtime)
- [ ] User cursors
- [ ] Commenting system
- [ ] Version history

### Advanced Nodes
- [ ] Loop nodes (iterate over data)
- [ ] Condition nodes (if/else)
- [ ] Transform nodes (data manipulation)
- [ ] HTTP request nodes
- [ ] Database query nodes

### UI/UX Polish
- [ ] Minimap
- [ ] Zoom controls
- [ ] Snap to grid
- [ ] Alignment guides
- [ ] Keyboard shortcuts
- [ ] Undo/redo
- [ ] Node grouping
- [ ] Colored connections
- [ ] Animation when running

## Architecture Notes

### Following Existing Patterns
- Using direct Supabase calls (no React Query)
- Hooks use `useState` + `useCallback`
- Tailwind slate-950/900/800 color scheme
- Modal pattern: backdrop + fixed positioning
- Auth protection with `useAuthSession`

### Node Execution Model
```typescript
// Each node type has:
interface NodeExecutor {
  execute(input: any, config: any): Promise<NodeOutput>;
  validate(config: any): boolean;
  getSchema(): ZodSchema;
}
```

### Data Flow
```
User creates canvas
  → Adds nodes (Genesis Bots, Training, etc.)
  → Connects nodes with edges
  → Configures each node
  → Runs workflow
    → Nodes execute in topological order
    → Data flows through edges
    → Results stored in workflow_executions
```

### Integration Points

#### Genesis Bot Node
- References `virtual_employees` table or creates ad-hoc bot
- Uses `sendUnifiedChatRequest` for AI calls
- Supports all model providers (OpenAI, Claude, Grok)

#### Training Session Node
- Creates `training_session_executions` record
- Uses chat UI from Workforce feature
- Updates bot's `system_prompt` on completion

#### Boardroom Node
- Creates `boardroom_conversations` record
- Orchestrates multiple Genesis Bot calls
- Generates summary using AI

## Next Steps

1. **Complete Core Components**
   - Implement NodePalette with drag-and-drop
   - Build CanvasViewport with React Flow
   - Create NodeInspector for configuration
   - Add WorkflowControls toolbar

2. **Build Node Components**
   - Start with GenesisBotNode (most important)
   - Then TrainingSessionNode
   - Then BoardroomNode
   - Add others as needed

3. **Test Basic Workflow**
   - Create canvas
   - Add 2 Genesis Bots
   - Connect them
   - Execute simple workflow

4. **Iterate**
   - Add features based on user feedback
   - Optimize performance
   - Add templates
   - Polish UI/UX

## File Structure Summary

```
src/app/canvas/
├── page.tsx                          # ✅ Main page
├── types/index.ts                    # ✅ TypeScript types
├── components/
│   ├── CanvasShell.tsx              # ✅ Main layout
│   ├── NodePalette.tsx              # 🚧 TODO
│   ├── CanvasViewport.tsx           # 🚧 TODO
│   ├── NodeInspector.tsx            # 🚧 TODO
│   ├── WorkflowControls.tsx         # 🚧 TODO
│   ├── nodes/                       # 🚧 All TODO
│   ├── panels/                      # 🚧 All TODO
│   └── modals/
│       └── CreateCanvasModal.tsx    # ✅ Done
├── hooks/
│   ├── useCanvas.ts                 # ✅ Done
│   ├── useCanvasNodes.ts            # ✅ Done
│   ├── useCanvasEdges.ts            # ✅ Done
│   ├── useWorkflowRunner.ts         # 🚧 TODO
│   ├── useBoardroomRunner.ts        # 🚧 TODO
│   └── useTrainingManager.ts        # 🚧 TODO
└── lib/
    ├── nodeRegistry.ts              # ✅ Done
    ├── nodeSchemas.ts               # 🚧 TODO
    ├── workflowEngine.ts            # 🚧 TODO
    ├── boardroomOrchestrator.ts     # 🚧 TODO
    ├── trainingEngine.ts            # 🚧 TODO
    ├── canvasSerializer.ts          # 🚧 TODO
    └── canvasValidator.ts           # 🚧 TODO
```

✅ = Completed
🚧 = In Progress / TODO
