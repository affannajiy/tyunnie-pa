---
name: AI Backend — Gemini 2.0 Flash + Groq fallback
description: app/api/chat/route.ts uses Gemini 2.0 Flash as primary, Groq llama-3.3-70b as automatic fallback; @google/generative-ai already in package.json
type: project
---

`app/api/chat/route.ts` was updated (2026-04-14) to use Gemini 2.0 Flash as the primary model. Groq llama-3.3-70b-versatile is retained as an automatic silent fallback (caught exception in the inner try/catch).

Key implementation details:
- `@google/generative-ai` was already in package.json at ^0.24.1 — no install needed.
- Gemini requires roles `"user"` / `"model"` (not `"assistant"`); the adapter maps `assistant → model`.
- `systemInstruction` is passed to `getGenerativeModel()`, not injected as a message — this is the correct Gemini pattern.
- History is everything except the last message; the last user turn is sent via `chat.sendMessage()`.
- Safety settings are `BLOCK_ONLY_HIGH` on all four categories to prevent the Taehyun persona being blocked on benign emotional language.
- Empty string response from Gemini (safety block edge case) throws, which triggers Groq fallback.
- `GEMINI_API_KEY` must be added to `.env.local` and Vercel dashboard.
- `maxOutputTokens: 400`, `temperature: 0.85` — matches previous Groq limits.
- Response shape `{ text }` is unchanged — no changes needed in TyunniePanel or MusicContext.

**Why:** Gemini 2.0 Flash is free tier and produces better instruction-following than llama-3.3-70b, especially for the structured `<action>` JSON tags Tyunnie uses.

**How to apply:** When touching the chat route or AI behavior, remember Gemini is primary. If suggesting model changes, `gemini-2.0-flash` is the current model string. Do not remove the Groq fallback without explicit user request.
