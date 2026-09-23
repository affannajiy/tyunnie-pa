# CLAUDE.md — Tyunnie PA

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Personal AI assistant web app, Taehyun (TXT) themed. Next.js 16 · TypeScript · Tailwind v4 · Supabase · Gemini + Groq · Vercel. v3.29.0.

**This file is the invariant list, not the manual** — and the only CLAUDE.md. `next dev` keeps the `nextjs-agent-rules` block above in sync (no `AGENTS.md`, so it writes here); leave the markers. One line per rule. Depth lives in the skills and docs below.

**Docs** — [DEPLOYMENT.md](docs/DEPLOYMENT.md) env/Vercel · [DATABASE.md](docs/DATABASE.md) schema/SQL · [SECURITY.md](SECURITY.md) posture + accepted risks · [DEVNOTES.md](docs/DEVNOTES.md) gotcha log · [rulebooks/README.md](rulebooks/README.md) routes a change to the right rulebook. Rulebooks are portable principle refs — never put project state in them.

**Skills** (`.claude/skills/`, invoke by name):

| Skill | Owns |
|---|---|
| `tyun-git` | commits/push — **only when asked**; title ≤10 words from CHANGELOG |
| `tyun-documentation` | CHANGELOG · version bump · README · this file |
| `tyun-designer` | UI/UX review + the colour, contrast and a11y contract |
| `tyun-security` | app-code posture: auth, CSP, crypto, XSS, prompt boundary |
| `tyun-deps` | supply chain: audit, lockfile, overrides, Dependabot, CI |
| `tyun-database` | schema, RLS, migrations, `lib/database.ts`, guest branch |
| `tyun-engineer` | code quality: dates, timeouts, failure handling, tracked debt |
| `tyun-network` | caching, bundle, latency |

Boundaries: RLS *audit* = security, RLS *change* = database. Skills run in-session and can use what you already know; delegate only the file-reading of a whole-app sweep to a subagent.

---

## Layout

- `app/` — `dashboard/` (shell, auth guard 15s, renders all panels) · `auth/` (Supabase email + Google OAuth) · `about/` (public changelog) · `error.tsx`/`not-found.tsx`.
- `app/api/` — `chat` (Gemini 3.5 Flash → Groq gpt-oss-120b fallback, 400 tok) · `run` (JDoodle) · `daily-quote` (cron `0 0 * * *` = 8am MYT, Groq→Resend) · `vault-notify` (OTP + PIN mail) · `changelog` · `exchange-rates`.
- `components/` — Desk, TyunniePanel (chat), Sidebar (dock), Profile (vault), Todo, Writing, Projects, Snippets, Finance, Music + MiniPlayer, Pomodoro, Weather, FocusMode, StickyLayer/StickyNote, hubs, `games/` (one folder per game — `blackjack/`, `chess/`, `mahjong/`, `minesweeper/`, `solitaire/`, `sudoku/`, `tetris/`, `tictactoe/` — each `<Game>.tsx` + `engine.ts` + `engine.test.ts`; `ui/` shared kit, `cards.tsx`), `ui/Kbd.tsx`, `ui/ConfirmDialog.tsx`, `AppProviders.tsx`.
- `lib/` — `database.ts` (all CRUD, guest-routed) · `gameStore.ts` · `gameAudio.ts` · `guest.ts` · `supabase.ts` · `crypto.ts` (AES-GCM + PBKDF2) · `apiAuth.ts` · `rateLimit.ts` · `accent.ts` · `dayKey.ts` · `withTimeout.ts` · `mathEval.ts` · `safeUrl.ts` · `platform.ts` · `useFocusTrap.ts` · `useAccentColor.ts` · `MusicContext.tsx` · `WorkspaceContext.tsx` · `tyunPersona.ts` · `changelog.ts` · `version.ts` · `activePanel.ts`.

---

## Invariants

### Build — break Vercel if violated
- `lib/useSpeech.ts` keeps its `any` + file-scope eslint-disable. `SpeechRecognitionEvent` breaks Vercel. Load-bearing.
- Lint toolchain is pinned, not stale: `eslint` stays `^9`; `brace-expansion` overridden to `^2.1.4` under **all four** minimatch@3 consumers. After touching `overrides`, verify with `npm ci --dry-run` — `npm install` hides the break. → `tyun-deps`
- **Never construct an SDK client at module scope in an API route.** `next build` imports the module; Resend/Groq/Gemini throw on a missing key at construction and CI has no secrets. Use a lazy memoised getter.
- CSS module decls → `global.d.ts`, not `next-env.d.ts` (gitignored).
- `dynamic()` loses prop types — `dynamic<Props>(...)` with the type from `lib/tyunniePanelTypes.ts`.
- tsconfig target ES2017 — no regex `s` flag, no ES2018+ in `lib/changelog.ts`.

