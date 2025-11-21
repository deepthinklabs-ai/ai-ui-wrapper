// apps/web/src/types/chat.ts
export type MessageRole = "user" | "assistant" | "system";

export type Thread = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AttachmentMetadata = {
  name: string;
  type: string;
  size: number;
  content: string; // base64 for images, text content for text files
  isImage: boolean;
};

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, any>;
  serverId?: string;
  serverName?: string;
};

export type ToolResult = {
  toolCallId: string;
  toolName: string;
  result: any;
  isError: boolean;
};

export type Citation = {
  url: string;
  title?: string;
  cited_text?: string;
};

export type Message = {
  id: string;
  thread_id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  attachments?: AttachmentMetadata[] | null;
  created_at: string;
  // Token usage from API (null for user messages, populated for assistant responses)
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  // MCP tool calling (for assistant messages)
  tool_calls?: ToolCall[] | null;
  tool_results?: ToolResult[] | null;
  // Web search citations (for assistant messages with web search)
  citations?: Citation[] | null;
};
