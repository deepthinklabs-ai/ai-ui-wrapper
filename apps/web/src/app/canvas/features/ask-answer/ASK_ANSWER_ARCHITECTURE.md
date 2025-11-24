# Ask/Answer Feature Architecture

**Feature**: Inter-node communication where Genesis Bot Node A can ask questions to Genesis Bot Node B

## Overview

Allows connected Genesis Bot nodes to communicate with each other:
1. User enables "Ask/Answer" mode on an edge connection
2. Node A sends a query to Node B
3. Node B processes the query and returns an answer
4. Answer appears in Node A for user review
5. User can review and submit new query

## Data Model

### Edge Metadata Extension
```typescript
interface CanvasEdge {
  // ... existing fields
  metadata?: {
    askAnswerEnabled?: boolean;
    lastQuery?: {
      query: string;
      answer: string;
      timestamp: string;
      status: 'pending' | 'answered' | 'error';
    };
  };
}
```

### Genesis Bot Node Config Extension
```typescript
interface GenesisBotConfig {
  // ... existing fields
  askAnswer?: {
    pendingQueries: Array<{
      fromNodeId: string;
      query: string;
      timestamp: string;
    }>;
    lastAnswer?: {
      query: string;
      answer: string;
      timestamp: string;
    };
  };
}
```

## Component Architecture

```
src/app/canvas/features/ask-answer/
├── ASK_ANSWER_ARCHITECTURE.md          # This file
├── hooks/
│   ├── useAskAnswer.ts                  # Main state management hook
│   ├── useAskAnswerQuery.ts             # Query sending logic
│   └── useAskAnswerAnswer.ts            # Answer processing logic
├── components/
│   ├── AskAnswerToggle.tsx              # Edge config toggle
│   ├── QueryInput.tsx                   # Query input for Node A
│   ├── QueryReviewPanel.tsx             # Review panel showing Q&A
│   └── AnswerIndicator.tsx              # Visual indicator on edge
└── lib/
    ├── askAnswerAPI.ts                  # API calls to AI
    └── askAnswerValidation.ts           # Validation logic
```

## User Flow

### 1. Enable Ask/Answer Mode
- User selects an edge between two Genesis Bot nodes
- User toggles "Ask/Answer" mode ON
- Edge metadata updated with `askAnswerEnabled: true`
- Visual indicator appears on edge (e.g., question mark icon)

### 2. Send Query from Node A
- User opens Node A inspector
- "Ask Question" input appears (if connected to Node B with Ask/Answer enabled)
- User types question and clicks "Send"
- Query sent to Node B with context from Node A

### 3. Node B Processes Query
- Node B receives query in its context
- Node B's AI processes query using its system prompt + context
- Answer generated and stored in edge metadata
- Visual indicator on edge changes (e.g., checkmark icon)

### 4. Answer Received by Node A
- Node A inspector shows "New Answer" notification
- User clicks "View Answer"
- QueryReviewPanel displays:
  - Original query
  - Answer from Node B
  - Timestamp
  - Option to send new query

### 5. Review and Continue
- User reviews answer
- Can copy answer to clipboard
- Can send follow-up question
- No automatic response - user controls next action

## Implementation Plan

### Phase 1: Data Layer
1. Update edge metadata schema
2. Update Genesis Bot node config schema
3. Create database migration (if needed)

### Phase 2: State Management
1. Create `useAskAnswer` hook
2. Create `useAskAnswerQuery` hook
3. Create `useAskAnswerAnswer` hook

### Phase 3: UI Components
1. Create `AskAnswerToggle` component
2. Create `QueryInput` component
3. Create `QueryReviewPanel` component
4. Create `AnswerIndicator` component

### Phase 4: Integration
1. Integrate toggle into edge inspector/config
2. Integrate query input into Genesis Bot node inspector
3. Integrate answer display into Genesis Bot node
4. Add visual indicators to edges

### Phase 5: API Integration
1. Create API endpoint for processing queries
2. Integrate with existing AI clients (Claude, OpenAI, etc.)
3. Add error handling and retries

## Technical Considerations

### Segmentation
- **Feature isolation**: All Ask/Answer code in `features/ask-answer/`
- **No cross-contamination**: Existing Canvas code unchanged
- **Clean interfaces**: Hooks expose simple API
- **Reusable components**: Components work independently

### Performance
- **Debounce queries**: Prevent rapid-fire requests
- **Cache answers**: Store in edge metadata
- **Lazy loading**: Only load Ask/Answer when needed

### Error Handling
- **API failures**: Show error in QueryReviewPanel
- **Timeout handling**: 30-second timeout for answers
- **Retry logic**: Allow user to retry failed queries

### Security
- **Node validation**: Ensure both nodes are Genesis Bots
- **Edge validation**: Ensure edge exists and is valid
- **Context sanitization**: Clean data before sending to AI

## Visual Indicators

### Edge States
- **Disabled**: Normal edge appearance
- **Enabled (idle)**: Question mark icon on edge label
- **Query pending**: Animated spinner on edge
- **Answer ready**: Checkmark icon on edge
- **Error**: Red X icon on edge

### Node States (Node A)
- **No connection**: No Ask/Answer UI
- **Connected (idle)**: "Ask Question" button visible
- **Query sent**: Disabled input + "Waiting for answer..."
- **Answer received**: "View Answer" badge/notification

## API Structure

### Query Request
```typescript
POST /api/canvas/ask-answer/query
{
  canvasId: string;
  fromNodeId: string;  // Node A
  toNodeId: string;    // Node B
  edgeId: string;
  query: string;
}
```

### Query Response
```typescript
{
  success: boolean;
  answer?: string;
  error?: string;
  timestamp: string;
}
```

## Testing Checklist

- [ ] Enable Ask/Answer on edge
- [ ] Send query from Node A
- [ ] Verify Node B receives query with context
- [ ] Verify answer generated correctly
- [ ] Verify answer appears in Node A
- [ ] Send follow-up question
- [ ] Disable Ask/Answer and verify cleanup
- [ ] Test with multiple connected nodes
- [ ] Test error scenarios (API failure, timeout)
- [ ] Test edge deletion (cleanup queries)

## Future Enhancements

- **Multi-hop queries**: Node A → Node B → Node C
- **Query history**: Show all previous Q&A pairs
- **Export conversations**: Download Q&A as JSON/CSV
- **Streaming answers**: Show answer as it's generated
- **Query templates**: Pre-defined question formats