### Routing / config
- `/` redirect lives in `next.config.ts` `redirects()`, not `app/page.tsx`.
- `/_next/static` immutable caching is **production-only** (breaks HMR).
- `export const viewport` in `app/layout.tsx` is load-bearing — without `viewportFit:"cover"` every `env(safe-area-inset-*)` silently resolves to 0. Never add `maximumScale`/`userScalable:false`.

### State
- One-shot AI calls gate on `sessionStorage`, not `useRef` (refs reset on remount): `tyunnie_briefing`, `desk_oneliner`, `pomodoro_autostart`.
- Every `JSON.parse(localStorage…)` is try/caught — a corrupt blob in a mount effect trips the error boundary.
- Theme `tyunnie_theme`, accent `tyunnie_accent` (a **hex**, never an `r,g,b` triple) → CSS vars on `<html>`, set pre-paint in the layout script.
- Accent has two apply paths: `setAccentVars()` = vars only · `saveAccent()` = vars + storage + DB row. Auto-Theme calls **only the first**. → `tyun-designer`
- Any rAF/canvas loop using the accent takes it as a dep or re-reads per frame. Stale-accent has bitten twice.

### Version / changelog
- Single source `lib/version.ts` (re-exports `pkg.version`). A bump touches 4 places: `package.json`, README badge, the `CLAUDE.md` header line, a new `docs/CHANGELOG.md` block.
- `### Highlights` is the only user-facing section — `/about` renders that and nothing else. No Highlights = hidden.
- **No post-update modal.** Deleted in 3.24.0. Do not reintroduce a version-gated popup. The Feb-5 birthday modal is the only auto-showing one, and it is date-gated.

### Persona
- `lib/tyunPersona.ts` `TYUN_CORE` = single source. Chat + daily-quote compose on top.
- Daily-quote variety = 35 TOPICS × 8 TONES + dynamic subject. Don't collapse to a fixed set.
- `TYUN_BIRTHDAY`/`isTyunBirthday()` (Feb 5) drive the chat line, the quote topic, and `TyunBirthday.tsx`.

### Music / Focus
- **The Haze (`components/visualizer/`) is the one music visual** — Music panel, Focus Timer, Focus Listen. No style picker; the other six styles were built, compared and dropped. Per-frame values live in refs, never state.
- Haze colour comes from the **cover** (`extractAccent`), not the accent — the accent is only the fallback. Opacity ramp `0.08→0.55` is the old Focus glow's, kept on purpose.
- Only the top-mounted `Visualizer` draws (module stack) — FocusMode over the Music panel must not run two shader loops. Phones: 0.4 CSS-px backing store, 3 octaves, ≤60 fps.
- `togglePlay` is `async` (`audioCtx.resume()`). Skip reads `audioRef.currentTime`, never `progress` state.
- MiniPlayer is always a separate overlay — never embedded in TyunniePanel. Its X hides, does not pause; hidden-ness is `dismissedAt` (a track index), not a boolean.
- Auto-Theme driver lives in `MusicContext`, not `Music.tsx`, so it survives the panel closing. `lib/artColor.ts` returns `null` on a bad cover; callers fall back to `readSavedAccent()`.
- Transport icons are lucide in **all five** places (Music, FocusMode, MiniPlayer, DeskWidgets ×2, Pomodoro). Never text glyphs, never emoji.
- FocusMode is one component with two emphases (`listenMode`, lazy `useState` init). **Do not build a second fullscreen visualizer.** Listen mode shows no timer — deliberate.
- **Never put a CSS `transition` on a property a rAF loop writes.** Do attack/decay in JS.
- **rAF loops bypass `prefers-reduced-motion`** — check `matchMedia` explicitly.

### Drag (MiniPlayer / chat Float)
- `touchAction:none`; exclude `button/input/textarea` in `onPointerDown`; init position in `useEffect`.
- Drag writes `left`/`top` to the node; commit state only on release.
- Every document-level drag needs `pointercancel` **and** an unmount cleanup.
- MiniPlayer uses document-level listeners (capture threw "No active pointer"); Float still uses capture. MiniPlayer z-45 (> StickyLayer z-40), mobile = compact pill. Float z-60, 400×560, desktop only, wrapper always mounted.

