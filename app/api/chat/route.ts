import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { verifyAuth } from "@/lib/apiAuth";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Limits
const MAX_MESSAGES       = 30;
const MAX_MESSAGE_CHARS  = 8_000;
const MAX_PROMPT_CHARS   = 60_000;

export async function POST(req: NextRequest) {
  // ── Auth ──
  const auth = req.headers.get("authorization");
  if (!(await verifyAuth(auth))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit: 25 req / minute per IP ──
  const key = `chat:${clientKey(req)}`;
  if (!rateLimit(key, 25, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { messages, systemPrompt } = body;

    // ── Input validation ──
    if (!Array.isArray(messages) || typeof systemPrompt !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json({ error: "Too many messages" }, { status: 400 });
    }
    if (systemPrompt.length > MAX_PROMPT_CHARS) {
      return NextResponse.json({ error: "System prompt too large" }, { status: 400 });
    }
    for (const m of messages) {
      if (typeof m?.content === "string" && m.content.length > MAX_MESSAGE_CHARS) {
        return NextResponse.json({ error: "Message too large" }, { status: 400 });
      }
    }

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    });

    const text = response.choices[0]?.message?.content ?? "I'm here 🧡";
    return NextResponse.json({ text });
  } catch {
    // Do not expose internal error details to the client
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
