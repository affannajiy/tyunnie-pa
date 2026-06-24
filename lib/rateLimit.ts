/**
 * Lightweight in-memory rate limiter.
 * Works per-serverless-instance — good enough for a personal app on Vercel.
 * Entries older than `windowMs` are pruned on each call; idle keys are dropped
 * so the Map can't grow unbounded across many distinct IPs/users over a long-
 * lived instance. (For multi-instance / real traffic, move to Upstash/Vercel KV.)
 */

const store = new Map<string, number[]>();

// Track the widest window we've seen so the global sweep knows how long a key
// may legitimately stay populated (e.g. the 24h per-user daily quota).
let maxWindowMs = 0;
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 5 * 60_000; // sweep at most once every 5 min

/** Drop keys whose every timestamp has aged out of the widest active window. */
function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, hits] of store) {
    if (hits.every((t) => now - t >= maxWindowMs)) store.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  if (windowMs > maxWindowMs) maxWindowMs = windowMs;
  sweep(now);

  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    // Even when blocked, keep the pruned list current (and drop if now empty).
    if (hits.length === 0) store.delete(key);
    else store.set(key, hits);
    return false;
  }
  hits.push(now);
  store.set(key, hits);
  return true;
}

/** Extract a stable client key from request headers (Vercel forwards real IP). */
export function clientKey(req: Request): string {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
