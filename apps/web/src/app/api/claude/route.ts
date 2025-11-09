/**
 * Claude API Proxy Route
 *
 * This route acts as a server-side proxy for Claude API calls.
 * Required because Anthropic blocks direct browser requests with CORS.
 *
 * The user's Claude API key is sent in the request body (never stored on server).
 */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey, model, messages, systemPrompt } = body;

    // Validate required fields
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing Claude API key" },
        { status: 400 }
      );
    }

    if (!model) {
      return NextResponse.json(
        { error: "Missing model parameter" },
        { status: 400 }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Missing messages array" },
        { status: 400 }
      );
    }

    console.log("=".repeat(60));
    console.log("🤖 CLAUDE API REQUEST");
    console.log("Model requested:", model);
    console.log("Number of messages:", messages.length);
    console.log("Has system prompt:", !!systemPrompt);
    console.log("=".repeat(60));

    // Build request body for Claude API
    const requestBody: any = {
      model,
      max_tokens: 8192,
      messages,
    };

    // Add system prompt if provided
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    // Make request to Claude API from server
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      console.error("Claude API error:", errorMessage);

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract the text content from Claude's response
    const content = data.content?.[0]?.text;

    if (!content) {
      return NextResponse.json(
        { error: "No response from Claude" },
        { status: 500 }
      );
    }

    console.log("✅ Claude response received successfully");
    console.log("Response length:", content.length, "characters");
    console.log("=".repeat(60));

    // Return the reply in the same format as OpenAI route
    return NextResponse.json({ reply: content });
  } catch (err) {
    console.error("Error in /api/claude:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
