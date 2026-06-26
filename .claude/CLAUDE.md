# CLAUDE.md — Tyunnie PA Reference

Personal AI assistant web app inspired by Taehyun (TXT). Next.js 16, TypeScript, Tailwind v4, Supabase, Groq AI. v3.22.0.

Docs: [DEPLOYMENT.md](../docs/DEPLOYMENT.md) (env/Vercel) · [DATABASE.md](../docs/DATABASE.md) (schema/SQL) · [SECURITY.md](../SECURITY.md) (posture/audit). Full file-tree + verbose notes live in git history of this file (pre-3.22 versions) if needed.

---

## Layout

- `app/` — `dashboard/` (main shell, auth guard 15s timeout, renders all panels), `auth/` (login/signup, Supabase email + Google OAuth), `about/` (public changelog story page), `error.tsx`/`not-found.tsx`, and `api/`:
  - `chat` — Gemini 2.0 Flash primary + Groq llama-3.3-70b fallback (400 tok); `run` — JDoodle exec; `daily-quote` — GET cron (`0 0 * * *` = 8am MYT) Groq→Resend; `vault-notify` — OTP + PIN email; `changelog` — parses `docs/CHANGELOG.md`; `exchange-rates`.
- `components/` — panels: Desk, TyunniePanel (chat), Sidebar (dock), Profile (vault), Todo, Writing, Projects, Snippets, Finance, Music + MiniPlayer, Pomodoro, Weather, FocusMode, StickyLayer/StickyNote, hubs (Productivity/Create/Entertainment), `games/` (Tetris, Chess, Sudoku, Minesweeper, TicTacToe, Solitaire), `ui/Kbd.tsx`, UpdateAnnouncement.
- `lib/` — `database.ts` (all Supabase CRUD; routes to guest store on GUEST_ID), `guest.ts`, `supabase.ts`, `crypto.ts` (AES-GCM + PBKDF2), `apiAuth.ts`, `rateLimit.ts`, `platform.ts`, `MusicContext.tsx`, `WorkspaceContext.tsx`, `tyunPersona.ts` (TYUN_CORE), `changelog.ts`, `version.ts`, `useSpeech.ts`, `tyunniePanelTypes.ts`.

---

## Non-Obvious Rules

### Build / TypeScript (break Vercel if violated)
- **Use `any`** for Web Speech API event types in `lib/useSpeech.ts` — `SpeechRecognitionEvent` breaks Vercel.
- CSS module decls go in `global.d.ts`, not `next-env.d.ts` (gitignored, regenerated).
- `dynamic()` loses prop types — use `dynamic<Props>(...)` with type from `lib/tyunniePanelTypes.ts`, not the component.
- tsconfig target ES2017 — no regex `s`/dotAll flag, no ES2018+ syntax in `lib/changelog.ts` parser.

### Routing / Config
- Root `/` redirect is in `next.config.ts` `redirects()`, not `app/page.tsx`.
- `/_next/static/(.*)` immutable Cache-Control is **production-only** (breaks HMR in dev). Image/font cache headers safe everywhere.

### State persistence
- `sessionStorage` (not `useRef`) gates one-shot AI calls — refs reset on remount: `tyunnie_briefing`, `desk_oneliner`, `pomodoro_autostart`.
- Dark mode `localStorage['tyunnie_theme']`, accent `tyunnie_accent` → CSS vars on `<html>` (set before paint in layout script).
- All `JSON.parse(localStorage...)` MUST be try/caught — corrupt blob in a mount effect trips the error boundary.

### About / Changelog / Version
- **Single version source**: `lib/version.ts` re-exports `pkg.version` as `APP_VERSION`. Release bump = `package.json` + README badge + new `docs/CHANGELOG.md` entry (3 places; rest follow).
- `/about` is a **public** client route. `lib/changelog.ts parseChangelog()` is pure; `api/changelog` reads the md with `fs` (CDN-cached 1h via `s-maxage`, browser revalidates — clients fetch `cache:"no-store"`).
- **User-facing notes live in a `### Highlights` section** — `/about` + modal show ONLY this, never Added/Fixed/Security. Format: `### Highlights` then `**New**`/`**Improved**`/`**Fixed**` label lines, each with `**Headline** — desc` bullets → `entry.highlights`. `hasHighlights()` gates display; no Highlights block = hidden + no popup. Plain English, no jargon.
- **UpdateAnnouncement**: compares `APP_VERSION` vs `localStorage['tyunnie_last_seen_version']`. Newer + has highlights → modal once. No stored version = first visit = silently caught-up. Hidden for guests.

### Persona
- `lib/tyunPersona.ts` `TYUN_CORE` = single source for Taehyun's character. TyunniePanel (chat) + daily-quote (email) compose on top. Daily-quote variety = random 35 TOPICS × 8 TONES + dynamic SUBJECT line — don't collapse to a fixed set.
- **Taehyun's birthday (Feb 5)**: `TYUN_BIRTHDAY` + `isTyunBirthday()` in `tyunPersona.ts` are the single source. On Feb 5: chat injects a low-key prompt line, daily-quote overrides topic/tone with a birthday angle (Groq), and `TyunBirthday.tsx` modal shows once/year (everyone incl. guests; dismissal `localStorage['tyunnie_tyun_bday_<year>']`). Distinct from version-gated UpdateAnnouncement.

### Music Player
- `Music.tsx` audio glow drives `boxShadow` via DOM ref, NOT state (per-frame beat detection).
- `togglePlay` must be `async` (`audioCtx.resume()` is a Promise). `skipBack/Forward` read `audioRef.currentTime` directly, never `progress` state.
- Persistence: volume lazy-init useState, track index useEffect, position throttled ~5s; restore via `pendingRestoreRef` (no auto-play).
- MiniPlayer is always a separate floating overlay — never embed controls in TyunniePanel.

