# Security — Tyunnie PA

Security posture, audit history, known limitations, and backup plans. Last full audit: **2026-06-10** (pre-public-launch pass before sharing the Vercel link). Last robustness pass: **2026-06-24** (v3.22.0 — rate-limiter memory hardening, changelog cache fix, crash-guard sweep). Last rulebook pass: **2026-08-19** (v3.26.0 — graph-expression sandbox escape, sanitiser rewrite, CI security automation).

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
| XSS | `sanitizeHtml()` on all AI output before `dangerouslySetInnerHTML`. Escapes everything, then re-opens only bare `b\|strong\|em\|i\|code\|br`. Attributes cannot survive, so event handlers and `javascript:` URIs are impossible by construction rather than stripped by pattern |
| Headers | CSP (`default-src 'self'` + explicit `connect-src`), HSTS preload, `nosniff`, `frame-ancestors 'self'`, `X-XSS-Protection: 0`, `poweredByHeader: false` |
| Secrets | All API keys server-only (no `NEXT_PUBLIC_` on secrets); service role key used only in `app/api/daily-quote`; `.env*` gitignored and untracked |
| Upstream timeouts | JDoodle fetch `AbortSignal.timeout(15s)`; client weather fetches 5s timeouts with fallbacks |
| Guest mode | No JWT → all paid endpoints reject guests server-side, not just in UI |
| CI security | CodeQL SAST per-PR + weekly (`.github/workflows/codeql.yml`); blocking production `npm audit --audit-level=high` in `.github/workflows/ci.yml`; Dependabot for npm + GitHub Actions (`.github/dependabot.yml`) |
| API cache | `no-store` on `/api/(chat\|run\|vault-notify)` — set centrally in `next.config.ts`, so a new authenticated route inherits it |

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

## Rulebook Pass — 2026-08-21

Full review against the rewritten `rulebooks/SECURITY_Rulebook.md` (§1 through §6).
This pass ran against the new §-numbering, so its citations are the ones to follow.

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | 🔴 High | `Calculator.tsx` still reached `new Function()` on both the calculator and graphing paths. The token allowlists added in 3.26.0 were correct, but they were guarding an evaluator rather than removing one — §2a.7 forbids the sink outright, and the same guard had already failed once. It also forced `'unsafe-eval'` into the CSP, breaking §2b.4 for the whole app | ✅ Fixed — `lib/mathEval.ts`, a recursive-descent parser over the keypad's own vocabulary. No string ever becomes code, so `constructor`/`fetch`/`alert` are not dangerous inputs but simply not tokens. Both `new Function()` sites deleted; `'unsafe-eval'` removed from the production CSP and verified absent on a real production response |
| 2 | 🟠 Medium | `Profile.tsx` rendered a vault entry's saved website straight into `href={dec.website}`. React escapes text but does not police URL schemes, so a stored `javascript:` URL executed on click — stored XSS with a click trigger (§2b.1, A05) | ✅ Fixed — `lib/safeUrl.ts` `safeHref()` parses the URL and allowlists `http`/`https`/`mailto` (§2a.2). Parsing rather than prefix-matching, so `java	script:` and case tricks canonicalise before the check. A non-conforming value still displays as text, just not as a link |
| 3 | 🟠 Medium | `/api/chat` accepted a fully client-supplied `systemPrompt` of up to 60 000 chars. Any authenticated caller could replace the persona entirely and use the route as a general-purpose LLM proxy on the owner's Gemini and Groq keys (§2e.4, §4 LLM06/LLM07/LLM10) | ✅ Partly fixed — the server now owns a preamble it always prepends, and the client's string is appended below it as explicitly untrusted framing (§1a.4: enforce in code, remind in the prompt). Prompt cap cut 60k → 20k and a new 40k conversation-wide cap added. **Remaining:** the four prompts are still composed client-side; moving them into the route is the real fix |
| 4 | 🟠 Medium | Vault PBKDF2 ran at 100 000 iterations where §2c.6 requires 600 000 — and the stretched secret is a 6-digit PIN, so the iteration count is very nearly the entire work factor (§1a.9) | ✅ Fixed — 600 000 for everything written from now on, with a read-only fallback to 100 000 so existing rows still decrypt; re-saving upgrades a record. Unlock now decrypts entries concurrently so the 6× cost does not become 6× the wait |
| 5 | 🟡 Low | `/api/chat` checked `m.content.length` only *if* it was a string, so a non-string `content` skipped validation entirely and went on to the SDK (§2a.3) | ✅ Fixed — type checked before length, and a conversation-wide character total added |
| 6 | 🟡 Low | `buildSystemPrompt()` inlined every todo, draft, project and snippet with no cap, so prompt size — and token spend — scaled with the user's data (§4 LLM10) | ✅ Fixed — 40 items per list, with a truncation line so the model reports "and N more" instead of inventing a total |
| 7 | 🟡 Low | CI had no secret scanning, and `actions/checkout` left the job token in `.git/config` for every later step (§5c.3) | ✅ Fixed — gitleaks step added with `fetch-depth: 0` so history is scanned too, plus `persist-credentials: false` |
| 8 | 🟡 Low | `crypto.ts` built base64 with `String.fromCharCode(...bytes)`, which throws `RangeError` once a record is large enough to exceed the argument limit | ✅ Fixed — chunked base64 helpers |
| 9 | 🟡 Low | **Found by tightening the CSP:** `@vercel/analytics` and `@vercel/speed-insights` were being blocked outright in development — `va.vercel-scripts.com` was in no directive. A control silently breaking a feature nobody was watching (§1a.8) | ✅ Fixed — allowed in the dev policy only; on Vercel both are served from this origin, which `'self'` already covers |

