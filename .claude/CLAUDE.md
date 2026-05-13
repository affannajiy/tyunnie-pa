# CLAUDE.md — Tyunnie PA Reference

Personal AI assistant web app inspired by Taehyun (TXT). Next.js 16, TypeScript, Tailwind v4, Supabase, Groq AI. v3.19.0.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for env vars and Vercel setup. See [DATABASE.md](../DATABASE.md) for schema and SQL.

---

## Project Structure

```
app/
├── layout.tsx              Root layout — Instrument Serif + Nunito fonts, dark mode script, Vercel analytics
├── globals.css             Tailwind + CSS custom properties (orange/cream theme, dark mode overrides)
├── page.tsx                Unused — root redirect is in next.config.ts
├── dashboard/page.tsx      Main app shell — renders all panels, auth guard (15s timeout)
├── auth/page.tsx           Login/signup — split layout, Supabase email + Google OAuth
├── error.tsx               Error boundary with sprite + Try Again
├── not-found.tsx           404 with split layout, Tyunnie Runner canvas mini-game (space/tap to jump, localStorage high score)
└── api/
    ├── chat/route.ts       POST — Groq chat (llama-3.3-70b, 400 max tokens), {messages, systemPrompt} → {text}
    ├── run/route.ts        POST — JDoodle code execution, {code, language} → {output}
    ├── daily-quote/route.ts  GET cron (0 1 * * *) — Groq quotes via Resend to opted-in users
    └── vault-notify/route.ts POST — OTP generation + PIN change email via Resend

components/
├── Desk.tsx                Home dashboard — hero greeting, top 3 tasks, progress rings, finance, music, daily quote
├── TyunniePanel.tsx        AI chat panel — bottom-sheet overlay, snap resize (3 desktop / 2 mobile points), swipe-up gesture, always-mounted for chat persistence
├── Sidebar.tsx             macOS-style bottom-center dock (desktop) + full-width bar (mobile) — magnify-on-hover, Tyun + Sticky buttons, logout; accepts optional `hiddenPanels: Set<string>` to filter nav items on both layouts
├── Profile.tsx             User settings, password vault (AES-GCM encrypted), preferences
├── Todo.tsx                Task list — tags (cs/write/personal/other), due dates, done toggle, confetti; listens for `tyunnie-filter-panel` (panel:"todo") to filter by tag
├── Writing.tsx             Draft editor — title, body, word count, CRUD; listens for `tyunnie-filter-panel` (panel:"writing") to populate search field
├── Projects.tsx            Project tracker — status, progress %, dates, Gantt chart
├── Snippets.tsx            Code editor — JDoodle live execution (py/js/ts/bash), save/delete
├── Finance.tsx             Monthly income/expense — account tags, Recharts analytics
├── MiniPlayer.tsx          Floating draggable mini player — appears when playing music outside Music panel, auto-closes 30s after pause, mobile pill layout
├── Music.tsx               Audio player — playlist.json + user uploads, album art, shuffle/repeat, skip ±10s, audio visualizer
├── Pomodoro.tsx            Configurable timer — task binding, notifications, 4 presets; listens for `tyunnie-pomodoro-preset` custom event (agentic preset switching)
├── Games.tsx               Game hub dispatcher
├── ProductivityHub.tsx     Focus hub — links to Todo, Projects, Pomodoro
├── CreateHub.tsx           Create hub — links to Writing, Snippets, Finance, Calculator, SpeedTest
├── EntertainmentHub.tsx    Play hub — links to Music, Games
├── Weather.tsx             Weather display — city lat/lon from profile, Open-Meteo API
├── FocusMode.tsx           Fullscreen focus overlay — task + Pomodoro + music + sticky notes
├── StickyLayer.tsx         Sticky notes container — renders draggable StickyNote children
├── StickyNote.tsx          Individual sticky — drag/resize, colors, Supabase persist
└── games/
    ├── Tetris.tsx           All 7 tetrominoes, ghost piece, hold, next preview, mobile swipe
    ├── Chess.tsx            Full legal moves, castling, en passant, promotion, 3 bot difficulties, 8 time controls
    ├── Sudoku.tsx           Notes mode, 3-mistake limit
    ├── Minesweeper.tsx      First-click safe, flood fill, chord support
    ├── TicTacToe.tsx        vs bot (easy/medium/hard minimax) or 2-player
    └── Solitaire.tsx        Klondike, full move validation

lib/
├── database.ts             All Supabase queries — types + CRUD for todos, drafts, projects, snips, finance, vault, sticky notes, memories
├── supabase.ts             Supabase client singleton + authHeader() helper
├── tyunniePanelTypes.ts    Shared TyunniePanelProps type (used by dashboard/page.tsx for dynamic() typing)
├── crypto.ts               AES-GCM 256-bit + PBKDF2 (100k iterations) — vault encryption, PIN verifier
├── apiAuth.ts              verifyAuth(header) — server-side Supabase JWT validation for API routes
├── rateLimit.ts            In-memory rate limiter — rateLimit(key, limit, windowMs)
├── MusicContext.tsx         React Context — player state (tracks, playback, shuffle, repeat, skip, Web Audio analyser); persists volume/track/position to localStorage
├── tyunnieQuotes.ts        20 dry Taehyun-inspired loading quotes — exports `TYUNNIE_QUOTES`, `getRandomQuote()`, `getCyclingQuote(index)`; used by TyunniePanel thinking state, dashboard loading screen, and panel skeletons
└── useSpeech.ts            Web Speech API hook — {listening, supported, toggle}
```

