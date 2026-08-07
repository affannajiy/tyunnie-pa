# CLAUDE.md — Tyunnie PA Reference

Personal AI assistant web app inspired by Taehyun (TXT). Next.js 16, TypeScript, Tailwind v4, Supabase, Groq AI. v3.24.0.

Docs: [DEPLOYMENT.md](../docs/DEPLOYMENT.md) (env/Vercel) · [DATABASE.md](../docs/DATABASE.md) (schema/SQL) · [SECURITY.md](../SECURITY.md) (posture/audit) · [UI-UX_Rulebook.md](../docs/UI-UX_Rulebook.md) (**UI contract — read before any UI change**; §1 Nielsen · §2 Gestalt · §3 Laws of UX · §4 conflict rulings) · [SECURITY_Rulebook.md](../docs/SECURITY_Rulebook.md) (general secure-design reference — §1 7 principles · §2 OWASP foundations · §3 SDLC practices · §4 conflict rulings; pairs with `SECURITY.md`'s project-specific posture). Full file-tree + verbose notes live in git history of this file (pre-3.22 versions) if needed.

Skills (`.claude/skills/`, invoke by name): `tyun-git` (commits — **only when asked**; title ≤10 words from CHANGELOG) · `tyun-documentation` (CHANGELOG/version bump/README/this file) · `tyun-designer` (UI review vs UI-UX_Rulebook) · `tyun-security` (auth/CSP/RLS/crypto vs SECURITY_Rulebook) · `tyun-network` (caching/bundle/latency). These replaced the `.claude/agents/` subagents — a skill runs in the current session and can use what's already known about the work under review; a subagent restarted cold and re-derived it. Heavy whole-app sweeps still delegate their file-reading to a subagent.

---

## Layout

- `app/` — `dashboard/` (main shell, auth guard 15s timeout, renders all panels), `auth/` (login/signup, Supabase email + Google OAuth), `about/` (public changelog story page), `error.tsx`/`not-found.tsx`, and `api/`:
  - `chat` — Gemini 2.0 Flash primary + Groq llama-3.3-70b fallback (400 tok); `run` — JDoodle exec; `daily-quote` — GET cron (`0 0 * * *` = 8am MYT) Groq→Resend; `vault-notify` — OTP + PIN email; `changelog` — parses `docs/CHANGELOG.md`; `exchange-rates`.
- `components/` — panels: Desk, TyunniePanel (chat), Sidebar (dock), Profile (vault), Todo, Writing, Projects, Snippets, Finance, Music + MiniPlayer, Pomodoro, Weather, FocusMode, StickyLayer/StickyNote, hubs (Productivity/Create/Entertainment), `games/` (Tetris, Chess, Sudoku, Minesweeper, TicTacToe, Solitaire), `ui/Kbd.tsx`, `ui/ConfirmDialog.tsx`.
- `lib/` — `database.ts` (all Supabase CRUD; routes to guest store on GUEST_ID), `guest.ts`, `supabase.ts`, `crypto.ts` (AES-GCM + PBKDF2), `apiAuth.ts`, `rateLimit.ts`, `platform.ts`, `MusicContext.tsx`, `WorkspaceContext.tsx`, `tyunPersona.ts` (TYUN_CORE), `changelog.ts`, `version.ts`, `useSpeech.ts`, `tyunniePanelTypes.ts`.

---

## Non-Obvious Rules

### Build / TypeScript (break Vercel if violated)
- **Use `any`** for Web Speech API event types in `lib/useSpeech.ts` — `SpeechRecognitionEvent` breaks Vercel. The file-scope `eslint-disable @typescript-eslint/no-explicit-any` (with its reason comment) is load-bearing — never delete it "to fix a lint error".
- **Lint toolchain is fragile — don't "upgrade" it.** `eslint` must stay `^9`: `eslint-config-next@16` claims `>=9.0.0` but bundles `eslint-plugin-react@7.37.5` whose peer caps at `^9.7`, so ESLint 10 dies with `contextOrFilename.getFilename is not a function`. The `brace-expansion: ^2.0.1` override must stay **scoped under `@eslint/config-array`** — global v5 exports an object, and the bundled `minimatch@3.1.5` needs a function (`expand is not a function`). `npm audit` raw count includes dev-only eslint advisories; real number is `npm audit --omit=dev` = 0.
- CSS module decls go in `global.d.ts`, not `next-env.d.ts` (gitignored, regenerated).
- `dynamic()` loses prop types — use `dynamic<Props>(...)` with type from `lib/tyunniePanelTypes.ts`, not the component.
- tsconfig target ES2017 — no regex `s`/dotAll flag, no ES2018+ syntax in `lib/changelog.ts` parser.

### Routing / Config
- Root `/` redirect is in `next.config.ts` `redirects()`, not `app/page.tsx`.
- `/_next/static/(.*)` immutable Cache-Control is **production-only** (breaks HMR in dev). Image/font cache headers safe everywhere.

### State persistence
- `sessionStorage` (not `useRef`) gates one-shot AI calls — refs reset on remount: `tyunnie_briefing`, `desk_oneliner`, `pomodoro_autostart`.
- Dark mode `localStorage['tyunnie_theme']`, accent `tyunnie_accent` → CSS vars on `<html>` (set before paint in layout script).
- **Accent has two apply paths** (`lib/accent.ts`): `setAccentVars(hex)` = CSS vars only, ephemeral; `saveAccent(userId, hex)` = vars + `localStorage` + profile row. Auto-Theme must ONLY ever call the first — calling `saveAccent` from the music path destroys the user's picked colour and spams `upsertProfile` once per track.
- **`localStorage['tyunnie_accent']` holds a HEX (`#f97316`), never an `r,g,b` triple** — never interpolate it into `rgba(...)` (invalid CSS → glow renders nothing). For a triple use `useAccentColor()` (reads `--accent-rgb`, live via `tyunnie-accent-changed`); for one raw var in canvas/JS contexts use `readAccentVar(name)` from `lib/accent.ts` — call at paint time, never cache.
- **Any rAF loop / canvas `draw()` using the accent must take it as a dep** (or re-read per frame) — a `const rgb` read once at effect top is captured stale, and a per-frame inline style also clobbers the JSX `rgba(var(--accent-rgb),…)` fallback so it can't self-recover. Now load-bearing: Auto-Theme changes the accent every track. Reference impl: `Desk.tsx`; also `Music.tsx`, `FocusMode.tsx`, `Calculator.tsx`.
- All `JSON.parse(localStorage...)` MUST be try/caught — corrupt blob in a mount effect trips the error boundary.

### About / Changelog / Version
- **Single version source**: `lib/version.ts` re-exports `pkg.version` as `APP_VERSION`. Release bump = `package.json` + README badge + new `docs/CHANGELOG.md` entry (3 places; rest follow).
- `/about` is a **public** client route. `lib/changelog.ts parseChangelog()` is pure; `api/changelog` reads the md with `fs` (CDN-cached 1h via `s-maxage`, browser revalidates — clients fetch `cache:"no-store"`).
- **User-facing notes live in a `### Highlights` section** — `/about` + modal show ONLY this, never Added/Fixed/Security. Format: `### Highlights` then `**New**`/`**Improved**`/`**Fixed**` label lines, each with `**Headline** — desc` bullets → `entry.highlights`. `hasHighlights()` gates display; no Highlights block = hidden + no popup. Plain English, no jargon.
- **No post-update modal.** `UpdateAnnouncement` was deleted in 3.24.0 — the changelog lives on `/about` only, and `localStorage['tyunnie_last_seen_version']` is dead. Do not reintroduce a version-gated popup.

### Persona
- `lib/tyunPersona.ts` `TYUN_CORE` = single source for Taehyun's character. TyunniePanel (chat) + daily-quote (email) compose on top. Daily-quote variety = random 35 TOPICS × 8 TONES + dynamic SUBJECT line — don't collapse to a fixed set.
- **Taehyun's birthday (Feb 5)**: `TYUN_BIRTHDAY` + `isTyunBirthday()` in `tyunPersona.ts` are the single source. On Feb 5: chat injects a low-key prompt line, daily-quote overrides topic/tone with a birthday angle (Groq), and `TyunBirthday.tsx` modal shows once/year (everyone incl. guests; dismissal `localStorage['tyunnie_tyun_bday_<year>']`). This is the only auto-showing modal; it is date-gated, not version-gated.

### Music Player
- `Music.tsx` audio glow drives `boxShadow` via DOM ref, NOT state (per-frame beat detection).
- `togglePlay` must be `async` (`audioCtx.resume()` is a Promise). `skipBack/Forward` read `audioRef.currentTime` directly, never `progress` state.
- Persistence: volume lazy-init useState, track index useEffect, position throttled ~5s; restore via `pendingRestoreRef` (no auto-play).
- MiniPlayer is always a separate floating overlay — never embed controls in TyunniePanel.
- **Auto-Theme** (`localStorage['tyunnie_autotheme']`): driver lives in `MusicContext`, NOT `Music.tsx`, so it follows the MiniPlayer when the panel is closed. `lib/artColor.ts` returns `null` (never a bad colour) on greyscale/CORS-tainted/failed covers — callers fall back to `readSavedAccent()`. Toggle dispatches `tyunnie-autotheme-changed` because localStorage isn't reactive. `--accent*` are `@property`-registered as `<color>` in `globals.css` so they can transition; `--accent-rgb` can't (bare list, not a colour).

### Focus Mode
- Transport glyphs are **monochrome text characters**, never colour emoji: `⇄` shuffle, `⏮ ▶/⏸ ⏭`, `↺`/`↺¹` repeat — identical to `Music.tsx`. Emoji like 🔀/🔁 render as multicolour pictographs and don't inherit `color`. (`🎵` is fine as the missing-cover placeholder; Music.tsx uses the same.)
- **Two emphases, one component.** `listenMode` (`localStorage['tyunnie_focus_listen']`, lazy `useState` init — NOT a mount effect) swaps the hero between the timer ring and the album art. Do **not** build a separate fullscreen visualizer: FocusMode is already `fixed inset-0 z-100` with the analyser glow + transport, and a second copy of that rAF loop is what caused the stale-accent bug to exist twice.
- Glow is an unsized `ellipse at 50% 80%`, falloff `30%→90%`, opacity `0.08→0.55` — **the original values; both a wider sized ellipse and a tighter `22%→55%` were tried and rejected. Don't retune without asking.** Built via `glowCss()`; never inline a second copy, and keep the static pre-loop `style` background (`transparent 60%`) in step with it. **Listen-mode hero art must NOT have its own `boxShadow`** — a large one there produced a visible dark band across the top of the screen.
- **Never put a CSS `transition` on a property a rAF loop writes.** It smears every frame. Do attack/decay in JS instead (fast rise, `DECAY` fall).
- **rAF loops bypass `prefers-reduced-motion`** — the globals.css block only reaches CSS transitions/animations. Check `matchMedia` explicitly and don't start the loop.
- Listen mode shows **no timer at all** — the header Timer/Listen toggle is the only way to a Pomodoro. Chosen deliberately over a visible pill; acceptable under §1 because a completing session still plays its chime, so it is never silently lost.

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

### Icons (3.24.0 — no emoji in UI)
- **`lucide-react` is the only icon source.** No emoji as UI icons, ever — they render as multicolour pictographs, ignore `color`, and ignore the accent. Import per-icon (`import { Home } from "lucide-react"`); `lucide-react` is in `optimizePackageImports` so unused icons don't ship.
- **Size/stroke contract**: `size={16}` inline/body · `18` panel header · `22` dock · `20` hub cards · `strokeWidth={1.75}` (`2` for small ✕/✓ marks). Deviating breaks §2.2 similarity — the whole point of the migration.
- **Icons inherit `currentColor`**, so accent-awareness is free: active dock/nav items take `var(--accent)`, inactive take a muted tone. Don't hardcode a hex.
- **Three deliberate exemptions.** (1) 🧡 — brand mark, stays. (2) Chess `♚♛♜♝♞♟` and card `♠♥♦♣` — already monochrome typographic glyphs that inherit colour, and lucide has no equivalent. (3) 🐿️/🎂 **inside prompt strings** (`lib/tyunPersona.ts`, TyunniePanel's system prompt) — those are model instructions, never rendered. Do not "clean up" any of these.
- **Music/Focus transport** is lucide (`Shuffle`/`SkipBack`/`Play`/`Pause`/`SkipForward`/`Repeat`), identical in both components. The old rule said "monochrome text characters"; the intent — monochrome, colour-inheriting, never colour emoji — is unchanged.

### Destructive actions
- **One dialog system.** `confirmDialog()` from `components/ui/ConfirmDialog.tsx` returns `Promise<boolean>`; `<ConfirmHost />` is mounted once in the dashboard. **Never call `window.confirm`** — it can't carry the app's look or Tyun's voice. (The helper falls back to `window.confirm` only if no host is mounted, so the action is never silently swallowed.)
- Every delete of user data confirms: Todo, Snippets, StickyNote, Writing, Projects, Finance, Profile vault, Music tracks. Copy states **what is lost**, not "are you sure". Cheap losses skip it — an empty sticky note deletes without a prompt.
- Undo would beat confirm under §1.3, but needs a toast system and per-entity re-insert; deferred deliberately.

### Misc
- Next `Image` src omits `/public/` (use `/sprites/foo.png`). Sprite canvas 360×460; Desk hero 560×720. Set real intrinsic w/h, CSS `auto` to scale.
- Vault PIN never stored — only PBKDF2 verifier + salt + IV. OTP in-memory Map (10-min, not cold-start-persistent).
- StickyNote `isTypingRef` guard (600ms) prevents prop sync overwriting mid-type.
- Collapsible panels toggle `flex-1`/`flex-none`, NOT `w-0`.
- **An inline `style` cannot be dark-mode remapped.** `.dark .bg-white` is a class selector and inline wins. Anything needing a dark variant goes through a class (`.desk-hero`, `.desk-card`) — see `globals.css`. New semantic Tailwind colours (`bg-teal-50`…) also need an explicit `.dark` remap; nothing enforces this automatically.
- **Touch reachability**: hover-revealed controls (`opacity-0 group-hover:opacity-100`) get a `@media (hover: none)` rule making them permanently visible at `opacity: 0.45` — a touchscreen has no hover to trigger them. Small controls that must stay visually small use `.tap-target` (a 40px `::after` hit area, layout untouched).
- **Tap feedback is a global `:where()` rule** in `globals.css` — zero specificity so it never outranks Tailwind's `transition-colors`. Don't convert it to a normal selector. Elements with an **inline** `transform` are excluded because inline wins: the dock composes its press into `dockScale()` via `pressedIdx` instead. Opt out with `.no-tap`.
- **Command palette**: `PaletteResult.data` (discriminated by kind) carries the source record for the preview pane. Modal widens to `max-w-3xl` if ANY result is previewable and holds that width — never resize per-selection.
- Loading states are shape-matched skeletons + **time-based** stage copy. Never render a progress bar for Groq/JDoodle — we don't know the duration.
- Pomodoro: remount via incrementing `pomodoroKey`, NOT `key={pomodoroTask}` (task resets to `""` mid-session).
- Corrupted Supabase session after failed Google OAuth → clear `sb-*` from localStorage + IndexedDB. `supabase.ts` overrides auth `lock` to avoid navigator-LockManager "steal" aborts; `authHeader()` uses `refreshSession()`.
- Shared utils: `lib/platform.ts` `isMac()`/`modKey()`, `components/ui/Kbd.tsx`, `lib/weatherIcon.ts` `getWeather(code)` (WMO → label + icon, used by Weather.tsx AND the Desk weather widget) — import, never redefine locally.

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
