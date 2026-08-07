# Security — Tyunnie PA

Security posture, audit history, known limitations, and backup plans. Last full audit: **2026-06-10** (pre-public-launch pass before sharing the Vercel link). Last robustness pass: **2026-06-24** (v3.22.0 — rate-limiter memory hardening, changelog cache fix, crash-guard sweep).

---

## Current Defences

| Layer | Implementation |
|---|---|
| API auth | Every non-cron route validates the Supabase JWT via `lib/apiAuth.ts` — `getAuthUser()` returns the verified user; `verifyAuth()` is the boolean wrapper |
| Recipient binding | `/api/vault-notify` emails ONLY the verified JWT's `user.email` — the client cannot choose the recipient (mail-relay prevention) |
| Rate limiting | Two-tier: per-IP burst + per-user daily quota (`lib/rateLimit.ts`). Chat: 25/min IP + 300/day user. Run: 10/min IP + 100/day user. Vault: 5/10min IP + per-user. Idle keys are pruned per-call + a 5-min global sweep (tracks widest active window) so the Map can't grow unbounded on a long-lived instance |
| LLM resilience | `/api/chat` calls Gemini 2.0 Flash first, falls back to Groq llama-3.3-70b on any error/timeout (missing both keys fails gracefully — generic error, no crash). `/api/daily-quote` is Groq-only |
| OTP | `crypto.randomInt` (CSPRNG), `crypto.timingSafeEqual` comparison, 10-min expiry, 5-attempt lockout, one-time use |
| Cron | `/api/daily-quote` guarded by `CRON_SECRET` Bearer token, constant-time compared |
| Vault crypto | AES-GCM 256-bit (Web Crypto), PBKDF2 100k iterations; fresh salt + 12-byte IV per encryption; PIN never stored (decrypt-then-compare verifier) |
| XSS | `sanitizeHtml()` on all AI output before `dangerouslySetInnerHTML` (tag allowlist `b|strong|em|i|code|br`, strips event handlers + `javascript:` URIs) |
| Headers | CSP (`default-src 'self'` + explicit `connect-src`), HSTS preload, `nosniff`, `frame-ancestors 'self'`, `X-XSS-Protection: 0`, `poweredByHeader: false` |
| Secrets | All API keys server-only (no `NEXT_PUBLIC_` on secrets); service role key used only in `app/api/daily-quote`; `.env*` gitignored and untracked |
| Upstream timeouts | JDoodle fetch `AbortSignal.timeout(15s)`; client weather fetches 5s timeouts with fallbacks |
| Guest mode | No JWT → all paid endpoints reject guests server-side, not just in UI |

### External APIs and their risk surface

| API | Auth | Risk surface |
|---|---|---|
| Gemini 2.0 Flash (primary chat) | `GEMINI_API_KEY` server-only | Prompt injection; token-cost abuse (capped 300/day per user) |
| Groq Llama 3.3 70B (chat fallback + daily-quote) | `GROQ_API_KEY` server-only | Same as Gemini |
| JDoodle (py/js/ts/bash) | `JDOODLE_CLIENT_ID/SECRET` server-only | Sandboxed exec; credit exhaustion (capped 100/day per user + 15s timeout) |
| Resend | `RESEND_API_KEY` server-only | Mail-relay abuse — prevented by binding the recipient to the JWT email |
| Open-Meteo | None | Public, read-only, low risk |
| Frankfurter (exchange rates) | None | Proxied via `/api/exchange-rates`, cached 1h (CDN + browser) |
| Cloudflare Speed Test | None | Client-side fetch, CORS-safe |
| Supabase | Anon key (public) + service role (server) | RLS must be tight; service role never client-side |

Any new external origin needs a CSP `connect-src` entry *and* a `preconnect` hint —
see the `tyun-security` and `tyun-network` skills.

---

## Audit Log — 2026-06-10 (pre-launch)

