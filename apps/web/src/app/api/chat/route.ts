import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Missing messages array" },
        { status: 400 }
      );
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o for better general knowledge and reasoning
      messages,
    });

    const reply =
      completion.choices?.[0]?.message?.content ??
      "Sorry, I couldn't generate a response.";

    // 👈 THIS is what the browser will see
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Error in /api/chat:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
