# MCP Tool Calling Integration - Complete Guide

## Overview

This document describes the complete MCP tool calling integration that enables LLMs to automatically discover and use tools from connected MCP servers (like GitHub, filesystem, memory, etc.).

## What We've Built

### ✅ Completed Infrastructure

#### 1. **Tool Formatting** (`src/lib/mcpToolFormatter.ts`)
- Converts MCP tools to Claude/OpenAI formats
- Parses tool calls from LLM responses
- Formats tool results for LLM
- Finds which server provides each tool

#### 2. **Pro Claude API Updates** (`src/app/api/pro/claude/route.ts`)
- Accepts `tools` array in request
- Passes tools to Claude API
- Returns full `contentBlocks` including tool_use
- Returns `stop_reason` to detect tool calling

#### 3. **Tool Execution** (`src/lib/toolExecutor.ts`)
- Executes tool calls via MCP servers
- Parallel tool execution
- Error handling
- Result formatting

#### 4. **Type Definitions** (`src/types/chat.ts`)
- `ToolCall` type
- `ToolResult` type
- Extended `Message` type with tool_calls and tool_results

#### 5. **Backend Stdio Proxy** (`src/app/api/mcp/stdio/route.ts`)
- Enables stdio MCP servers in browser
- GitHub MCP server fully functional

## How It Works

### Tool Calling Flow

```
1. User sends message
   ↓
2. useMCPServers provides available tools
   ↓
3. Tools formatted for Claude via formatToolsForClaude()
   ↓
4. Message sent to /api/pro/claude with tools
   ↓
5. Claude decides to use tools (stop_reason: 'tool_use')
   ↓
6. Parse tool_use blocks from contentBlocks
   ↓
7. Execute tools via executeToolCalls()
   ↓
8. Format results via formatToolResultForClaude()
   ↓
9. Send results back to Claude
   ↓
10. Claude responds with final answer
    ↓
11. Display to user
```

### Integration Points

To complete the integration, modify these files:

#### A. **useMessages Hook** (`src/hooks/useMessages.ts`)

Add tool calling support to sendMessage:

```typescript
import { useMCPServers } from "./useMCPServers";
import { formatToolsForClaude, parseClaudeToolUse, formatToolResultForClaude } from "@/lib/mcpToolFormatter";
import { executeToolCalls } from "@/lib/toolExecutor";

// In useMessages hook:
const { tools } = useMCPServers();

const sendMessage = async (content: string, files: File[]) => {
  // ... existing code ...

  // Format tools for Claude
  const claudeTools = tools.length > 0 ? formatToolsForClaude(tools) : undefined;

  // Send to API with tools
  const response = await fetch("/api/pro/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      messages: formattedMessages,
      model,
      systemPrompt,
      tools: claudeTools, // Include tools
    }),
  });

  const data = await response.json();

  // Check if Claude wants to use tools
  if (data.stop_reason === "tool_use") {
    // Parse tool calls
    const toolCalls = parseClaudeToolUse(data.contentBlocks);

    // Execute tools
    const toolResults = await executeToolCalls(toolCalls, tools);

    // Save assistant message with tool calls
    await saveAssistantMessage({
      content: "", // No text content yet
      tool_calls: toolCalls,
      tool_results: toolResults,
    });

    // Format tool results for Claude
    const toolResultBlocks = toolResults.map(result =>
      formatToolResultForClaude(result.toolCallId, result.result, result.isError)
    );

    // Continue conversation with tool results
    const continueResponse = await fetch("/api/pro/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        messages: [
          ...formattedMessages,
          { role: "assistant", content: data.contentBlocks },
          { role: "user", content: toolResultBlocks },
        ],
        model,
        systemPrompt,
        tools: claudeTools,
      }),
    });

    const finalData = await continueResponse.json();

    // Save final response
    await saveAssistantMessage({
      content: finalData.content,
    });
  } else {
    // Normal response, no tools
    await saveAssistantMessage({
      content: data.content,
    });
  }
};
```

#### B. **Message Display** Component

Create `ToolCallDisplay.tsx`:

```typescript
import type { ToolCall, ToolResult } from "@/types/chat";

export function ToolCallDisplay({
  toolCalls,
  toolResults
}: {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}) {
  return (
    <div className="space-y-2 p-3 bg-blue-950/30 border border-blue-800/30 rounded-lg">
      <div className="text-xs font-medium text-blue-300">
        🔧 Tool Usage
      </div>

      {toolCalls.map((call, index) => {
        const result = toolResults.find(r => r.toolCallId === call.id);

        return (
          <details key={call.id} className="text-sm">
            <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
              {call.name}
              {result && (
                <span className={result.isError ? "text-red-400" : "text-green-400"}>
                  {result.isError ? " ✗" : " ✓"}
                </span>
              )}
            </summary>

            <div className="mt-2 space-y-2 pl-4">
              <div>
                <div className="text-xs text-gray-400">Input:</div>
                <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
                  {JSON.stringify(call.input, null, 2)}
                </pre>
              </div>

              {result && (
                <div>
                  <div className="text-xs text-gray-400">Result:</div>
                  <pre className={`text-xs p-2 rounded overflow-x-auto ${
                    result.isError ? "bg-red-950 text-red-300" : "bg-gray-900 text-gray-300"
                  }`}>
                    {typeof result.result === "string"
                      ? result.result
                      : JSON.stringify(result.result, null, 2)
                    }
                  </pre>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
```