Findings and resolutions:

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | 🟠 High | `/api/vault-notify` sent emails to an arbitrary client-supplied address (phishing/spam relay for any signed-up user) | ✅ Fixed — recipient bound to verified JWT email |
| 2 | 🟠 High | `/api/chat` was an open LLM proxy (client-controlled 60k-char systemPrompt, only per-IP limit) | ✅ Mitigated — per-user 300/day quota added; server-side prompt assembly is the long-term plan |
| 3 | 🟠 High | In-memory rate limiter is per-serverless-instance, resets on cold start | ⚠️ Open — see Backup Plans |
| 4 | 🟡 Medium | OTP generated with `Math.random()` | ✅ Fixed — `crypto.randomInt` |
| 5 | 🟡 Medium | OTP / CRON_SECRET compared with `===` (timing) | ✅ Fixed — `crypto.timingSafeEqual` |
| 6 | 🟡 Medium | `/api/run` cost amplification vs JDoodle daily credits; no upstream timeout | ✅ Fixed — per-user 100/day quota + 15s `AbortSignal.timeout` |
| 7 | 🟡 Medium | CSP allows `unsafe-inline` + `unsafe-eval` in `script-src` | ⚠️ Accepted — required by Next.js inline scripts + Calculator `new Function()`; see Backup Plans |
| 8 | 🟡 Medium | Weather fetches (Weather.tsx, DeskWidgets.tsx) had no timeout/catch | ✅ Fixed — 5s timeouts + catch |
| 9 | 🟡 Medium | `/api/daily-quote` returned `ok:true` on DB failure (masked outages from cron monitoring) | ✅ Fixed — returns 500 |
| 10 | 🟢 Low | `x-forwarded-for` trusted as rate-limit key | ✅ Accepted on Vercel (platform-set header); per-user quotas reduce reliance |
| 11 | 🟢 Low | `X-XSS-Protection: 1; mode=block` (legacy filter has own vulns) | ✅ Fixed — set to `0` |
| 12 | 🟢 Low | Stale `api.groq.com` preconnect (client never calls Groq) | ✅ Fixed — removed |
| 13 | 🟢 Low | UTF-16 garbage line in `.gitignore` | ✅ Fixed |

Verified clean: no service-role key client-side, no secrets in git, all `dangerouslySetInnerHTML` sanitized, no IV reuse in vault crypto, guest mode enforced server-side, CSP `connect-src` covers all client origins, prompt-injection blast radius confined to the requesting user's own session.

---

## Robustness Pass — 2026-06-24 (v3.22.0)

Whole-codebase reliability sweep (no commit; bundled into the next release):

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | 🟡 Medium | `lib/rateLimit.ts` Map never deleted idle keys → slow unbounded growth across distinct IPs/users on a long-lived instance | ✅ Fixed — per-key delete-when-empty + 5-min global sweep keyed on widest active window |
| 2 | 🟡 Medium | `/about` "What's changed" rendered empty — `Cache-Control: max-age=3600` served pre-Highlights JSON from the browser cache after a deploy | ✅ Fixed — `public, max-age=0, s-maxage=3600, must-revalidate` + `cache:"no-store"` on both client fetches (about page + UpdateAnnouncement) |
| 3 | 🟡 Medium | `Weather.tsx` `JSON.parse(localStorage["tyunnie_city"])` was unguarded — a corrupt blob throws in a mount effect → trips `app/error.tsx` (white-screen panel) | ✅ Fixed — wrapped in try/catch |
| 4 | 🟢 Low | Doc drift — chat described as Groq-only; actual flow is Gemini-primary + Groq-fallback | ✅ Fixed — CLAUDE.md + docs corrected |

Verified clean: all 13 `JSON.parse(localStorage…)` sites guarded after #3; event listeners balanced (add/remove pairs, `{once:true}` self-removers excluded); API routes (`chat`, `run`, `daily-quote`) always return a response with full try/catch + `AbortSignal.timeout`; both `npm run build` runs green.

---

## Reading `npm audit` in this repo

**Do not panic at the raw number.** As of v3.23.0 `npm audit` reports **9 high-severity advisories, all of them dev-only** — old `minimatch`/`brace-expansion` copies bundled inside eslint plugins, which exist only to run `npm run lint` on a developer machine and never reach a deployed bundle.

The meaningful command is:

```bash
npm audit --omit=dev   # 0 vulnerabilities
```

