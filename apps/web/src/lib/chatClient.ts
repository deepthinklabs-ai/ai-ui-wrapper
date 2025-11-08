"use client";

import type { MessageRole } from "@/types/chat";

// OpenAI Vision API supports content as either string or array of content parts
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: MessageRole;
  content: string | ContentPart[];
};

export type ChatClientOptions = {
  endpoint?: string; // allow override later if needed
};

type OpenAIStyleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const DEFAULT_ENDPOINT = "/api/chat";

export async function sendChatRequest(
  messages: ChatMessage[],
  options: ChatClientOptions = {}
): Promise<string> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    let extra = "";
    try {
      const text = await res.text();
      if (text) extra = ` – ${text}`;
    } catch {
      // ignore
    }
    throw new Error(
      `Chat API error: ${res.status} ${res.statusText}${extra}`
    );
  }

  let json: any;
  try {
    json = await res.json();
  } catch (err) {
    console.error("Chat API: failed to parse JSON:", err);
    throw new Error("Chat API: invalid JSON response");
  }

  // 1) Preferred shape: { reply: string }
  if (json && typeof json.reply === "string") {
    return json.reply;
  }

  // 2) Fallback: raw OpenAI-style shape with choices[0].message.content
  if (
    json &&
    typeof json === "object" &&
    Array.isArray((json as OpenAIStyleResponse).choices) &&
    (json as OpenAIStyleResponse).choices![0]?.message?.content
  ) {
    return (json as OpenAIStyleResponse).choices![0]!.message!.content!;
  }

  // 3) Last resort: if the whole JSON *is* a string
  if (typeof json === "string") {
    return json;
  }

  console.error("Chat API: unexpected response shape", json);
  throw new Error("Chat API: invalid response shape");
}
