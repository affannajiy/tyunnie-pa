import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { verifyAuth } from "@/lib/apiAuth";

// ── Clients ──
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Limits
const MAX_MESSAGES      = 30;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_PROMPT_CHARS  = 60_000;

// Gemini safety thresholds — keep permissive so Taehyun persona isn't
// blocked on benign emotional language. BLOCK_ONLY_HIGH still catches
// genuinely harmful content.
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

// ── Message shape coming from TyunniePanel / MusicContext ──
interface IncomingMessage {
  role: string;
  content: string;
}

// ── Gemini helper ──
// Converts OpenAI-style { role, content }[] + systemPrompt into Gemini's
// startChat() / sendMessage() format. Gemini roles are "user" / "model"
// (not "assistant"). The system instruction is passed separately, not as
// a message, so the conversation history begins at the first user turn.
async function callGemini(
  systemPrompt: string,
  messages: IncomingMessage[],
): Promise<string> {
  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      maxOutputTokens: 400,
      temperature: 0.85,
    },
  });

  // Split history (all turns except the last) from the final user message.
  // Gemini requires the chat history to alternate user/model and end on a
  // model turn, then sendMessage() appends the new user turn.
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    throw new Error("Last message must be a user turn");
  }

  const chat   = model.startChat({ history });
  const result = await chat.sendMessage(lastMessage.content);
  const text   = result.response.text();

  // Guard: Gemini returns an empty string when blocked by safety filters
  // even at BLOCK_ONLY_HIGH. Fall through to Groq fallback in that case.
  if (!text || text.trim() === "") {
    throw new Error("Gemini returned empty response (possible safety block)");
  }

  return text;
}

// ── Groq fallback ──
async function callGroq(
  systemPrompt: string,
  messages: IncomingMessage[],
): Promise<string> {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 400,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });
  return response.choices[0]?.message?.content ?? "I'm here 🧡";
}

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
    // Gemini requires at least one user message and the last turn must be user
    if (messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // ── Primary: Gemini 2.0 Flash ──
    let text: string;
    try {
      text = await callGemini(systemPrompt, messages);
    } catch {
      // ── Fallback: Groq llama-3.3-70b ──
      text = await callGroq(systemPrompt, messages);
    }

    return NextResponse.json({ text });
  } catch {
    // Do not expose internal error details to the client
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
