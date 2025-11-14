# Split View Feature

## Overview

The Split View feature allows users to view and interact with two chat threads simultaneously in a side-by-side layout. Each panel has its own independent chat interface with full functionality.

## Features

✅ **Dual Chat Panels** - View two threads side by side
✅ **Independent Functionality** - Each panel has its own composer, messages, and actions
✅ **Resizable Divider** - Drag the divider to adjust panel sizes
✅ **Thread Selection** - Choose any thread for each panel via dropdowns
✅ **Panel Swapping** - Swap left and right panels with one click
✅ **Split Ratio Reset** - Reset to 50/50 split
✅ **Smooth Transitions** - Clean activation and deactivation

## Architecture

### Files Created

1. **Types**
   - `src/types/splitView.ts` - TypeScript types for split view state and config

2. **Hooks**
   - `src/hooks/useSplitView.ts` - State management for split view feature

3. **Components**
   - `src/components/splitView/ChatPanel.tsx` - Reusable chat panel component
   - `src/components/splitView/SplitChatView.tsx` - Main split view container

4. **Integration**
   - `src/app/dashboard/page.tsx` - Dashboard integration with conditional rendering

## How to Use

### Activating Split View

1. Open a thread in the main dashboard
2. Click the **"Split View"** button in the header (icon with split panels)
3. The current thread appears in the left panel
4. Select a thread for the right panel using the dropdown

### Using Split View

**Resize Panels:**
- Drag the vertical divider between panels to adjust widths
- Minimum 20% / Maximum 80% for each panel

**Swap Panels:**
- Click "Swap panels" button (arrows icon) in the header
- Left and right panels exchange positions

**Reset Split:**
- Click "Reset Split" to return to 50/50 layout

**Select Threads:**
- Use dropdown at top of each panel to switch threads
- Can have same thread in both panels for comparison

**Exit Split View:**
- Click "Exit Split View" button to return to single chat

### Panel Features

Each panel includes:
- Full message history
- Message composer with all features
- Model selection
- File attachments
- Text conversion tools
- Step-by-step mode
- Revert and undo functionality

## State Management

The split view state includes:

```typescript
interface SplitViewState {
  isActive: boolean;        // Whether split view is active
  leftThreadId: string | null;   // Thread ID for left panel
  rightThreadId: string | null;  // Thread ID for right panel
  splitRatio: number;       // Split ratio (0-100)
}
```

## API

### useSplitView Hook

```typescript
const {
  splitView,                // Current state
  activateSplitView,       // (leftId, rightId) => void
  deactivateSplitView,     // () => void
  setSplitRatio,           // (ratio: number) => void
  swapPanels,              // () => void
  setLeftThread,           // (threadId: string) => void
  setRightThread,          // (threadId: string) => void
} = useSplitView();
```

## Use Cases

### 1. Compare Model Responses
- Same prompt in both panels with different models
- See how GPT-5 vs Claude responds to the same question

### 2. Context Comparison
- Continue different conversation branches
- Compare approaches to solving the same problem

### 3. Research & Development
- Keep reference thread open while working in another
- Cross-reference information between threads

### 4. Multi-tasking
- Work on two separate tasks simultaneously
- Switch context without losing place

### 5. Code Review
- Original code in one panel, refactored in the other
- Compare before/after implementations

## Technical Details

### Responsive Behavior

- Minimum panel width: 20% (configurable)
- Maximum panel width: 80% (configurable)
- Draggable divider with smooth resizing
- Mouse cursor changes to `ew-resize` during drag

### Performance

- Each panel uses its own `useMessages` hook
- Independent state management prevents conflicts
- No shared state between panels except model selection
- Efficient re-rendering with React memo patterns

### Keyboard Support

Currently mouse-only. Future enhancement:
- Keyboard shortcuts for activating/deactivating
- Tab navigation between panels
- Arrow keys to resize

## Future Enhancements

### Planned Features

1. **Sync Scroll** - Option to sync scroll positions between panels
2. **Independent Models** - Different AI models per panel
3. **Panel Presets** - Save and load panel configurations
4. **Vertical Split** - Option for top/bottom layout
5. **More Than Two Panels** - Support for 3 or 4 panels
6. **Panel History** - Remember last used threads per panel
7. **Quick Compare** - Right-click message to compare in split view

### Configuration Options

Future `SplitViewConfig`:

```typescript
interface SplitViewConfig {
  enableSync?: boolean;           // Sync scroll positions
  independentModels?: boolean;    // Allow different models per side
  minPanelWidth?: number;        // Minimum width for each panel
  defaultRatio?: number;         // Default split ratio
  orientation?: 'horizontal' | 'vertical';  // Layout direction
}
```

## Limitations

- Currently limited to 2 panels
- No mobile support (requires wide screen)
- Cannot drag messages between panels
- No panel linking/synchronization yet

## Troubleshooting

**Issue:** Split view button doesn't appear
- **Solution:** Make sure you have a thread selected

**Issue:** Can't select thread in panel
- **Solution:** Ensure you have at least one thread created

**Issue:** Divider won't drag
- **Solution:** Click and hold the divider, then drag left/right

**Issue:** Panels too narrow
- **Solution:** Click "Reset Split" or drag divider to widen

## Architecture Benefits

✅ **Modular Design** - All split view code in separate files
✅ **Reusable Components** - ChatPanel can be used elsewhere
✅ **Clean Integration** - Minimal changes to dashboard
✅ **Type Safe** - Full TypeScript coverage
✅ **No Side Effects** - Independent panel state management

## Related Features

- **Context Panel** - Use alongside split view for triple comparison
- **Thread Operations** - Fork threads to compare branches
- **Model Selection** - Switch models per panel (future)
