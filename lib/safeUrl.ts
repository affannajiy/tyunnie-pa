/**
 * Scheme allowlist for any URL that came from a user and ends up in an `href`.
 *
 * React escapes text, but it does not police URL schemes: `href={value}` with
 * `javascript:alert(1)` executes on click, and `data:text/html,…` navigates to
 * attacker-authored markup on this origin's tab. The vault stores a `website`
 * field per entry, so this is a stored-XSS path with a click as the trigger
 * (SECURITY_Rulebook §2b.1 — encode for the receiving context; the URL context
 * is a scheme decision, not an escaping one).
 *
 * Allowlist, not denylist (§2a.2): `javascript:`, `vbscript:`, `data:` and
 * every scheme nobody has thought of yet all fail the same way.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Returns a URL safe to place in an `href`, or `null` when it is not.
 * A bare host (`example.com`) is read as `https://example.com` — that is the
 * shape people actually type, and defaulting to https rather than http keeps
 * §2j.1 intact.
 */
export function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Parse before deciding. A scheme check by string prefix is defeated by
  // "java\tscript:", leading control characters, and case — the URL parser
  // canonicalises all of that, so it is the thing that must answer (§2a.4).
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
