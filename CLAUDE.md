# CLAUDE.md — Tyunnie PA Reference

Personal AI assistant web app inspired by Taehyun (TXT). Next.js 16, TypeScript, Tailwind v4, Supabase, Groq AI. v3.9.0.

---

## Project Structure

```
app/
├── layout.tsx              Root layout — Instrument Serif + Nunito fonts, dark mode script, Vercel analytics
├── globals.css             Tailwind + CSS custom properties (orange/cream theme, dark mode overrides)
├── page.tsx                Unused — root redirect is in next.config.ts
├── dashboard/page.tsx      Main app shell — renders all panels, auth guard (15s timeout)
├── auth/page.tsx           Login/signup — Supabase email + Google OAuth
├── error.tsx               Error boundary with sprite + Try Again
├── not-found.tsx           404 with sprite + /dashboard link
└── api/
    ├── chat/route.ts       POST — Groq chat (llama-3.3-70b, 400 max tokens), {messages, systemPrompt} → {text}
    ├── run/route.ts        POST — JDoodle code execution, {code, language} → {output}
    ├── daily-quote/route.ts  GET cron (0 1 * * *) — Groq quotes via Resend to opted-in users
    └── vault-notify/route.ts POST — OTP generation + PIN change email via Resend

components/
├── Desk.tsx                Home dashboard — hero greeting, top 3 tasks, progress rings, finance, music, daily quote
├── TyunniePanel.tsx        AI chat panel — bottom-sheet overlay, snap resize (3 desktop / 2 mobile points), swipe-up gesture, always-mounted for chat persistence
├── Sidebar.tsx             macOS-style bottom-center dock (desktop) + full-width bar (mobile) — magnify-on-hover, Tyun + Sticky buttons, logout
├── Profile.tsx             User settings, password vault (AES-GCM encrypted), preferences
├── Todo.tsx                Task list — tags (cs/write/personal/other), due dates, done toggle, confetti
├── Writing.tsx             Draft editor — title, body, word count, CRUD
├── Projects.tsx            Project tracker — status, progress %, dates, Gantt chart
├── Snippets.tsx            Code editor — JDoodle live execution (py/js/ts/bash), save/delete
├── Finance.tsx             Monthly income/expense — account tags, Recharts analytics
├── Music.tsx               Audio player — playlist.json, album art, shuffle/repeat, audio visualizer
├── Pomodoro.tsx            25/5 timer — task binding, notifications
├── Games.tsx               Game hub dispatcher
├── ProductivityHub.tsx     Hub panel — links to Todo, Writing, Projects, Snippets, Pomodoro, Finance
├── EntertainmentHub.tsx    Hub panel — links to Music and Games
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
├── supabase.ts             Supabase client singleton
├── crypto.ts               AES-GCM 256-bit + PBKDF2 (100k iterations) — vault encryption, PIN verifier
├── MusicContext.tsx         React Context — player state (tracks, playback, shuffle, repeat, Web Audio analyser)
└── useSpeech.ts            Web Speech API hook — {listening, supported, toggle}
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        Supabase project URL (client-safe)
NEXT_PUBLIC_SUPABASE_ANON_KEY   Supabase anon key (client-safe)
GROQ_API_KEY                    Groq API key (server only)
JDOODLE_CLIENT_ID               JDoodle code execution (server only)
JDOODLE_CLIENT_SECRET           JDoodle code execution (server only)
RESEND_API_KEY                  Email sending via Resend (server only)
SUPABASE_SERVICE_ROLE_KEY       Service role for server-side Supabase ops (server only)
CRON_SECRET                     Bearer token guard for /api/daily-quote cron
```

---

## Supabase Schema

Tables: `todos`, `drafts`, `projects`, `snips`, `finance`, `profiles`, `vault`, `vault_meta`, `sticky_notes`, `memories`

All tables have RLS enabled with `auth.uid() = user_id` policies. `profiles` uses `auth.uid() = id`.

**Types (from database.ts):**