### Cross-route persistence
- **`MusicProvider` lives in `app/layout.tsx` via `AppProviders.tsx`, never under a page** — its cleanup destroys the audio element, so a route push killed playback. `MiniPlayer` renders there too and must not also mount in the dashboard.
- `lib/activePanel.ts` (module var + event) is how that MiniPlayer knows the Music panel is open. Reverse direction is `tyunnie-open-panel`. Don't convert either to a context.
- Known: returning from `/about` fully remounts the dashboard.

### Panels
- Bottom sheet is always mounted; `isOpen` toggles `translateY`, never `display:none`. `snapPct` desktop `[8,4,0]`, mobile `[0]` fullscreen-only.
- Dock: `dockScale` `1.55/1.22/1.08/1.0` by distance. NAV 0–3 `[desk,focus,create,play]`; TYUN=4 STICKY=5 FOCUS=6 LOGOUT=7. **Mobile dock is 7 items and stays 7** (measured 54×72 @375, 51×72 @360).
- **`PANEL_MEASURE` in `app/dashboard/page.tsx` owns every panel width.** A panel must not set its own top-level `max-w-*`.
- Collapsible panels toggle `flex-1`/`flex-none`, never `w-0`.
- The panel wrapper keeps a `transform` from `animate-panel-in` (`fill-mode: both`), so a `fixed` overlay rendered inside a panel is positioned against the panel and sits under the z-50 dock. Edge-to-edge overlays `createPortal` to `document.body` (Mahjong Guide); centred modals may accept the offset (Chess, Profile).
- `flex-1` in a `flex-col` sets `flex-basis:0` on the **height** axis — scope it (`w-full sm:flex-1`) on any row that stacks.
- `dvh`, never `vh`, including inline styles.
- Command palette: the modal widens to `max-w-3xl` if any result is previewable and holds it — never resize per selection.

### WorkspaceContext
- Broadcast-only: panels push snapshots, TyunniePanel reads. Always `setSnapshot(null)` on unmount. Debounce 600ms + 4s pause; proactive cooldown 90s; per-snapshot gate in `sessionStorage`. Broadcasters: Snippets, Writing, Todo.

### AI actions
- Strip trailing garbage before parsing action JSON: `.trim().replace(/[^}]*$/, "").trim()`.
- Item UUIDs exposed as `[id:uuid]`. Read-only queries must not trigger destructive actions.
- Agentic events: `tyunnie-pomodoro-preset`, `tyunnie-filter-panel`.

### Games (all eight)
- **Engines are authoritative, pure, and tested.** Every `games/<game>/engine.ts` (+ `chess/bot.ts`, `mahjong/{scoring,bot}.ts`, `sudoku/{solver,generator}.ts`) owns every rule; the component schedules timers and renders. A rule change lands in the engine and its `*.test.ts` first. `npm test` is a blocking CI step.
- Every engine transition bumps `tick`; the component's timer effect keys on it and checks `cur.tick === g.tick` before applying, so a stale bot/dealer step never lands on a new hand. Tetris goes further: one `apply()` funnel with the ref as truth, because a rAF loop and key handlers both mutate.
- **No `GameShell`.** Each game keeps its own layout and composes `HeaderButton` + `GameSheet` + `StatRows` + `GameSettingsBody` from `games/ui`. Don't add a wrapper that owns layout.
- **Sound cues come from a state-diff effect**, never from inside a `setState` updater (StrictMode runs updaters twice). Same for stats recording: an effect keyed on the finishing tick, guarded by a ref.
- **Bots never random except Easy** (Tic-tac-toe, Mahjong). Chess has no random tier at all — every level is search depth; a test pins determinism. Never add a dice roll to fake difficulty.
- **Chess search runs on the main thread** under `BOT_BUDGET_MS` (1.5s) via iterative deepening. Don't raise Expert past depth 4 without a Worker.
- **Sudoku difficulty is the grader's word**, not a clue count; a puzzle ID regenerates the exact grid, so the generator must stay deterministic for a seed — no `Math.random` in `generator.ts`/`solver.ts`.
- **Minesweeper's first click clears 3×3.** No no-guess solver — declined; a late 50/50 is the game.
- **Resume saves** (`tyunnie_games_<game>_save`) exist for Chess, Sudoku, Solitaire, Minesweeper only, written on engine tick and cleared when the game ends or is emptied. Tetris and Tic-tac-toe don't save — deliberate.
- Difficulty names are Easy / Normal / Hard / Expert; readers accept the old `"medium"` as Normal. Don't reintroduce `medium`.
- Surfaces: FELT for card/tile tables only (Blackjack, Mahjong, Solitaire); Tetris well is `.on-dark`; the rest stay cream.
- `components/Games.tsx` is data-driven — a card's `record()` reads only the fields it prints, with defaults, so a game may change its store shape without touching the hub as long as those fields survive.
- Blackjack `RULES` is the single source — the rules sheet renders from it. Don't list a rule the engine doesn't implement.
- Chips are fictional: `tyunnie_games_blackjack` in localStorage, never DB, never Finance. Written only in `betting`/`settled` so a mid-hand unmount refunds the wager.
- Shoe indicator is a coarse bar. **Never show a card count** — that's a counting dashboard.
- Mahjong is four winds with dealer continuation; there is no hand cap and `handNo` is display only. Don't reintroduce `HANDS_PER_GAME`.
- Multi-win on one discard: closest to the shooter only. Declined 一炮多響 on purpose.
- Mahjong Expert is deterministic (`chooseDiscardExpert`); a test asserts it.
- All `tyunnie_games_*` storage goes through `lib/gameStore.ts` `readStore()` — schema-checked against a default. Sound/speed are one shared blob; game prefs and stats are per game.
- Sound is Web Audio synth in `lib/gameAudio.ts`, default **off**, no asset files. Don't add sample files.
- `scaleDelay()` for every game timer — Fast and reduced-motion halve it.
- `FELT` surface is `.on-dark` in both themes; table chrome outside it stays app cream. `GameSheet` portals to body at z-70.
- Quips index by hand number, not `Math.random` — `react-hooks/purity` and stable across re-renders.

