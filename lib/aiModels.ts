/**
 * Every model id this app sends traffic to, in one place.
 *
 * Both providers retired a pinned model out from under this app in Aug 2026 —
 * Groq dropped `llama-3.3-70b-versatile` and Google dropped `gemini-2.0-flash`.
 * Chat 500'd on both paths and the daily email, which is Groq-only, went quiet
 * for eighteen days without a single error surfacing. The ids were hard-coded
 * in two route files; the second copy is how one retirement becomes two
 * outages. Change a model here and both callers move together.
 *
 * Picking a replacement: prefer a GA model over `-preview`, and over a
 * `-latest` alias that can shift under you. Newest is not safest — the newest
 * flash returned "experiencing high demand" on the first call, which is not
 * what a user-facing chat path should sit behind.
 */

/** Primary chat model. */
export const GEMINI_MODEL = "gemini-3.5-flash";

/** Chat fallback, and the only model behind /api/daily-quote. */
export const GROQ_MODEL = "openai/gpt-oss-120b";

/**
 * gpt-oss spends its token budget on reasoning before emitting any content, so
 * a short cap returns an empty string unless effort is pinned low. Required for
 * the daily quote's 120-token replies to come back at all, not a preference.
 */
export const GROQ_REASONING_EFFORT = "low" as const;
