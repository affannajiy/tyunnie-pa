/**
 * Calendar-day keys, in the user's own day.
 *
 * ── Why this file exists ──
 * `new Date().toISOString().split("T")[0]` was the app's idiom for "today" in
 * nine places. It does not return today. It returns today *in UTC*. For a user
 * in Malaysia (UTC+8) every moment between 00:00 and 08:00 local time reports
 * the previous calendar date, so:
 *   • "add a task due today" at 1am filed it against yesterday,
 *   • the Desk one-liner's daily cache key rolled over eight hours early,
 *   • a finance entry logged before breakfast landed on the wrong day.
 *
 * `Writing.tsx` had already found this and fixed its own copy with a local
 * `mytDayKey()` that added eight hours before slicing. That is Engineering
 * Rulebook §1.13 exactly — duplicated logic, one copy fixed, the rest left
 * wrong — so the fix moves here and every caller shares it (§2.7).
 *
 * ── Why local time, not a hardcoded UTC+8 ──
 * `mytDayKey` pinned the offset to +8. A pinned offset is §1.21 (hardcoded
 * configuration): correct for one timezone and silently wrong everywhere else,
 * with no way to change it but a code edit. The runtime already knows the
 * user's zone, and the surrounding code already trusts it — `buildSystemPrompt`
 * derives "morning/afternoon/evening" from `getHours()`, which is local. Mixing
 * a local clock with a UTC date in one function is how that prompt could
 * announce "it's night" and "today is <yesterday>" in the same breath (§3.5).
 *
 * For a user in Malaysia local time IS MYT, so this preserves the behavior
 * `Writing.tsx` wanted while being right for everyone else too.
 *
 * ── Note on server code ──
 * These are for the browser, where "local" means the user's device. Server
 * routes run in Vercel's UTC and must not use them to infer a user's day.
 */

/** Format a Date as `YYYY-MM-DD` using its local calendar fields. */
export function dayKeyOf(d: Date): string {
  // Built from local getters rather than an offset-then-toISOString trick, so
  // there is no arithmetic to get wrong and DST is handled by the platform.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's calendar day, `YYYY-MM-DD`. */
export function todayKey(): string {
  return dayKeyOf(new Date());
}

/** The calendar day `n` days from now. Negative goes back. */
export function dayKeyIn(days: number): string {
  const d = new Date();
  // setDate handles month and year rollover, and unlike adding 86_400_000 ms it
  // stays correct across a DST boundary.
  d.setDate(d.getDate() + days);
  return dayKeyOf(d);
}

/** The calendar day `n` days ago. */
export function daysAgoKey(days: number): string {
  return dayKeyIn(-days);
}

/**
 * Bucket a stored ISO timestamp into the calendar day it happened on, locally.
 * Used for streaks: a draft saved at 01:00 belongs to that day, not to the one
 * UTC was still on.
 */
export function dayKeyOfIso(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dayKeyOf(d);
}