### Guest mode (`lib/guest.ts`)
- `GUEST_ID="demo-user"`; flag `tyunnie_guest`; data in `tyunnie_guest_data`, never the DB. A real Supabase session always wins.
- Paid endpoints (chat, run, exchange-rates) show a **sign-up state, not a 401**.
- **A guest no-op must be visible.** The DB layer returning `null` is not a UI state — that is how the vault shipped silently broken. Before adding a Profile setting, ask what it does for a guest. → `tyun-database`

### Icons
- **`lucide-react` only.** No emoji as UI icons, ever. Import per-icon.
- Sizes `16` body · `18` panel header · `22` dock · `20` hub cards · `strokeWidth={1.75}` (`2` for small ✕/✓). `fill="currentColor"` on solid transport glyphs.
- Three standing exemptions: 🧡 brand mark · chess/card/mahjong typographic glyphs (mahjong tiles are hand-drawn text, not the Unicode block — it tofus on Android) · emoji inside prompt strings (never rendered). Don't "clean up" any.
- Hand-rolled `<svg>` only for non-icons: six progress rings, two sticky corner folds, the Google mark.

### Destructive actions
- **One dialog system**: `confirmDialog()` + a single `<ConfirmHost />`. **Never `window.confirm`**, never `window.alert` for a recoverable problem.
- Copy states **what is lost**, not "are you sure". Cheap losses skip the prompt (an empty sticky note).
- **Never make destruction the default**: focus opens on Cancel, Enter does not confirm, Escape cancels, Tab is trapped, focus returns to the opener. Do not add `autoFocus` to the confirm button.
- Undo would beat confirm, but needs the toast system — deferred, see debt.

### Colour, contrast, a11y — short version, depth in `tyun-designer`
- `--muted` / `--muted2` are the muted text tokens and are **fixed values** (`#6f6455`, `#756a5a`). Do not lighten them back; the old ones measured 3.18:1 and 1.86:1.
- `--accent` is a **fill**, `--accent-text` is **text**, `--accent-on` is what sits **on** a fill. The accent is user-picked, so these are derived at runtime in `lib/accent.ts` — and the pre-paint script in `app/layout.tsx` must compute the same three or the first paint flashes.
- `.on-dark` marks a surface that is dark in either theme. Never sed a light-surface colour swap across those files.
- Theme custom properties scope to **`.dark body`**, not `.dark` — an inline var on `<html>` beats a class rule on the same element.
- An inline `style` cannot be dark-remapped. New semantic Tailwind colours need an explicit `.dark` remap; nothing enforces it.
- Every form control carries a programmatic name. Landmarks exist: `<main id="main-content">`, `<header>`, `<nav aria-label="Primary">` on both docks, skip link first in the dashboard.
- Targets under 24px get `.tap-target`. Hover-revealed controls need a `@media (hover: none)` fallback.
- Anything positioned from stored coordinates clamps on `resize` **and** `orientationchange`, in memory only.
- **320px reflow is a pass/fail gate.** The page never scrolls sideways.
- Type floor: `text-[9px]` bumps to 10px below `md:`. Mobile reference widths: 360px narrowest, 394px average.
- iOS zooms on any input under 16px and does not zoom back — handled once in `globals.css`. Don't remove it, don't shrink a field below it.
- Tap feedback is a zero-specificity `:where()` rule; an inline `transform` opts out (the dock composes its press into `dockScale()`). Opt out with `.no-tap`.
- Loading states are shape-matched skeletons with **time-based** copy. Never a progress bar for Groq/JDoodle.