Production dependencies audit clean at **0**. The dev-only advisories were accepted deliberately in 3.23.0 as the cost of restoring the lint gate (`eslint-config-next` had been pinned to a wrong package, so `npm run lint` was broken for a full release). Two constraints hold that repair together and must not be "tidied up": `eslint` stays on `^9` (eslint-config-next@16 bundles a react plugin whose peer caps at ^9.7), and the `brace-expansion` override stays **scoped to `@eslint/config-array`** — making it global re-breaks the linter.

---

## Known Limitations & Backup Plans

1. **In-memory rate limiting / OTP store (highest priority)** — concurrent Vercel instances each hold an independent limiter Map; cold starts wipe limits, OTPs, and attempt counters. Effective limits are N× configured under load. (Memory growth within a single instance is now bounded by the idle-key sweep added in 3.22.0 — but the cross-instance correctness gap remains.)
   **Plan:** migrate `lib/rateLimit.ts` and the vault OTP store to **Upstash Redis (or Vercel KV)**. The per-user quotas added in this pass make abuse slower but not impossible. Do this before the user base grows beyond friends.
   **Stopgap if abused:** rotate `GROQ_API_KEY` / `GEMINI_API_KEY` / JDoodle credentials, disable signup in Supabase Auth settings, or temporarily set the per-user caps lower.

2. **Client-assembled LLM system prompt** — `/api/chat` accepts `systemPrompt` from the client (needed because the prompt embeds the user's own data, which lives client-side). Bounded by the 60k cap + per-user quota.
   **Plan:** move prompt assembly server-side (fetch the user's data via the verified JWT inside the route).

3. **CSP `unsafe-eval`** — required by the Calculator's `new Function()` evaluator.
   **Plan:** replace with a shunting-yard expression parser, then drop `unsafe-eval` from `script-src`.

4. **Vault PIN is weak against offline cracking (accepted, 2026-08-07)** — 6 digits (~20 bits) at PBKDF2-SHA256 100k iterations. PIN verification is a *local* decrypt of `vault_meta`, so the attempt limit in `Profile.tsx` can only throttle a human at the keyboard: it now persists across reloads with an escalating timed cool-off (3/6/9 failures → 1/5/30 min, `localStorage['tyunnie_vault_pin_lock_<uid>']`), but an attacker holding the ciphertext just calls the KDF offline and no client-side counter — nor a server-side one — can stop that. Only KDF cost or PIN entropy can.
   **Accepted because** the vault currently holds test/low-value data, and the attacker already needs the user's JWT or DB access to obtain `vault_meta`.
   **Plan when it holds anything real:** versioned KDF — raise to 600k iterations, decrypt existing entries at 100k and re-encrypt at the new cost on next successful unlock, regenerating the verifier. This re-keys every entry, so it needs a version marker and testing on a throwaway entry first. A longer/alphanumeric PIN buys more entropy per unit of work if the unlock friction is acceptable.

5. **Resend `onboarding@resend.dev` sender** — fine for testing; verify a real domain in Resend before relying on vault emails (recipients other than the account owner are no longer possible, but deliverability suffers on the shared sender).

6. **Kill switches if something goes wrong post-launch:**
   - Supabase → Auth → disable new signups (stops new abusers instantly)
   - Vercel → Environment Variables → remove `JDOODLE_*` / `GEMINI_API_KEY` / `GROQ_API_KEY` and redeploy (paid endpoints fail gracefully with generic errors)
   - Vercel → Deployment Protection → password-protect the deployment to take the app private without taking it down

---

## Re-audit Procedure

Invoke the **`tyun-security`** skill (`.claude/skills/tyun-security/SKILL.md`) — "Full pre-deploy sweep" — before any deploy that adds an API route, a new external origin, or any email/LLM/code-execution surface. Findings are tagged against `docs/SECURITY_Rulebook.md` sections. Update this file's audit log with the date and findings.

For caching, bundle, and latency work, the companion skill is **`tyun-network`**. Both replaced the old `tyun-network-and-security` agent — a skill runs in the current session and can use what's already known about the change under review, where a subagent restarted cold. The security sweep still delegates its bulk file-reading to a subagent, since that phase reads far more than it reports.
