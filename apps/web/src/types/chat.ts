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

export type Message = {
  id: string;
  thread_id: string;
  role: MessageRole;
  content: string;
  model: string | null;
  attachments?: AttachmentMetadata[] | null;
  created_at: string;
};