### MiniPlayer / TyunniePanel Float (Pointer-Events drag pattern)
- `setPointerCapture`, `touchAction:none`, exclude `button/input/textarea` in `onPointerDown`. Init position in `useEffect` (no `window` on server).
- MiniPlayer mobile (<768px) = compact pill, no skip; auto-close 30s after pause (cleared on play).
- Float: `isFloating` → `localStorage['tyunnie_float']`, pos → `tyunnie_float_pos` (write on drag end). Disabled on mobile. Wrapper always mounted (chat survives). z-60. 400×560px.

### TyunniePanel Bottom Sheet
- Always mounted; `isOpen` toggles via CSS `transform: translateY`, NOT `display:none`. `snapPct` = vh hidden; desktop `[8,4,0]`, mobile `[0]` (fullscreen-only, handle hidden). Fullscreen → 100vw, no radius/border. Backdrop only when `isOpen && snapPct>0`. Swipe-up-from-edge fires `onOpen`.

### Sidebar Dock
- `dockScale(idx, hoveredIdx)` → `1.55/1.22/1.08/1.0` by distance. NAV_ITEMS `[desk,focus,create,play]` (0–3); TYUN=4, STICKY=5, FOCUS=6, LOGOUT=7. Hubs: focus→Productivity, create→Create, play→Entertainment. Glow uses `rgba(var(--accent-rgb),...)`, never hardcoded orange. Desktop frosted pill `z-50`; mobile full-width bar shows Tyun + Sticky inline.

### WorkspaceContext (proactive suggestions)
- Broadcast-only: panels push snapshots, TyunniePanel reads. Always `setSnapshot(null)` on unmount. Debounce 600ms per panel + 4s "Tyun pause" before API call. Proactive cooldown 90s via `lastProactiveRef`. Per-snapshot gate `sessionStorage['tyunnie_proactive_${updatedAt}']`. Broadcasters: Snippets, Writing (editor open), Todo.

### Groq / AI Actions
- Strip trailing garbage before parsing action JSON: `.trim().replace(/[^}]*$/, "").trim()`.
- Expose item UUIDs as `[id:uuid]` in system prompt. Read-only queries must NOT trigger destructive actions (sticky `clear_sticky` guard).
- Agentic custom events (dispatch on `window`, listen in useEffect): `tyunnie-pomodoro-preset` (Pomodoro), `tyunnie-filter-panel` (Todo by tag / Writing search).

### Guest / Demo Mode (`lib/guest.ts`)
- `enterGuest()` sets `localStorage['tyunnie_guest']="1"`. Sentinel `GUEST_ID="demo-user"`; dashboard synthesises `user={id:GUEST_ID}`. **A real Supabase session always wins** (clears flag via `exitGuest()`). Data in `localStorage['tyunnie_guest_data']`, never DB; "Reset demo" = `resetGuestData()`.
- `lib/database.ts` branches on `userId===GUEST_ID` (or `isGuest()` for id-only mutations).
- **Paid/auth endpoints disabled for guests** (chat, run, exchange-rates) — show "sign up" state, not 401. Storage writes no-op (music upload, vault, avatar uses data URL). `<TyunniePanel isGuest>` gates composer. Announcement hidden.

### Misc
- Next `Image` src omits `/public/` (use `/sprites/foo.png`). Sprite canvas 360×460; Desk hero 560×720. Set real intrinsic w/h, CSS `auto` to scale.
- Vault PIN never stored — only PBKDF2 verifier + salt + IV. OTP in-memory Map (10-min, not cold-start-persistent).
- StickyNote `isTypingRef` guard (600ms) prevents prop sync overwriting mid-type.
- Collapsible panels toggle `flex-1`/`flex-none`, NOT `w-0`.
- Pomodoro: remount via incrementing `pomodoroKey`, NOT `key={pomodoroTask}` (task resets to `""` mid-session).
- Corrupted Supabase session after failed Google OAuth → clear `sb-*` from localStorage + IndexedDB. `supabase.ts` overrides auth `lock` to avoid navigator-LockManager "steal" aborts; `authHeader()` uses `refreshSession()`.
- Shared utils: `lib/platform.ts` `isMac()`/`modKey()` and `components/ui/Kbd.tsx` — import, never redefine locally.

### Dev Server
- `npm run dev` → `scripts/dev.mjs` spawns `next dev` + auto-opens browser on "Ready". `npm run dev:noopen` = plain. Spawn passes one shell string (avoids `DEP0190`).

---

## Security (full: SECURITY.md)
- Auth via `getAuthUser()`/`verifyAuth()` (JWT). Two-tier rate limit: per-IP burst + per-user daily quota (chat 300/day, run 100/day). **In-memory limiter is the top scaling limitation — move to Upstash/Vercel KV before real traffic.**
- Vault emails bound to JWT email only. OTP `crypto.randomInt` + `timingSafeEqual`; `CRON_SECRET` constant-time. XSS via `sanitizeHtml()`. `/api/changelog` intentionally public. Service-role key server-only.

## Versioning
- Patch `x.x.X` = fixes/build/types · Minor `x.X.0` = features/UI · Major `X.0.0` = architectural. Tracked in `package.json` + README badge.

## Dev Commands
```bash
npm run dev      # Next.js + Turbopack (auto-opens browser)
npm run build    # Production build + TS check
npm run lint     # ESLint
```