### Dates & remote calls — depth in `tyun-engineer`
- **`new Date().toISOString().split("T")[0]` is banned. Use `lib/dayKey.ts`.** It returns the UTC day; in UTC+8 that was yesterday until 8am, in nine places. Browser-side only — server routes run in UTC.
- Never mix a local clock with a UTC date in one function.
- **Every remote call gets a deadline.** Vendor SDKs (Gemini/Groq/Resend) take no timeout — use `withTimeout()` from `lib/withTimeout.ts`. Direct `fetch` uses `AbortSignal.timeout`. One copy, in `lib/`.
- `catch {}` around a provider call hides an outage. Log the message — message only, never the stack or the body.

### Security — depth in `tyun-security`, full posture in `SECURITY.md`
- Auth via `getAuthUser()`/`verifyAuth()`. Two-tier rate limit: per-IP burst + per-user daily quota. **In-memory limiter is the top scaling limit — move to KV before real traffic.**
- **There is no evaluator in this app and must not be one again.** Both calculator sites use `lib/mathEval.ts`, a real parser. Never `eval`/`new Function`/`setTimeout(string)`; production CSP has no `'unsafe-eval'` (dev only). Extend `FUNCS`, not a string.
- A user-supplied URL in an `href` needs `safeHref()` — React escapes text, not schemes.
- `sanitizeHtml()` **escapes everything, then re-opens** bare `b|strong|em|i|code|br`. Never convert it back to a strip-regex.
- Every API body parse is inside `try`. `/api/chat` prepends `SERVER_PREAMBLE` server-side — a client-built prompt is not a boundary.
- Vault: PIN never stored (PBKDF2 verifier + salt + IV, 600k iterations; the 100k fallback is read-only). OTP in-memory, not cold-start-persistent.
- `no-store` for authenticated routes is set centrally in `next.config.ts`; `/api/changelog` and `/api/exchange-rates` are deliberately excluded.
- CI enforces the floor: `npm audit --omit=dev` must be 0, CodeQL per-PR + weekly. `npm run lint` is advisory.

### Tracked debt — written down so it doesn't become architecture
- **`lib/database.ts` is fire-and-forget.** 47 functions log to console and return `void`; reads `return data ?? []`, so a failed fetch is indistinguishable from an empty list. Needs the toast system — one change, not two. Don't add a `boolean` return before a caller reads it.
- **vitest covers the eight game engines only** (199 tests). `mathEval`/`dayKey`/`withTimeout` are still verified by throwaway scripts — port them to `*.test.ts` next time they change.
- **ESLint: 54 problems**, 0 unused-vars, none in `components/games`. Mostly `exhaustive-deps` and `set-state-in-effect` in the older panels. Clear `exhaustive-deps` before making lint blocking — it is the stale-closure class that already bit twice.
- **Solitaire cards are pointer-only.** Draw/undo/auto/new have keys, but moving a card needs a roving `tabIndex` + a pick-then-place key scheme (WCAG 2.1.1). Design first, then build.
- **Label→field association missing.** Controls carry `aria-label`, but there is no `htmlFor` anywhere, so clicking a visible label doesn't focus its field. Needs `useId()` per field.

### Misc
- `Image` src omits `/public/`. Sprite canvas 360×460, Desk hero 560×720; real intrinsic w/h, CSS `auto`.
- StickyNote `isTypingRef` (600ms) stops prop sync overwriting mid-type.
- Pomodoro remounts via an incrementing `pomodoroKey`, never `key={pomodoroTask}`.
- A failed Google OAuth leaves a corrupt session → clear `sb-*` from localStorage + IndexedDB. `supabase.ts` overrides the auth `lock`; `authHeader()` uses `refreshSession()`.
- Shared utils exist — import, never redefine: `platform.ts` `isMac()`/`modKey()` · `ui/Kbd.tsx` · `weatherIcon.ts` `getWeather(code)` · `useFocusTrap.ts` (any modal) · `useAccentColor.ts`.

---

## Versioning
Patch = fixes/build/types · Minor = features/UI · Major = architectural.

## Commands
```bash
npm run dev      # Next + Turbopack, auto-opens browser (dev:noopen = plain)
npm run build    # production build + type check
npm run lint     # ESLint (advisory)
```
