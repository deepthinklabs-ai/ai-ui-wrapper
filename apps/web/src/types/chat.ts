// apps/web/src/types/chat.ts
export type MessageRole = "user" | "assistant" | "system";

export type Thread = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Message = {
  id: string;
  thread_id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  created_at: string;
};