```ts
Todo:         { text, tag: 'cs'|'write'|'personal'|'other', due: 'YYYY-MM-DD'|null, done }
Draft:        { title, body }
Project:      { name, status: 'planning'|'active'|'paused'|'done', start_date, end_date, progress: 0-100, description }
Snip:         { name, language: 'py'|'js'|'ts'|'bash', code }
FinanceEntry: { type: 'income'|'expense', description, amount, category, account, date: 'YYYY-MM-DD' }
Profile:      { display_name, birth_day, birth_month, city, city_lat, city_lon, theme, locale, currency,
                occupation, workplace, bio, interests[], greeting_style, show_briefing, avatar_url, daily_quote_email }
VaultEntry:   { name, encrypted_data, iv, salt }   // all base64
StickyNote:   { content, x, y, width, height, color }
Memory:       { content }  // latest 40 kept
```

---

## Non-Obvious Rules (read DEVNOTES.md for full detail)

### Routing
- Root `/` redirect lives in `next.config.ts` `redirects()`, not `app/page.tsx`

### TypeScript / Vercel Build
- **Always use `any`** for Web Speech API event types in `lib/useSpeech.ts` — `SpeechRecognitionEvent` breaks Vercel even with `global.d.ts` declarations
- CSS module declarations go in `global.d.ts`, not `next-env.d.ts` (auto-regenerated, gitignored)

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

### Images
- Next.js `Image` src must NOT include `/public/` — use `/sprites/foo.png` not `/public/sprites/foo.png`
- Sprite canvas: **360×460px** transparent PNG; Desk hero sprite: **560×720px**

### Supabase Auth
- Corrupted session after failed Google OAuth → clear `sb-*` keys from localStorage + IndexedDB
- Auth timeout guard in `dashboard/page.tsx` redirects to `/auth` after 15s

### Demo Mode
- All `database.ts` functions have early return for `userId === "demo-user"` — add this guard to any new function

### Groq / AI Actions
- Strip trailing garbage before parsing action JSON: `.trim().replace(/[^}]*$/, "").trim()`
- Expose item UUIDs in system prompt as `[id:uuid]` prefix so AI can target precisely
- Read-only queries must NOT trigger destructive actions (sticky `clear_sticky` guard required)

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
- `snapPct` = vh hidden below fold. Desktop: `[8, 4, 0]`, Mobile: `[8, 0]`. `cycleSnap()` advances through the array
- Fullscreen (`snapPct === 0`) → `100vw` width, no border-radius, no borders — replaces the old `isExpanded` two-column mode (removed in v3.9.0)
- Backdrop only shown when `isOpen && snapPct > 0` (not when fullscreen)
- Swipe-up-from-bottom-edge gesture fires `onOpen` when `!isOpen`; listens via `touchstart`/`touchend` on `document`

### Sidebar Dock
- `dockScale(idx, hoveredIdx)` returns `1.55 / 1.22 / 1.08 / 1.0` based on distance — scale applied via inline style
- `TYUN_IDX = NAV_ITEMS.length` (4), `STICKY_IDX = 5`, `LOGOUT_IDX = 6`
- Desktop: `fixed bottom-5 left-1/2 -translate-x-1/2 z-50` frosted glass pill
- Mobile: full-width bar, shows Tyun 🧡 and Sticky 📌 items inline with nav
- Dock item glow uses `rgba(var(--accent-rgb), ...)` — must use CSS variable, not hardcoded orange

---

## Key Architectural Patterns

| Concern | Approach |
|---------|---------|
| State persistence across panel switches | `sessionStorage` for flags, Supabase for data |
| Chat history persistence | TyunniePanel always mounted; hidden via CSS transform only |
| Dark mode | `localStorage['tyunnie_theme']` → class on `<html>`, set in layout script |
| Accent color | `localStorage['tyunnie_accent']` → `--accent` CSS vars on `<html>`, set before paint |
| Music state | `MusicContext` with `useRef` mirrors to avoid stale closures in event listeners |
| Vault encryption | AES-GCM 256-bit via Web Crypto API, PBKDF2 key derivation |
| AI personality | Taehyun from TXT — calm, caring, dry humor, poetic |
| Daily quote emails | Vercel cron `0 1 * * *` → `/api/daily-quote` → Groq → Resend |
| Code execution | `/api/run` proxies to JDoodle API |

---

## Versioning Convention

- **Patch x.x.X** — bug fixes, build failures, type errors
- **Minor x.X.0** — new features, UI additions, panel changes
- **Major X.0.0** — significant architectural changes, major feature removal

Version tracked in `package.json` and mirrored in README badge.

---

## Dev Commands

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run lint     # ESLint
```
