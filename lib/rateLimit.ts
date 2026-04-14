/**
 * Lightweight in-memory rate limiter.
 * Works per-serverless-instance — good enough for a personal app on Vercel.
 * Entries older than `windowMs` are pruned on each call to keep memory low.
 */

const store = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  store.set(key, hits);
  return true;
}

/** Extract a stable client key from request headers (Vercel forwards real IP). */
export function clientKey(req: Request): string {
  const forwarded = (req.headers as Headers).get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}