Also hardened: `Cross-Origin-Opener-Policy: same-origin-allow-popups` (closes the tabnabbing
path behind the vault's website links while leaving the Google OAuth popup working),
`Cross-Origin-Resource-Policy: same-origin`, `X-Permitted-Cross-Domain-Policies: none`,
`frame-src 'none'`, and `upgrade-insecure-requests`.

Verified clean this pass: no secret reaches the client bundle (`SUPABASE_SERVICE_ROLE_KEY`
appears only in `app/api/daily-quote`); no user-supplied URL is fetched server-side, so
there is no SSRF surface (§2m); every outbound call carries a timeout; every route body
parse is inside `try`; no query is built by concatenation (§2a.6); `sanitizeHtml()`'s
escape-then-restore property still holds; vault emails remain bound to the JWT's own email;
the OTP path keeps constant-time comparison and its escalating lockout (§2c.11).

**Known and accepted, not fixed here:**

- `'unsafe-inline'` remains on `script-src`. Removing it needs a per-request nonce from
  middleware threaded through both Next's bootstrap scripts and the pre-paint theme script
  in `app/layout.tsx`. A hash-based policy would not cover the Next bootstrap. This is the
  next CSP step, and it is a change worth doing on its own.
- A 6-digit vault PIN is 10^6 possibilities. 600 000 PBKDF2 iterations makes an offline
  sweep expensive, not impossible. The ceiling is PIN length, which is a product decision.
- Each vault entry carries its own PBKDF2 salt, so unlocking runs one key derivation per
  entry. One vault-level key with per-entry IVs would derive once; it needs a data
  migration, so it belongs to `tyun-database`.
- The rate limiter is still in-memory and per-instance (unchanged, long-standing).
- §5c.5 ("a test per fixed vulnerability") is **not** met: the repo has no test runner. The
  parser in `lib/mathEval.ts` was verified against 30 arithmetic cases and 21 rejection
  cases during this pass, but that check is not committed and cannot re-run in CI. Adding a
  runner touches the lockfile, which this project guards carefully — so it is a deliberate
  decision to make, not something to slip in.

---

## Rulebook Pass — 2026-08-19 (v3.26.0)

Full review against `rulebooks/SECURITY_Rulebook.md`, §1 through §3, including the
§2a line-level checklist. (Section numbers below are the rulebook edition current at the
time of the pass; the file was re-sectioned in the 2026-08-20 rewrite.)

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | 🔴 High | `Calculator.tsx` `sanitizeGraphExpr` used a *character-class* allowlist (`GRAPH_SAFE`) before handing the expression to `new Function()`. The letters required by `sin`/`cos`/`sqrt`/`abs` also spell `alert`, `location` and `atob`, so `alert(1)` passed validation (§2a-210) | ✅ Fixed — replaced with token-based `isSafeGraphExpr()`: strip the known vocabulary, then require only math punctuation remains. Mirrors the existing `isSafeCalcExpr`. Verified `alert(1)` / `location` / `atob` now rejected, all real expressions still accepted |
| 2 | 🔴 High | `nanoid <3.3.18` (GHSA-2v37-7h3g-55p8) present in the **production** tree via `postcss` — the "prod audit is 0" note below had gone stale | ✅ Fixed — `npm audit fix`, lockfile-only change, back to 0 |
| 3 | 🟠 Medium | No CI security automation at all: no `.github/workflows`, no Dependabot. §1.1 (security as code), §3.1 (shift-left scanning) and §3.2 (dependency hygiene) were entirely manual | ✅ Fixed — added `.github/dependabot.yml`, `.github/workflows/codeql.yml` (SAST, weekly + per-PR), `.github/workflows/ci.yml` (blocking prod `npm audit`, build, type-check) |
| 4 | 🟠 Medium | `sanitizeHtml()` was a *strip*-regex — it removed known-hostile shapes, which means enumerating them. A blocklist wearing an allowlist's clothes (§2.9, §2.16) | ✅ Fixed — rewritten as escape-everything-then-restore-allowlisted-tags. Attributes can no longer exist in the output at all, so `onerror=`, `javascript:` and unterminated-tag parser recovery are structurally impossible rather than pattern-matched |
| 5 | 🟠 Medium | `/api/vault-notify` called `await req.json()` outside any `try`, and the OTP-send branch was unguarded — a malformed body or a Resend outage escaped the handler as an uncontrolled 500 (§1.7, §2a-110) | ✅ Fixed — parse guarded → 400; send guarded → 500, and a failed send now deletes the OTP so an undelivered code is never verifiable |
| 6 | 🟠 Medium | The OTP `Map` only shrank on a successful verify — abandoned requests left live codes in memory for the instance lifetime, and the Map grew once per distinct email (§2a-132) | ✅ Fixed — `purgeExpiredOtps()` runs on every request |
| 7 | 🟡 Low | Authenticated API responses carried no `Cache-Control` (§2a-140) — chat carries the user's own words, vault-notify carries an OTP | ✅ Fixed — `no-store, max-age=0` + `Pragma: no-cache` for `/api/(chat\|run\|vault-notify)`, set centrally in `next.config.ts` so a new authenticated route inherits it. Deliberately excludes `/api/changelog` (public) and `/api/exchange-rates` (sets its own `private`) |
| 8 | 🟡 Low | `/api/run` ignored JDoodle's `res.ok` (whose error body can name the failing credential) and relayed `data.output` unbounded (§2a-194) | ✅ Fixed — non-OK → generic 502 + server-side log; output capped at 100 000 chars |

Verified clean this pass: secrets still absent from git (`.env*` untracked, no
history hits); service-role key still confined to `app/api/daily-quote`; RLS
`owner` policies present on all ten tables; recipient binding on `vault-notify`
intact; `escapeHtml()` still applied to model output in `daily-quote`; external
link in `Profile.tsx` carries `rel="noopener noreferrer"`; `isSafeCalcExpr`
token allowlist sound; CSP `connect-src` still matches the origins in use.

Still open and deliberately accepted: the in-memory rate limiter (#3 of the
2026-06-10 log) and CSP `unsafe-inline`/`unsafe-eval` (#7 of that log) — see
Known Limitations. Neither changed in this pass.

Not applicable this pass (§2a categories with no such surface): File Management
(no server-side upload path — music/avatar uploads go directly to Supabase
Storage under RLS), Memory Management (managed runtime).

---

## CodeQL Triage — 2026-08-19 (first scan, v3.26.1)

First `security-extended` run on `main` raised 4 alerts. Verdicts:

| Alert | Where | Verdict |
|---|---|---|
| #3, #4 — Replacement of a substring with itself (Medium) | `Calculator.tsx:89-90` | ✅ **True positive, fixed.** `e.replace(/nCr\(/g, "nCr(")` and the `nPr` twin were literal no-ops. Unlike `sin`/`cos`/`abs`, `nCr`/`nPr` are not `Math` members — they're passed into `new Function()` as their own parameters, so the identifier was already correct. Lines removed, comment left explaining why there is deliberately no rewrite |
| #1 — Clear text storage of sensitive information (High) | `Weather.tsx:81` | ⚠️ **False positive — dismiss as "Used in tests / won't fix → false positive".** The value is `{lat, lon, city}` for a city the user typed into a search box, geocoded to a **city centroid** by Open-Meteo. Not device geolocation, not a credential. It is stored in the user's own `localStorage`, on their own device, and persisting it *is* the feature — the panel would forget the chosen city every reload. There is no attacker who can read it that cannot already read everything else in that origin's storage |
| #2 — Clear text storage of sensitive information (High) | `Profile.tsx:961` | ⚠️ **False positive, same value, same key** (`tyunnie_city`), written from the settings panel instead of the weather panel. Dismiss identically |

If either #1/#2 is ever un-dismissed, the question to re-ask is whether the stored
coordinate is still a *typed city centroid* — if a future change starts writing
`navigator.geolocation` output to that key, the alert becomes a true positive and the
correct fix is to stop persisting it, not to round it.

Verified during triage: `lib/guest.ts` has no vault branch at all (guests were cut off
from the vault in 3.25.0), so no plaintext secret reaches `localStorage['tyunnie_guest_data']`;
`Profile.tsx`'s `PIN_LOCK_KEY` stores only `{attempts, until}`, never the PIN.

---

## Reading `npm audit` in this repo

**Do not panic at the raw number.** As of v3.23.0 `npm audit` reports **9 high-severity advisories, all of them dev-only** — old `minimatch`/`brace-expansion` copies bundled inside eslint plugins, which exist only to run `npm run lint` on a developer machine and never reach a deployed bundle.

The meaningful command is:

```bash
npm audit --omit=dev   # 0 vulnerabilities
```

Production dependencies audit clean at **0** — reconfirmed 2026-08-19 after clearing the `nanoid` advisory (see the Rulebook Pass above). This number is now enforced by CI rather than by remembering to check. The dev-only advisories were accepted deliberately in 3.23.0 as the cost of restoring the lint gate (`eslint-config-next` had been pinned to a wrong package, so `npm run lint` was broken for a full release). Two constraints hold that repair together and must not be "tidied up": `eslint` stays on `^9` (eslint-config-next@16 bundles a react plugin whose peer caps at ^9.7), and the `brace-expansion` override stays **scoped to `@eslint/config-array`** — making it global re-breaks the linter.

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

Invoke the **`tyun-security`** skill (`.claude/skills/tyun-security/SKILL.md`) — "Full pre-deploy sweep" — before any deploy that adds an API route, a new external origin, or any email/LLM/code-execution surface. Findings are tagged against `rulebooks/SECURITY_Rulebook.md` sections. Update this file's audit log with the date and findings.

For caching, bundle, and latency work, the companion skill is **`tyun-network`**. Both replaced the old `tyun-network-and-security` agent — a skill runs in the current session and can use what's already known about the change under review, where a subagent restarted cold. The security sweep still delegates its bulk file-reading to a subagent, since that phase reads far more than it reports.
