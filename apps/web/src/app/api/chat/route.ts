import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY is missing");
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on server" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      console.error("Bad request body:", body);
      return NextResponse.json(
        { error: "Request body must include a non-empty 'messages' array" },
        { status: 400 }
      );
    }

    const formattedMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    console.log("Calling OpenAI with messages:", formattedMessages);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: formattedMessages,
      }),
    });

    const data = await response.json();
    console.log("OpenAI raw response:", data);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? "OpenAI API error" },
        { status: 500 }
      );
    }

    const reply = data.choices?.[0]?.message;
    if (!reply) {
      return NextResponse.json(
        { error: "No reply from OpenAI" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
