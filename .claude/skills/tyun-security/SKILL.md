---
name: tyun-security
description: >
  Audit or review security posture in the Tyunnie PA project. Use for security
  reviews, adding a new API route, auth flow changes, CSP/header checks, Supabase RLS
  audits, rate limiting, input sanitisation, XSS/injection risk, vault and crypto
  concerns, and the pre-deploy security pass. For caching, bundle size, latency, and
  preconnect work use tyun-network instead.
---

Security review for Tyunnie PA. Find what's exploitable before it ships.

## Read these first

- **`SECURITY.md`** (repo root) — the current posture: auth layer, rate-limit tiers,
  vault crypto, headers, RLS, external APIs, **and the accepted-risk list**. This is
  the single source of truth for *what the app actually does today*. Do not restate it
  here and do not re-flag anything already logged there as accepted — check whether the
  accepted reasoning still holds instead.
- **`docs/SECURITY_Rulebook.md`** — the principles: §1 seven secure-design principles,
  §2 OWASP foundations, §3 SDLC practices, §4 conflict rulings. **Tag every finding
  with the section it violates** (e.g. "§1.6 complete mediation", "§3.6 input validation
  at the boundary"). Not optional framing — it's what makes findings arguable.

If a fact about the app contradicts `SECURITY.md`, `SECURITY.md` is stale and fixing it
is part of the job.

---

## Checklist

### API routes
- [ ] `verifyAuth()` / `getAuthUser()` before any data access?
- [ ] `getAuthUser()` — never a client-supplied email or user id — where identity matters?
- [ ] `rateLimit(clientKey(req), limit, windowMs)` applied, with sane limits?
- [ ] Anything that costs money per call (LLM, JDoodle, email) also has a per-user daily quota keyed on verified `user.id`?
- [ ] External fetches carry `AbortSignal.timeout(...)` so a hung upstream can't hold the function open?
- [ ] All secrets server-only — no `NEXT_PUBLIC_` prefix?
- [ ] Generic error to the client; the real error logged server-side, never returned?
- [ ] Cron routes guarded by constant-time `CRON_SECRET` check?

### Input handling
- [ ] User-supplied text through `sanitizeHtml()` before any `dangerouslySetInnerHTML`?
- [ ] Numeric input validated and clamped?
- [ ] **Anything reaching `new Function()` / `eval` gated by an allowlist** — including
      LLM-supplied values, which are untrusted input, not trusted output?
- [ ] File uploads restricted by type *and* size — at the **bucket**, not just the client?
      (`accept=` on an input is a picker hint, not a control.)
- [ ] Any new prompt surface not widening the client-assembled `systemPrompt` risk?

### Auth & data
- [ ] Service role key server-side only, never in a client bundle?
- [ ] OAuth redirect URIs exactly matched?
- [ ] Every table's RLS policy actually covers the operation used, not just SELECT?

### Vault
- [ ] PIN verified by AES-GCM decrypt-then-compare (authenticated, effectively timing-safe)?
- [ ] OTP via `crypto.randomInt`, compared with `crypto.timingSafeEqual`?
- [ ] Secrets never compared with `===`?
- [ ] AES-GCM IV unique per encryption — never reused?

### Destructive & agentic paths
- [ ] Every path to a destructive action confirms — **including the AI action path**, not
      just the UI button? Two entry points with one gate is the classic §1.6 failure.
- [ ] Read-only queries can't trigger destructive actions?

### CSP
- [ ] New external resource needs a directive? Is `connect-src` updated for a new API?
- [ ] Directives scoped to origins actually used — no bare `https:` standing in for a real list?

---

## Severity

- 🔴 **Critical** — exploitable now: unauthenticated endpoint, secret in client bundle, XSS, missing RLS, broken auth
- 🟠 **High** — exploitable under specific conditions: missing rate limit, unvalidated redirect, weak CSP directive, IV reuse
- 🟡 **Medium** — degrades reliability or leaks info: missing timeout, stack trace in response, state lost on cold start
- 🟢 **Low** — hardening: over-broad directive, uncached stable endpoint, documentation gap

Rate by **actual exploitability in this app**, not by category. A missing header that
another control already covers is Low, not High. Report file, line, concrete issue,
Rulebook section, severity, and a one-line fix direction.

---

## How to run it

**Single route or file — inline.** Read it, walk the checklist, grep for `verifyAuth`,
`rateLimit`, `sanitizeHtml` usage, check `next.config.ts` CSP if it calls out.

**Full pre-deploy sweep — spawn a subagent.** It reads ~60 files to return ~2k of
findings; that belongs in a throwaway context window, not this one. Brief it with:
scope, "read `SECURITY.md` first so you don't re-flag accepted risks", "tag findings
with `docs/SECURITY_Rulebook.md` sections", anything already fixed this session, and
"report only concrete issues found by reading actual code — no padding". Then relay
the findings.

The sweep covers: every `app/api/**/route.ts`; `SUPABASE_SERVICE_ROLE_KEY` never in
client files; every `dangerouslySetInnerHTML` through `sanitizeHtml()`; `fetch(` in
`components/` and `lib/` for missing timeout and fallback; `next.config.ts` CSP against
all external origins; `lib/rateLimit.ts` and `lib/apiAuth.ts` reaching every non-public
route.

After any audit, update the `SECURITY.md` audit log with the date and findings.

---

## Out of scope

Don't rewrite business logic or UI — security surface only. Never remove a control to
buy performance. Never present a client-side secret as acceptable under any framing.
Never approve a deploy with an unresolved 🔴. Caching, bundle, and latency belong to
`tyun-network`.
