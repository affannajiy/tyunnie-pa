---
name: tyun-network
description: >
  Audit or improve network performance and reliability in the Tyunnie PA project. Use
  for caching strategy, Cache-Control and s-maxage headers, bundle size, dynamic
  imports, preconnect/dns-prefetch hints, response times, external API timeouts and
  fallbacks, and cold-start behaviour. For auth, CSP, RLS, crypto, or injection risk
  use tyun-security instead.
---

Network and delivery performance for Tyunnie PA. Find milliseconds before the user
feels them — without trading away a security control to get them.

## Read these first

- **`SECURITY.md`** (repo root) — current caching strategy, external API list, and the
  in-memory rate limiter / OTP cold-start limitation. Performance changes that touch
  caching or state persistence interact with these directly.
- **`.claude/CLAUDE.md`** — settled invariants: `/_next/static` immutable caching is
  **production-only** (it breaks HMR in dev), `optimizePackageImports` covers
  `lucide-react`/`recharts`/`date-fns`, `dynamic<Props>()` typing requirement.

---

## Checklist

### Caching
- [ ] New static assets served with an appropriate `Cache-Control`?
- [ ] New API routes returning stable data cached — `Cache-Control` for the browser
      **and** `s-maxage`/`next: { revalidate }` for the CDN? A server-side revalidate
      alone still re-invokes the function on every client request.
- [ ] Auth-gated responses marked `private`, never `public`?
- [ ] Weather, exchange rates, changelog — cached rather than refetched per mount?

### Bundle
- [ ] Large new dependencies added to `optimizePackageImports` in `next.config.ts`?
- [ ] Heavy new components wrapped in `dynamic()` with a `loading` skeleton?
- [ ] Third-party scripts via `next/script` with `strategy="lazyOnload"` where possible?
- [ ] Icons imported per-icon, not as a namespace?

### Requests
- [ ] External calls have a timeout (`AbortSignal.timeout(...)`)?
- [ ] Graceful fallback when a request fails or times out — degraded, not broken?
- [ ] Parallel fetches use `Promise.all()` rather than sequential `await`?
- [ ] New external origin added to `<link rel="preconnect">` in `app/layout.tsx` —
      **and** to the CSP `connect-src` (that half is `tyun-security`'s, but catch it here)?

### Loading & paint
- [ ] LCP-critical images preloaded with `fetchPriority="high"`?
- [ ] Fonts using a `display` strategy that doesn't shift layout (`optional` for the
      above-the-fold serif — this was a real CLS source, don't "fix" it back to `swap`)?
- [ ] Real intrinsic width/height on images so nothing reflows?
- [ ] rAF loops checking `prefers-reduced-motion` via `matchMedia` — the globals.css
      block only reaches CSS transitions, never a JS loop?

### Vercel / edge
- [ ] Routes needing global low latency considered for Edge runtime?
- [ ] Anything relying on in-memory state that won't survive a cold start — documented?
- [ ] Cron guarded and not triggerable unauthenticated?

---

## Severity

- 🔴 **Critical** — page unusable: blocking resource, unbounded request, broken lazy boundary
- 🟠 **High** — clearly felt: uncached expensive endpoint, missing timeout on a critical path, large blocking bundle
- 🟡 **Medium** — measurable but tolerable: redundant fetch, missing preconnect, avoidable sequential await
- 🟢 **Low** — marginal: micro-optimisation, header tidy-up

Rate by what the user actually feels on a mid-range phone, not by what a synthetic
score rewards.

---

## How to run it

**Targeted check — inline.** Read the route or component, walk the relevant section.

**Full performance pass:**
1. `app/layout.tsx` — preconnect coverage for every external origin
2. `next.config.ts` — `optimizePackageImports` covers all large deps; cache headers correct
3. `app/dashboard/page.tsx` — grep `dynamic(`; every heavy panel lazy
4. New API routes — `Cache-Control` on stable responses
5. `loadAll()` — `Promise.all` vs sequential `await`
6. `grep -rn "fetch(" components/ lib/` — missing timeout or fallback

If the sweep spans the whole app rather than a few files, spawn a subagent for the
reading phase and relay its findings.

---

## Out of scope

Never trade a security control for speed — no bypassing auth for caching, no widening
a CSP directive to save a request, no caching an authorization decision (the data,
yes; the yes/no answer, never). Auth, CSP, RLS, crypto, and injection belong to
`tyun-security`. Correctness, failure handling, and timeout *policy* belong to
`tyun-engineer` — this skill cares whether a call is slow, not whether its failure is
reported. Don't rewrite business logic or UI.
