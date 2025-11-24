# Canvas Feature Test Plan

**Phase 3, Fix #3: Test Coverage for Critical Operations**

This document provides comprehensive test procedures for all critical Canvas operations
implemented in Phases 1-3 of the architecture improvements.

## Test Categories

1. [Critical Data Integrity Tests](#1-critical-data-integrity-tests)
2. [State Management Tests](#2-state-management-tests)
3. [Event Handler Tests](#3-event-handler-tests)
4. [Race Condition Tests](#4-race-condition-tests)

---

## 1. Critical Data Integrity Tests

### Test 1.1: Cascade Delete - Node Deletion Removes Connected Edges

**Purpose**: Verify that deleting a node also deletes all connected edges (Phase 1, Fix #1)

**Implementation Location**: `src/app/canvas/hooks/useCanvasNodes.ts:205-227`

**Test Steps**:
1. Navigate to Canvas page
2. Create a new canvas
3. Add 3 nodes (e.g., Genesis Bot, Input, Output)
4. Connect Node A → Node B
5. Connect Node B → Node C
6. Open browser DevTools → Application → Local Storage
7. Note the number of edges (should be 2)
8. Select Node B (middle node) and press DELETE
9. Verify Node B is deleted
10. Check Local Storage - edges table should now be empty (0 edges)

**Expected Result**:
- ✅ Node B deleted successfully
- ✅ Both edges (A→B and B→C) automatically deleted
- ✅ No orphaned edges remain in database
- ✅ No console errors

**Failure Indicators**:
- ❌ Edges remain after node deletion (orphaned data)
- ❌ Console error: "Foreign key constraint violation"

---

### Test 1.2: Multi-Node Position Saving

**Purpose**: Verify that dragging multiple nodes rapidly saves all positions (Phase 1, Fix #2)

**Implementation Location**: `src/app/canvas/components/CanvasViewport.tsx:88-120`

**Test Steps**:
1. Navigate to Canvas page
2. Add 5 nodes at different positions
3. Rapidly drag Node 1 to new position
4. Immediately (within 1 second) drag Node 2 to new position
5. Immediately drag Node 3 to new position
6. Wait 2 seconds for debounce timers to complete
7. Refresh the page (F5)
8. Verify all 3 nodes are in their new positions

**Expected Result**:
- ✅ All node positions saved correctly
- ✅ No position data loss
- ✅ Each node has independent debounce timer

**Failure Indicators**:
- ❌ Only the last dragged node saved its position
- ❌ First two nodes reverted to original positions
- ❌ Console log: "Canvas changed during fetch, discarding stale data"

---

### Test 1.3: Duplicate Edge Prevention

**Purpose**: Verify that duplicate edge connections are prevented with user feedback (Phase 1, Fix #3)

**Implementation Location**: `src/app/canvas/hooks/useCanvasEdges.ts:86-99`

**Test Steps**:
1. Navigate to Canvas page
2. Add 2 nodes (A and B)
3. Connect Node A → Node B (drag from output handle to input handle)
4. Verify connection created successfully (blue line appears)
5. Attempt to connect Node A → Node B again (same handles)
6. Look for yellow toast notification at bottom center of screen

**Expected Result**:
- ✅ First connection succeeds
- ✅ Second connection attempt shows yellow toast: "Connection Already Exists"
- ✅ Toast auto-dismisses after 3 seconds
- ✅ Only 1 edge exists between nodes

**Failure Indicators**:
- ❌ Duplicate edge created (two lines between nodes)
- ❌ No user feedback shown
- ❌ Console error about duplicate data

---

## 2. State Management Tests

### Test 2.1: Centralized Loading States

**Purpose**: Verify loading indicators work correctly for all operations (Phase 2, Fix #1)

**Implementation Location**: `src/app/canvas/hooks/useCanvasState.ts`

**Test Steps**:
1. Navigate to Canvas page
2. Open browser DevTools → Network tab
3. Throttle network to "Slow 3G"
4. Add a new node
5. Observe top-right corner for blue loading indicator
6. Verify indicator shows "Creating node..."
7. Delete a node
8. Verify indicator shows "Deleting node..."
9. Connect two nodes
10. Verify indicator shows "Creating connection..."

**Expected Result**:
- ✅ Loading indicator appears top-right with blue spinner
- ✅ Correct operation text displayed
- ✅ Indicator disappears when operation completes
- ✅ Only one loading indicator at a time

**Failure Indicators**:
- ❌ No loading indicator shown
- ❌ Multiple loading indicators overlap
- ❌ Indicator doesn't dismiss

---

### Test 2.2: Centralized Error Handling

**Purpose**: Verify error notifications work correctly (Phase 2, Fix #1)

**Implementation Location**: `src/app/canvas/components/CanvasNotifications.tsx`

**Test Steps**:
1. Navigate to Canvas page
2. Open browser DevTools → Console
3. Temporarily disconnect network (DevTools → Network → Offline)
4. Attempt to add a node
5. Verify red error notification appears top-right
6. Check error message is descriptive
7. Click "Retry" button
8. Verify error persists (network still offline)
9. Re-enable network
10. Click "Retry" again
11. Verify error clears and operation succeeds

**Expected Result**:
- ✅ Red error notification appears top-right
- ✅ Error message is descriptive
- ✅ Retry button available (if canRetry: true)
- ✅ Close button (X) dismisses error
- ✅ Auto-dismisses after 10 seconds

**Failure Indicators**:
- ❌ Silent failure (no error shown)
- ❌ Error only in console
- ❌ Error doesn't auto-dismiss

---

### Test 2.3: Race Condition Prevention - Canvas Switching

**Purpose**: Verify stale data is discarded when switching canvases rapidly (Phase 2, Fix #3)

**Implementation Location**:
- `src/app/canvas/hooks/useCanvasNodes.ts:60-64`
- `src/app/canvas/hooks/useCanvasEdges.ts:58-62`

**Test Steps**:
1. Navigate to Canvas page
2. Create Canvas A with 3 nodes
3. Create Canvas B with 5 nodes
4. Open DevTools → Network → Throttle to "Slow 3G"
5. Switch to Canvas A
6. **Immediately** (within 1 second) switch to Canvas B
7. Wait for both requests to complete
8. Verify Canvas B shows 5 nodes (not 3)
9. Check console for: "Canvas changed during fetch, discarding stale data"

**Expected Result**:
- ✅ Canvas B displays correct nodes (5)
- ✅ Stale data from Canvas A discarded
- ✅ Console log confirms race prevention
- ✅ No flickering or incorrect data displayed

**Failure Indicators**:
- ❌ Canvas B briefly shows Canvas A's nodes
- ❌ Wrong node count displayed
- ❌ No console log about stale data

---

## 3. Event Handler Tests

### Test 3.1: Node Selection and Inspector

**Purpose**: Verify centralized node selection handler works correctly (Phase 3, Fix #2)

**Implementation Location**: `src/app/canvas/hooks/useCanvasOperations.ts:51-61`

**Test Steps**:
1. Navigate to Canvas page
2. Add 3 nodes
3. Click on Node 1
4. Verify Node 1 has blue selection border
5. Verify right inspector panel opens with Node 1 details
6. Click on Node 2
7. Verify Node 2 now selected (blue border)
8. Verify Node 1 no longer selected
9. Verify inspector shows Node 2 details
10. Click on canvas background (empty space)
11. Verify all nodes deselected
12. Verify inspector shows "No node selected"

**Expected Result**:
- ✅ Only one node selected at a time
- ✅ Inspector updates to show selected node
- ✅ Canvas click deselects all nodes
- ✅ Inspector auto-opens when node selected

**Failure Indicators**:
- ❌ Multiple nodes selected simultaneously
- ❌ Inspector doesn't update
- ❌ Cannot deselect nodes

---

### Test 3.2: Node Addition from Palette

**Purpose**: Verify add node handler centers node in viewport (Phase 3, Fix #2)

**Implementation Location**: `src/app/canvas/hooks/useCanvasOperations.ts:70-82`

**Test Steps**:
1. Navigate to Canvas page
2. Resize browser window to 1920x1080
3. Scroll canvas viewport to show different area
4. Click "Genesis Bot" in left palette
5. Verify new node appears at center of **visible viewport** (not canvas origin)
6. Note node coordinates
7. Pan canvas to different location
8. Add another node
9. Verify second node also appears at viewport center

**Expected Result**:
- ✅ Nodes added at center of visible viewport
- ✅ Nodes automatically selected after creation
- ✅ Inspector opens showing new node

**Failure Indicators**:
- ❌ Nodes added at canvas origin (0,0)
- ❌ Nodes added off-screen
- ❌ Nodes not selected after creation

---

### Test 3.3: Edge Connection with Duplicate Detection

**Purpose**: Verify connection handler detects duplicates (Phase 3, Fix #2)

**Implementation Location**: `src/app/canvas/hooks/useCanvasOperations.ts:117-134`

**Test Steps**:
1. Navigate to Canvas page
2. Add 2 nodes with multiple handles (e.g., Genesis Bot)
3. Connect Node A (output 1) → Node B (input 1)
4. Verify connection created
5. Attempt duplicate: Node A (output 1) → Node B (input 1) again
6. Verify yellow toast appears: "Connection Already Exists"
7. Connect Node A (output 2) → Node B (input 1) (different port)
8. Verify this connection succeeds (different port = not duplicate)

**Expected Result**:
- ✅ Duplicate connections prevented
- ✅ Toast notification shown for 3 seconds
- ✅ Different port connections allowed
- ✅ No console errors

**Failure Indicators**:
- ❌ Duplicate edges created
- ❌ No toast notification
- ❌ All connections blocked (even valid ones)

---

### Test 3.4: Inspector Actions (Update, Delete, Duplicate)

**Purpose**: Verify inspector handlers work correctly (Phase 3, Fix #2)

**Implementation Location**: `src/app/canvas/hooks/useCanvasOperations.ts:137-167`

**Test Steps**:
1. Navigate to Canvas page
2. Add a node
3. Select node to open inspector
4. **Update Test**: Change node label to "Test Node"
5. Verify label updates in canvas
6. **Duplicate Test**: Click duplicate button
7. Verify new node appears offset (+50, +50)
8. Verify new node has same config as original
9. **Delete Test**: Click delete button
10. Verify node removed from canvas
11. Verify inspector closes/shows "No node selected"

**Expected Result**:
- ✅ Update: Label changes immediately
- ✅ Duplicate: New node offset from original
- ✅ Delete: Node removed, inspector closes
- ✅ All operations update database

**Failure Indicators**:
- ❌ Updates don't persist
- ❌ Duplicate creates node at same position
- ❌ Delete fails or leaves orphaned data

---

## 4. Race Condition Tests

### Test 4.1: Rapid Node Updates

**Purpose**: Verify node updates don't conflict (Phase 2, Fix #3)

**Implementation Location**: `src/app/canvas/hooks/useCanvasNodes.ts:148-192`

**Test Steps**:
1. Navigate to Canvas page
2. Add a node
3. Open inspector
4. Rapidly change node label 5 times:
   - "Test 1" → "Test 2" → "Test 3" → "Test 4" → "Test 5"
5. Type quickly without waiting for updates
6. Wait 3 seconds
7. Refresh page
8. Verify node label is "Test 5" (final value)

**Expected Result**:
- ✅ Final value persisted
- ✅ No intermediate values lost
- ✅ No console errors about race conditions

**Failure Indicators**:
- ❌ Label shows intermediate value (e.g., "Test 3")
- ❌ Label reverted to original
- ❌ Console errors about update conflicts

---

### Test 4.2: Concurrent Node and Edge Operations

**Purpose**: Verify node/edge operations don't conflict (Phase 2)

**Implementation Location**: Multiple hooks coordinated via context

**Test Steps**:
1. Navigate to Canvas page
2. Open DevTools → Network → Throttle to "Slow 3G"
3. Add Node A (operation starts but not finished)
4. Immediately add Node B (before Node A completes)
5. Wait for both operations to complete
6. Verify both nodes appear
7. Immediately start connecting them (before they fully render)
8. Verify connection succeeds

**Expected Result**:
- ✅ Both nodes created successfully
- ✅ Connection created successfully
- ✅ No operations fail
- ✅ Correct loading indicators shown

**Failure Indicators**:
- ❌ Second node fails to create
- ❌ Connection fails
- ❌ Console errors about missing nodes

---

## 5. Context API Tests

### Test 5.1: Context Availability

**Purpose**: Verify context is available to all child components (Phase 3, Fix #1)

**Implementation Location**: `src/app/canvas/context/CanvasStateContext.tsx`

**Test Steps**:
1. Navigate to Canvas page
2. Open DevTools → Console
3. Verify no error: "useCanvasContext must be used within CanvasStateProvider"
4. Add a node
5. Verify operations work (no context errors)

**Expected Result**:
- ✅ No context errors in console
- ✅ All operations function correctly
- ✅ Context provides all expected values

**Failure Indicators**:
- ❌ Error: "useCanvasContext must be used within CanvasStateProvider"
- ❌ Operations fail due to undefined context

---

## Test Automation Setup (Future)

To automate these tests in the future, install:

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom
```

Create `jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

---

## Test Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| Data Integrity | 3 | ✅ Manual procedures documented |
| State Management | 3 | ✅ Manual procedures documented |
| Event Handlers | 4 | ✅ Manual procedures documented |
| Race Conditions | 2 | ✅ Manual procedures documented |
| Context API | 1 | ✅ Manual procedures documented |
| **Total** | **13** | **100% Documented** |

---

## Quick Smoke Test (5 minutes)

Run this quick test before each deployment:

1. **Create Canvas**: ✅ Create new canvas
2. **Add Nodes**: ✅ Add 3 nodes
3. **Connect**: ✅ Connect nodes with edges
4. **Move**: ✅ Drag nodes to new positions
5. **Select**: ✅ Click node, verify inspector opens
6. **Update**: ✅ Change node label in inspector
7. **Duplicate**: ✅ Duplicate a node
8. **Delete**: ✅ Delete a node (verify edges removed)
9. **Duplicate Edge**: ✅ Try creating duplicate connection (verify toast)
10. **Switch Canvas**: ✅ Create second canvas, switch between them
11. **Refresh**: ✅ Refresh page, verify data persisted

If all 11 steps pass: ✅ **READY TO DEPLOY**

---

## Regression Test Checklist

Before merging major changes, verify:

- [ ] All smoke tests pass
- [ ] Cascade delete removes edges
- [ ] Multi-node position saving works
- [ ] Duplicate edge prevention works
- [ ] Loading indicators appear
- [ ] Error notifications appear
- [ ] Race conditions handled
- [ ] Context available to all components
- [ ] No console errors
- [ ] Data persists after refresh

---

**Last Updated**: Phase 3 Implementation (2025-11-24)
**Maintained By**: Canvas Architecture Team