---

## Non-Obvious Rules

### Routing
- Root `/` redirect lives in `next.config.ts` `redirects()`, not `app/page.tsx`

### next.config.ts Cache Headers
- `/_next/static/(.*)` Cache-Control (`immutable`) is **production-only** — applying it in dev caches HMR chunks and breaks fast refresh
- Images/fonts cache header applies in all environments (safe; filenames don't change during dev)

### TypeScript / Vercel Build
- **Always use `any`** for Web Speech API event types in `lib/useSpeech.ts` — `SpeechRecognitionEvent` breaks Vercel even with `global.d.ts` declarations
- CSS module declarations go in `global.d.ts`, not `next-env.d.ts` (auto-regenerated, gitignored)
- `dynamic()` loses prop types — use `dynamic<Props>(...)` with type imported from `lib/tyunniePanelTypes.ts`, not from the component directly (Next.js plugin interferes with named exports from `"use client"` files)

### sessionStorage vs useRef
- Use `sessionStorage` (not `useRef`) to gate one-shot AI calls — refs reset on panel unmount/remount:
  - `tyunnie_briefing` — TyunniePanel daily briefing
  - `desk_oneliner` — Desk AI one-liner
  - `pomodoro_autostart` — cross-component flag from Desk → Pomodoro

### Pomodoro
- Use an incrementing counter key (`pomodoroKey`) to force remount, NOT `key={pomodoroTask}` — task string resets to `""` mid-session which triggers unwanted remount

### Music Player
- Audio glow in `Music.tsx` drives `boxShadow` via direct DOM ref, NOT React state — do not refactor to `useState` (breaks per-frame beat detection)
- `togglePlay` must be `async` — `audioCtxRef.current.resume()` returns a Promise
- `skipBack(n)` / `skipForward(n)` read `audioRef.current.currentTime` directly — never use `progress` state (stale)
- Session persistence: volume via `useState` lazy init, track index via `useEffect`, position throttled every ~5s in `ontimeupdate`. Restore uses `pendingRestoreRef` — applied after first playlist load, does NOT auto-play
- MiniPlayer is always a separate floating overlay (`components/MiniPlayer.tsx`) — never embed player controls inside TyunniePanel again

### MiniPlayer
- Draggable via Pointer Events (`setPointerCapture`) — works for mouse and touch
- Exclude buttons/inputs from drag: check `.closest("button, input")` in `onPointerDown`
- `touchAction: none` on wrapper prevents scroll-while-dragging on mobile
- Position initialised in `useEffect` (not `useState` initialiser) — `window` unavailable on server
- Mobile (`< 768px`): compact pill, no skip buttons. Desktop: full card with seek bar + skip controls
- Auto-close: `setTimeout(30s)` starts on pause, cleared on play. Both `dismissed` and `autoClosed` reset when `isPlaying` becomes true

### Images
- Next.js `Image` src must NOT include `/public/` — use `/sprites/foo.png` not `/public/sprites/foo.png`
- Sprite canvas: **360×460px** transparent PNG; Desk hero sprite: **560×720px**
- Always set both intrinsic `width`/`height` to the real image dimensions; use CSS `width`/`height: "auto"` to control render size

### Supabase Auth
- Corrupted session after failed Google OAuth → clear `sb-*` keys from localStorage + IndexedDB
- Auth timeout guard in `dashboard/page.tsx` redirects to `/auth` after 15s

### Groq / AI Actions
- Strip trailing garbage before parsing action JSON: `.trim().replace(/[^}]*$/, "").trim()`
- Expose item UUIDs in system prompt as `[id:uuid]` prefix so AI can target precisely
- Read-only queries must NOT trigger destructive actions (sticky `clear_sticky` guard required)

### Agentic Custom Events (panel control via Tyunnie chat)
- `tyunnie-pomodoro-preset` — dispatched by TyunniePanel `executeAction`; detail: `{ preset: "classic"|"extended"|"short_sprint"|"deep_work" }`. `Pomodoro.tsx` listens and applies the preset immediately (settings + timer reset)
- `tyunnie-filter-panel` — dispatched for filter/search actions; detail: `{ panel: string, filter: string }`. `Todo.tsx` filters by tag when `panel === "todo"`; `Writing.tsx` sets search when `panel === "writing"`
- Pattern: dispatch on `window`, listen in `useEffect` with cleanup — no prop drilling or context needed

### Password Vault
- PIN is never stored — only PBKDF2 verifier + salt + IV
- OTP stored in-memory Map (10-min expiry) — single-server safe on Vercel, not persistent across cold starts

### Sticky Notes
- `isTypingRef` guard in `StickyNote.tsx` prevents prop sync from overwriting content mid-type (600ms debounce)

### Collapsible Panels
- Use `flex-1` / `flex-none` toggling, NOT `w-0` — `w-0` collapses flex children with `min-width`

### TyunniePanel Bottom Sheet
- Always mounted (never conditionally rendered) — chat history survives panel switches
- `isOpen` controls visibility via CSS `transform: translateY(...)`, NOT `display:none`
- `snapPct` = vh hidden below fold. Desktop: `[8, 4, 0]`, Mobile: `[0]`. `cycleSnap()` advances through the array
- Mobile is fullscreen-only (`snapPct === 0`); handle bar hidden on mobile
- Fullscreen (`snapPct === 0`) → `100vw` width, no border-radius, no borders
- Backdrop only shown when `isOpen && snapPct > 0` (not when fullscreen)
- Swipe-up-from-bottom-edge gesture fires `onOpen` when `!isOpen`; listens via `touchstart`/`touchend` on `document`

### Sidebar Dock
- `dockScale(idx, hoveredIdx)` returns `1.55 / 1.22 / 1.08 / 1.0` based on distance — scale applied via inline style
- NAV_ITEMS = `[desk, focus, create, play]` (4 items, indices 0–3); `TYUN_IDX = 4`, `STICKY_IDX = 5`, `FOCUS_IDX = 6`, `LOGOUT_IDX = 7`
- Hub panels: `focus` → `ProductivityHub.tsx`, `create` → `CreateHub.tsx`, `play` → `EntertainmentHub.tsx`
- Desktop: `fixed bottom-5 left-1/2 -translate-x-1/2 z-50` frosted glass pill
- Mobile: full-width bar, shows Tyun 🧡 and Sticky 📌 items inline with nav
- Dock item glow uses `rgba(var(--accent-rgb), ...)` — must use CSS variable, not hardcoded orange

---

## Key Architectural Patterns

| Concern | Approach |
|---|---|
| State persistence across panel switches | `sessionStorage` for flags, Supabase for data |
| Chat history persistence | TyunniePanel always mounted; hidden via CSS transform only |
| Dark mode | `localStorage['tyunnie_theme']` → class on `<html>`, set in layout script |
| Accent color | `localStorage['tyunnie_accent']` → `--accent` CSS vars on `<html>`, set before paint |
| Music state | `MusicContext` with `useRef` mirrors to avoid stale closures; volume/track/position persisted to `localStorage` |
| Floating mini player | `MiniPlayer.tsx` — draggable overlay, auto-closes 30s after pause, mobile pill layout |
| Vault encryption | AES-GCM 256-bit via Web Crypto API, PBKDF2 key derivation |
| AI personality | Taehyun from TXT — calm, caring, dry humor, poetic |
| Daily quote emails | Vercel cron `0 1 * * *` → `/api/daily-quote` → Groq → Resend |
| Code execution | `/api/run` proxies to JDoodle API |
| API security | Auth via `verifyAuth()` (JWT), rate limiting via `rateLimit()`, XSS via `sanitizeHtml()` |
| Shared prop types | Heavy components use `lib/tyunniePanelTypes.ts` — avoids Next.js plugin type inference issues |

---

## Versioning Convention

- **Patch x.x.X** — bug fixes, build failures, type errors
- **Minor x.X.0** — new features, UI additions, panel changes
- **Major X.0.0** — significant architectural changes, major feature removal

Version tracked in `package.json` and mirrored in README badge.

---

## Dev Commands

```bash
npm run dev      # Start dev server (Next.js + Turbopack)
npm run build    # Production build + TypeScript check
npm run lint     # ESLint
```

---

### WorkspaceContext

- `lib/WorkspaceContext.tsx` — broadcast-only pattern; panels push snapshots in, TyunniePanel reads them out
- Always call `setSnapshot(null)` on panel unmount — prevents stale context bleeding into the next panel
- Debounce snapshot writes at 600ms inside each panel; TyunniePanel adds an additional 4s "Tyun pause" before firing the proactive API call
- Proactive suggestion rate limit: 90s cooldown tracked via `lastProactiveRef` — not sessionStorage (per-session is fine)
- Gate per-snapshot firing with sessionStorage key `tyunnie_proactive_${snapshot.updatedAt}` to survive remounts
- Panels broadcasting: `Snippets.tsx` (active code), `Writing.tsx` (draft body, editor open only), `Todo.tsx` (pending task summary)

### TyunniePanel Float Mode

- `isFloating` persisted to `localStorage['tyunnie_float']` — survives page refresh
- Float position persisted to `localStorage['tyunnie_float_pos']` — written on drag end only
- Float mode disabled on mobile (< 768px) — `isFloating` forced false, detach button hidden
- Always-mounted wrapper `div` stays in DOM in both modes — chat history is never lost
- Drag uses same Pointer Events pattern as `MiniPlayer.tsx` — `setPointerCapture`, `touchAction none`, exclude buttons/inputs/textareas
- `z-index: 60` (above dock `z-50`)
- Float window: 400×560px fixed, `rounded-2xl`, accent glow shadow
- Bottom sheet unchanged when `isFloating` is false — all snap logic intact