Update MessageList to show tool calls:

```typescript
import { ToolCallDisplay } from "./ToolCallDisplay";

// In message rendering:
{message.tool_calls && message.tool_results && (
  <ToolCallDisplay
    toolCalls={message.tool_calls}
    toolResults={message.tool_results}
  />
)}
```

#### C. **Database Schema Update**

Add columns to `messages` table:

```sql
ALTER TABLE messages
ADD COLUMN tool_calls JSONB,
ADD COLUMN tool_results JSONB;
```

## Usage Examples

Once integrated, users can:

### Example 1: GitHub Repository Search

**User**: "Search GitHub for popular React state management libraries"

**Flow**:
1. Claude receives available GitHub tools
2. Claude uses `search_repositories` tool with query "React state management"
3. Tool executes → returns repo list
4. Claude formats results for user
5. User sees formatted list of libraries

### Example 2: Create GitHub Issue

**User**: "Create an issue in my repo username/project about the login bug"

**Flow**:
1. Claude uses `create_issue` tool
2. Provides: repo, title, body
3. Tool executes → creates issue
4. Claude confirms with issue URL
5. User sees confirmation

### Example 3: Multi-Tool Workflow

**User**: "Find the most popular TypeScript framework and show me its README"

**Flow**:
1. Claude uses `search_repositories` (filters: TypeScript, sorted by stars)
2. Gets top result
3. Claude uses `get_file_contents` (repo from step 1, path: README.md)
4. Displays README to user

## Testing the Integration

### 1. Setup GitHub MCP Server

Follow `GITHUB_MCP_SETUP.md`:
- Get GitHub token
- Add to MCP settings
- Enable server
- Verify connection

### 2. Enable Tools in Dashboard

```typescript
// In dashboard, pass tools to useMessages:
const { tools } = useMCPServers();

const { sendMessage } = useMessages(threadId, {
  // ... other options
  mcpTools: tools, // Pass tools
});
```

### 3. Test Simple Tool Call

**User**: "What is the React repository's description?"

**Expected**:
- Claude uses `search_repositories` or similar
- Returns React repo info
- Displays to user

### 4. Test Error Handling

**User**: "Get file from nonexistent/repo"

**Expected**:
- Tool executes
- Returns error
- Claude explains error to user

## Current Status

### ✅ Complete
- MCP server connection (stdio + SSE)
- GitHub server integration
- Tool discovery
- Tool execution
- Tool formatting
- API support for tools
- Type definitions
- Error handling
- Documentation

### ⏳ Remaining Integration Steps

1. **Update useMessages** hook (30 min)
   - Add tool calling flow
   - Handle tool_use responses
   - Execute tools
   - Continue conversation with results

2. **Create ToolCallDisplay** component (20 min)
   - Show tool usage
   - Display inputs/outputs
   - Error indicators

3. **Update MessageList** (10 min)
   - Render tool calls
   - Show tool results

4. **Database Migration** (5 min)
   - Add tool_calls column
   - Add tool_results column

5. **Testing** (30 min)
   - Test with GitHub tools
   - Verify error handling
   - Test multi-tool workflows

**Total estimated time**: ~2 hours

## Benefits

Once complete, users get:

- ✅ **Automatic tool usage** - AI uses tools when appropriate
- ✅ **GitHub integration** - Query repos, create issues, read files
- ✅ **Filesystem access** - Read/write local files (if configured)
- ✅ **Web search** - Via Brave Search MCP server
- ✅ **Memory** - Persistent conversation memory
- ✅ **Extensibility** - Easy to add more MCP servers

## Security Considerations

- ✅ Tools only execute when LLM explicitly calls them
- ✅ User can see all tool calls and results
- ✅ Errors are caught and shown
- ✅ GitHub token stays in browser localStorage
- ✅ Backend validates all requests
- ⚠️ User should review tool calls before trusting results

## Next Steps

To complete the integration:

1. Implement the code snippets above in respective files
2. Run database migration
3. Test with GitHub MCP server
4. Add more MCP servers (filesystem, memory, etc.)
5. Enhance UI with better tool call visualization
6. Add user confirmation for destructive operations

## Files Modified/Created

### Created:
- `src/lib/mcpToolFormatter.ts` - Tool formatting utilities
- `src/lib/toolExecutor.ts` - Tool execution logic
- `src/components/dashboard/ToolCallDisplay.tsx` - UI component (to create)

### Modified:
- `src/app/api/pro/claude/route.ts` - Added tools support
- `src/types/chat.ts` - Added tool types
- `src/hooks/useMessages.ts` - Add tool calling flow (to modify)
- `src/components/dashboard/MessageList.tsx` - Show tool calls (to modify)

## Resources

- Claude Tool Use: https://docs.anthropic.com/claude/docs/tool-use
- MCP Specification: https://github.com/modelcontextprotocol/specification
- GitHub MCP Server: https://github.com/modelcontextprotocol/servers/tree/main/src/github
