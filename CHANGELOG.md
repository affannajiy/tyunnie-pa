# Changelog

All notable changes to Tyunnie are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.19.0] — 2026-05-13

### Added

- **Speed Test panel** (`components/SpeedTest.tsx`) — real network speed test using Cloudflare's speed endpoint. Tests ping (10 round trips, drops 2 cold-start samples), jitter (std dev of ping samples), download (4 parallel streams, 10-second window, live Mbps gauge), and upload (4 parallel streams, 10-second window). Abort controller cancels all in-flight requests on stop. Results displayed as animated gauges with colour-coded thresholds. Accessible from the Create hub
- **Create hub** (`components/CreateHub.tsx`) — new hub panel grouping Writing, Snippets, Finance, Calculator, SpeedTest under a "Make something." headline

### Changed

- **Hub reorganisation** — replaced the two-hub layout (Productivity + Entertainment) with three purpose-driven hubs:
  - **Focus** 🎯 (`ProductivityHub.tsx`) — Tasks, Projects, Pomodoro. "Where things get done."
  - **Create** ✨ (`CreateHub.tsx`) — Writing, Snippets, Finance, Calculator, SpeedTest. "Make something."
  - **Play** 🎮 (`EntertainmentHub.tsx`) — Music, Games. "Rest is part of the work."
- `Panel` type updated — `"productivity"` and `"entertainment"` replaced by `"focus"`, `"create"`, `"play"`
- Sidebar dock now has 4 NAV_ITEMS (desk, focus, create, play); `TYUN_IDX` updated to 4, `STICKY_IDX` 5, `FOCUS_IDX` 6, `LOGOUT_IDX` 7
- Mobile horizontal swipe now cycles through Home → Focus → Create → Play
- `CommandPalette.tsx` — hub entries updated to Focus Hub, Create Hub, Play Hub with relevant keywords
- `TyunniePanel.tsx` — `PANEL_SPRITES` keys updated; system prompt `navigate`, `hide_panel`, and agentic workflow references updated to new panel IDs

### Fixed

- **HMR / fast refresh broken in dev** — `/_next/static/(.*)` `Cache-Control: immutable` header in `next.config.ts` was applied unconditionally, causing the browser to cache HMR chunks forever. Header now production-only (`process.env.NODE_ENV === 'production'`). Dev fast refresh works normally again

---

## [3.18.0] — 2026-04-30

### Added

- **Sassy loading quotes** (`lib/tyunnieQuotes.ts`) — new module exporting `TYUNNIE_QUOTES` (20 dry, deadpan Taehyun-inspired quotes), `getRandomQuote()`, and `getCyclingQuote(index)` for timed rotations
- **TyunniePanel thinking state** (`components/TyunniePanel.tsx`) — replaced the three pulsing dots with the `tyun-mood-thinking` sprite (80px) and a frosted-glass pill showing a quote that rotates every 2.5 seconds via `setInterval`. Interval ref (`useRef`) prevents re-renders; quote index (`useState<number>`) drives updates. Interval is cleared as soon as the AI response arrives
- **Dashboard auth loading screen** (`app/dashboard/page.tsx`) — replaced the static "Loading..." screen with the default Tyunnie sprite (120px), a quote that rotates every 3 seconds, and a muted "Loading your space..." label. Respects dark mode via Tailwind `dark:` classes; accent color uses the CSS custom property set by the layout script
- **Panel skeleton quote** (`app/dashboard/page.tsx`) — `PanelSkeleton` now shows a single static Taehyun quote (picked once at module load via `getRandomQuote()`) in centered italic muted text below the pulse bars
- **404 Tyunnie Runner mini-game** (`app/not-found.tsx`) — canvas-based side-scrolling runner game added inside the 404 right card. Tyunnie (dark warm rectangle with a white eye) jumps over procedurally spawned pixel-block obstacles. Space / ArrowUp / tap to jump and start. Speed ramps by 0.0015 px/frame; obstacles alternate tall (16×40) and wide (30×20); gaps randomised 220–380px. Score increments each frame; high score persisted to `localStorage['tyunnie_runner_hs']`. On death, an overlay shows score, a random Taehyun quote, and restart prompt. All game state lives in a `useRef<RunnerRef>` (no React re-renders per frame); accent color read from `--accent-rgb` CSS variable each frame for dynamic theming
- **Agentic Pomodoro preset switching** (`components/Pomodoro.tsx`) — listens for the `tyunnie-pomodoro-preset` custom event dispatched by TyunniePanel actions. Supports four presets: `classic` (25/5), `extended` (50/10), `short_sprint` (15/3), and `deep_work` (45/15). Applies the selected preset by updating settings, resetting the timer to focus mode, and persisting via `saveSettings` — all without requiring the user to manually open the settings sheet
- **Agentic tag filter for Todo** (`components/Todo.tsx`) — listens for the `tyunnie-filter-panel` custom event with `panel: "todo"`. Sets `filterTag` state which layers on top of the existing done/pending filter, letting Tyunnie narrow the task list to a specific tag (cs / write / personal / other) via chat command
- **Agentic search filter for Writing** (`components/Writing.tsx`) — listens for the `tyunnie-filter-panel` custom event with `panel: "writing"`. Populates the search field so Tyunnie can surface a specific draft by title keyword via chat command
- **Sidebar `hiddenPanels` prop** (`components/Sidebar.tsx`) — new optional `Set<string>` prop filters nav items on both desktop dock and mobile bar, enabling future per-user panel visibility preferences without changing the `NAV_ITEMS` constant

---

## [3.17.1] — 2026-04-28

### Security

- **`/api/vault-notify` auth guard** — endpoint now requires a valid Supabase JWT (`Authorization: Bearer <token>`). Previously unauthenticated callers could trigger OTP and notification emails to arbitrary addresses. All four `fetch` calls in `Profile.tsx` updated to include the `Authorization` header via `authHeader()`
- **`sanitizeHtml` single-quote bypass** — event handler stripping regex in `TyunniePanel.tsx` was `\son\w+="[^"]*"` (double-quotes only); replaced with `\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)` to also strip single-quoted and unquoted event handlers. `javascript:` check strengthened to `javascript\s*:` to handle whitespace variants
- **Content-Security-Policy header** — added CSP to `next.config.ts` restricting scripts, styles, images, media, fonts, and outbound connections to known-safe origins. Blocks object/embed injection (`object-src 'none'`), base-tag injection (`base-uri 'self'`), and cross-origin form submission (`form-action 'self'`). `unsafe-inline`/`unsafe-eval` retained for Next.js inline scripts and the Calculator's `new Function()` evaluator

### Changed

- **Error page redesign** (`app/error.tsx`) — replaced dark single-panel layout with a split left-panel/right-card design matching the auth page style. Left panel shows accent-gradient background, animated glow bubbles, and the default Tyunnie sprite; right panel shows a clean card with Try Again + Go Home buttons. Fully accent-color-aware (reads `localStorage['tyunnie_accent']`), dark mode supported, responsive (single-column on mobile, split on `lg+`)
- **404 page redesign** (`app/not-found.tsx`) — same split-layout redesign as error page; now a client component to read accent color. Uses the happy sprite on the left panel; dev-mode error block removed (404 has no error object). Mobile-first with sprite shown above the card on small viewports
- **Desk one-liner timeout + fallback** (`components/Desk.tsx`) — AI one-liner fetch now aborts after 1.5 s via `AbortController`; both timeout and network error paths set a static fallback string (`"Make today one worth remembering."`) so the hero section is never blank. Loading skeleton removed — hero subtitle is always the static "Welcome home 🧡" line while the one-liner populates the quote widget separately
- **Widget grid layout flash fix** (`components/DeskWidgets.tsx`) — added `useLayoutEffect` for synchronous initial container width measurement before first paint, eliminating the grid-width jump that occurred when the `ResizeObserver` (async) fired after the initial render

---

## [3.17.0] — 2026-04-27

### Performance

- **Parallel data loading** — `getProfile` now fetched inside the initial `Promise.all` alongside todos, drafts, projects, snippets, finance, sticky notes, and memories, eliminating a sequential Supabase round-trip on every dashboard load
- **Panel skeleton loaders** — lazy-loaded panels (Tasks, Writing, Projects, Snippets, Finance, Music, Pomodoro, Games, Calculator, Profile, and Hub panels) now show a pulsing skeleton while their JS chunk downloads instead of a blank area, improving perceived load time
- **Static asset caching** — `/_next/static/` chunks now served with `Cache-Control: immutable` (1 year); public images/fonts cached for 1 day with 7-day stale-while-revalidate
- **Bundle tree-shaking** — `recharts` and `date-fns` added to `optimizePackageImports` so Next.js only bundles the symbols actually imported, shrinking the Finance and date utility chunks
- **Open-Meteo preconnect** — `<link rel="preconnect" href="https://api.open-meteo.com">` added to `<head>` so the TLS handshake for the weather widget completes before the request fires
- **Build hygiene** — `poweredByHeader: false` removes the `X-Powered-By: Next.js` response header; `reactStrictMode: true` made explicit

### Added

- **WorkspaceContext** (`lib/WorkspaceContext.tsx`) — new React context that lets panels broadcast their active content to TyunniePanel in real time. `Snippets.tsx`, `Writing.tsx`, and `Todo.tsx` now push debounced (600ms) snapshots of the user's active content, resetting to `null` on unmount
- **Proactive workspace suggestions** — TyunniePanel watches the active workspace snapshot and, after a 4-second "Tyun pause", fires a background `/api/chat` call with a special system prompt that generates a short, genuinely useful suggestion (bug catch for code, quiz generation for writing, focus tip for tasks). The suggestion appears as a dismissable frosted-glass card above the chat input, with a "Use this →" button that pre-fills the input without auto-sending
- **Detachable floating TyunniePanel** — new "Float panel" button (desktop only) in the panel header converts the bottom-sheet into a free-floating, draggable 400×560px window using Pointer Events drag (`setPointerCapture`). Position is persisted to `localStorage['tyunnie_float_pos']` on drag end; float state persisted to `localStorage['tyunnie_float']`. The always-mounted wrapper preserves chat history across mode switches. Snap-back button in the float handle returns to the bottom sheet

### Changed

- **TyunniePanel header** — "Float panel" detach button (pop-out SVG icon) added beside the close button on desktop; hidden on mobile
- **Proactive suggestion cooldown** — 90-second global cooldown via `lastProactiveRef`; per-snapshot sessionStorage gate prevents re-firing on remount; respects active-chat guard (skips if panel open and last message < 60s ago)
- **Tyunnie system prompt** — workspace snapshot now injected into every chat request (first 600 chars of active panel content); allows Tyunnie to answer "what does this do?" / "fix this" without the user pasting code or draft text. `set_volume` added to the declared action table (was handled in executeAction but undocumented in the prompt). Active panel name surfaced in context line alongside finance view month. New `WORKSPACE CONTEXT` strict rule block instructs Tyunnie to use live content naturally
- **Build** — `@vercel/analytics` import corrected from `/next` (missing in v1.1.4) to `/react`; `resend` added to `serverExternalPackages` so Turbopack no longer tries to statically resolve its optional `@react-email/render` dynamic import
- **CLAUDE.md** — documented WorkspaceContext broadcast pattern and float mode architecture rules

---

## [3.16.0] — 2026-04-21

### Added

- **Tyunnie calculate action** — ask Tyunnie any math question ("what is sin(30)?", "calculate 2^10") and it answers in chat AND sends the expression to the Calculator panel. `ScientificCalc` listens for a `tyunnie-calculate` window event (dispatched 350 ms after navigation) and falls back to `sessionStorage` when the panel isn't mounted yet. The expression appears in the top line; the live preview evaluates it in the bottom line
- **Calculator panel navigation** — Tyunnie can now navigate to the `calculator` panel ("open calculator", "go to calculator")
- **Games awareness in Tyunnie** — Tyunnie knows the Games panel contains Tetris, Chess, Sudoku, Minesweeper, TicTacToe, and Solitaire; lists them when asked what games are available and navigates there
- **Calculator context in Tyunnie** — system prompt now describes all four Calculator modes (Scientific, Graphing, Converter, Date) so Tyunnie can answer questions about them

### Changed

- **Tyunnie `add_finance` action** — `account` field added (`"Wallet"|"MAE"|"Maybank"|"Grab"|"GXBank"|"TnG"|"ASB"`); `executeAction` passes it through to `onFinanceAdded` (defaults to `"Wallet"` if omitted). Finance entries in the system prompt now display the account tag alongside category
- **Tyunnie strict rules** — account inference rule added for finance ("paid with Grab" → `"Grab"`, "from bank" → `"Maybank"`, etc.); NAVIGATION rule updated with `calculator` in known panels list and game-navigation guidance

### Fixed

- **Theme follows profile** — `Profile.tsx` now applies `p.theme` from Supabase when a profile record exists. Previously only the legacy migration branch (no profile) read `tyunnie_theme` from localStorage, causing deployed users to always get the browser default while local users retained a stale localStorage value

---

## [3.15.1] — 2026-04-20

### Fixed

- **Calculator dark mode** — Tailwind `dark:` variant now bound to `.dark` class via `@custom-variant` in `globals.css`; previously responded to system preference, so toggling the app to light mode left calculator buttons/inputs dark
- **Currency CORS** — moved Frankfurter API call to a server-side proxy route (`/api/exchange-rates`) to avoid browser CORS block; response cached 1 hour on Vercel

---

## [3.15.0] — 2026-04-20

### Added

- **Calculator hub** — Scientific mode expanded into a four-mode calculator (Windows Calculator style) with a scrollable tab bar
- **Graphing calculator** — canvas-based 2D function plotter; drag to pan, +/− to zoom, up to 5 simultaneous functions in distinct colours; supports `sin`, `cos`, `tan`, `sqrt`, `log`, `ln`, `abs`, `π`, `e`, `^`; safe expression sandbox via allowlist regex + `Function("x", ...)`
- **Unit converter** — 7 categories: Length, Weight, Temperature, Area, Volume, Speed, Currency; swap button flips units and preserves value
- **Live currency rates** — fetched from Frankfurter API on mount (USD base); falls back to static estimates on error; timestamp shown
- **Date calculator** — Duration mode (difference between two dates in Y/M/D + total days) and Add/Subtract mode (start date ± days/months/years) using `date-fns`
- **Theme-aware calculator** — all four modes follow light/dark mode and the user's chosen accent colour; graphing canvas adapts grid/axis colours at draw time

### Changed

- Scientific calculator outer container widened to `max-w-2xl` on desktop; mobile width unchanged
- Calculator title uses `var(--accent)` colour; subtitle shortened to "Scientific" (removed "· fx-570 style")
- Duplicate `=` button removed from scientific layout

---

## [3.14.0] — 2026-04-20

### Added

- **Scientific Calculator** (`components/Calculator.tsx`) — full Casio fx-570EX–style calculator accessible from the Productivity hub
- **Two-line display** — expression line (top, shows what you're typing) and result line (bottom, shows a live greyed preview while typing, solid result after `=`). Mode and SHIFT indicators shown as colour-coded badges
- **10 × 5 button grid** covering:
  - Trigonometry: `sin`, `cos`, `tan` — SHIFT gives `sin⁻¹`, `cos⁻¹`, `tan⁻¹`
  - Hyperbolic: `sinh`, `cosh`, `tanh` — SHIFT gives `sinh⁻¹`, `cosh⁻¹`, `tanh⁻¹`
  - Logarithms: `log` (base 10), `ln` — SHIFT gives `10ˣ`, `eˣ`
  - Powers / roots: `x²`, `√`, `xʸ` — SHIFT gives `x³`, `∛`, `ⁿ√`
  - Constants: `π`, `ℯ` (Euler's number)
  - Combinatorics: `nCr(`, `nPr(`, `n!`
  - Other functions: `|x|` (absolute value), `%` (divides by 100), `EXP` (×10^)
  - Memory: `MC`, `MR`, `M+`, `M−`
  - Full number pad with `(−)` sign toggle, parentheses, comma
- **SHIFT key** — toggles secondary functions; secondary labels shown in yellow above each button; auto-resets after any keypress
- **DEG / RAD toggle** — click the MODE button to switch angle units; indicator shown on display
- **Expression evaluator** — handles implicit multiplication (`2(` → `2*(`, `2π` → `2*π`), postfix factorial (`5!`), degree-to-radian conversion for trig, `Ans` (last result) and `Mem` (memory) references in expressions, arbitrary nesting via parentheses
- **Keyboard support** — digits, `.`, `+`, `-`, `*`, `/`, `^`, `(`, `)`, `,`, `Enter`/`=`, `Backspace`, `Escape` all trigger the matching button
- **Dark warm aesthetic** — dark `#0f0d0a` body matching Tyunnie's night palette; accent-orange `=` button; colour-coded button groups (blue for trig/scientific, purple for combinatorics, green for memory, amber for DEL, red for AC)

### Changed

- `Panel` type in `Sidebar.tsx` — `"calculator"` added
- `ProductivityHub.tsx` — Calculator card (🔢, indigo) added to the hub grid
- `dashboard/page.tsx` — dynamic import, panel render, and `PANEL_LABELS` entry added for `"calculator"`

---

## [3.13.0] — 2026-04-17

### Added

- **Topbar profile button** — profile avatar/initials button moved from the Sidebar into the topbar (top-right, beside the date). Clicking it opens the Profile panel. Applies on both desktop and mobile — the old inline Tyunnie button in the mobile topbar is replaced by the avatar
- **Tyunnie topbar brand label** — "Tyunnie" in Instrument Serif italic sits at the top-left of the topbar; clicking it returns to the Desk from any panel. Uses the accent color when the Desk is active
- **Pull-to-refresh (mobile)** — swipe down from the top of the content area while at scroll position 0 to reload all app data. A spinning ↻ indicator appears as you pull; releasing past the threshold fires the full data refresh. Uses `overscrollBehaviorY: contain` to prevent the browser's native PTR from conflicting
- **Horizontal swipe navigation (mobile)** — swipe left/right on the content area to cycle through Home → Productivity → Entertainment (and back). Guards against accidental triggers during normal vertical scrolling (requires > 55 px horizontal, < 55 px vertical delta). Disabled while TyunniePanel is open
- **Widget cross-device persistence** — `DeskWidgets` now saves layout and hidden-widget state to `profiles.desk_layout` (Supabase JSONB) on every change, debounced 600 ms. On login, the DB layout is preferred over `localStorage`, so the exact widget arrangement follows the user across all devices. `localStorage` is retained as an instant-read cache
- **Widget collision avoidance** — after every drag drop or resize, `resolveCollisions()` runs a push-down pass: the moved widget is the anchor; any overlapping widget is pushed downward until there are no overlaps (up to 20 iterations). Apple-style — nothing overlaps after a move
- **Widget layout templates** — a **Templates** button appears in the toolbar during edit mode, opening a modal with four presets:
  - **Dashboard** — all 8 widgets in a balanced 4-column grid (default arrangement)
  - **Focus** — Tasks + Pomodoro + Quote only (5 widgets hidden)
  - **Minimal** — Tasks, Clock, Weather, Quote (4 widgets hidden)
  - **Finance** — Life Progress + Activity + Music + Quote (4 widgets hidden)
- **Fluid entrance animations** — all major transitions are now spring-animated. `@keyframes panel-in` (opacity + translateY) replays on every panel switch via `key={activePanel}`. Modals and dialogs use `@keyframes modal-in` (scale 0.96 + translateY → 1). Backdrop fades use `@keyframes fade-in`. Applied to CommandPalette, ShortcutHelp, and the new Templates modal
- **Spring tab/dock animations** — desktop dock active-indicator dot and mobile tab active dot both use `cubic-bezier(0.34, 1.56, 0.64, 1)` spring with overshoot instead of a plain ease. Active mobile tab icon scales to 1.18× + shifts up 1 px on selection. Mobile tab buttons use `active:opacity-60` for touch feedback

### Fixed

- **Widget layout lost on hard refresh** — layout was localStorage-only; now persisted to Supabase so it survives hard refreshes and syncs across devices. Requires the `desk_layout` column migration (see DATABASE.md)
- **Pomodoro timer overflows ring** — timer text in the desk widget circle reduced from `text-5xl` to `text-3xl`; in Focus Mode from `text-6xl` to `text-4xl`
- **Mobile scroll not contained** — root layout switched from `h-screen` to `h-[100dvh]` (respects mobile browser chrome resize); content flex child gains `min-h-0` so `overflow-y-auto` engages correctly within the flex container

### Changed

- `Desk` component now accepts a `userId` prop and passes `userId` + `profile.desk_layout` down to `DeskWidgets`
- `dashboard/page.tsx` passes `userId={user.id}` to `<Desk />`
- `DeskWidgetsProps` extended with `userId?: string` and `savedLayout?: unknown | null`
- `DATABASE.md` updated — `desk_layout jsonb` migration SQL documented under profiles migrations

---

## [3.12.0] — 2026-04-16

### Added

- **Widget dashboard** (`components/DeskWidgets.tsx`) — the Desk's fixed card grid is replaced with a fully interactive widget system. Eight content widgets (Today's Focus, Life Progress, Focus Timer, Now Playing, Recent Activity, Tyunnie Says, Clock, Weather) sit on a 4-column absolute-position grid. All widgets are **draggable** (grab the handle bar in edit mode) and **resizable** (bottom-right corner handle), with snap-to-grid behaviour. Layout persists to `localStorage('tyunnie_widgets')`
- **Widget edit mode** — "Edit" button reveals drag handles, resize corners, an × remove button per widget, and faint column guide lines. "Done" exits edit mode. "Reset" restores the default layout. Removed widgets appear in an "Add Widget" tray below the grid
- **Widget wiggle animation** — iOS-style rotation wiggle on all widgets while in edit mode (cancelled on the active drag/resize target)
- **Mobile widget grid** — on viewports < 580 px, widgets fall back to a 2-column CSS grid with no drag/resize. Quote and Activity widgets span full width. Order follows row-first, then column
- **Adjustable Pomodoro timer** — focus, short break, and long break durations are now fully configurable in `components/Pomodoro.tsx`. A collapsible settings panel exposes four **presets** (Classic 25/5/15, Extended 50/10/30, Short Sprint 15/3/10, Deep Work 90/15/30) plus individual `+/−` steppers for each duration and the long-break interval. Settings persist to `localStorage('tyunnie_pomodoro_settings')` and dispatch `tyunnie-pomodoro-settings-changed` so the desk widget and Focus Mode stay in sync
- **Focus Mode in Sidebar** — the 🎯 Focus Mode button is now a permanent dock item in `Sidebar.tsx` (between Sticky and Sign Out), with the same magnify-on-hover scale as all other dock items. Works on both desktop pill and mobile bar. The Focus Timer widget's inline Focus Mode button has been removed accordingly
- **Music-rhythm glow in Focus Mode** — `FocusMode.tsx` reads frequency data from `music.analyser` in a `requestAnimationFrame` loop and maps bass-bin averages to a radial-gradient glow (radius 30–90 %, opacity 0.08–0.55) written directly to the background div via DOM ref — no `setState`, matching the per-frame beat detection pattern from `Music.tsx`
- **Focus Mode preset buttons** — the four Pomodoro presets (Classic / Extended / Short Sprint / Deep Work) appear as compact pill buttons below the timer in Focus Mode. Selecting one updates the timer, saves to localStorage, and dispatches `tyunnie-pomodoro-settings-changed`
- **Focus Mode duration info line** — subtle monospace line inside the timer circle shows current durations (e.g. "25m focus · 5m break") and updates when presets change
- **Command palette** (`components/CommandPalette.tsx`) — full VS Code-style `Ctrl/⌘+K` command palette. Searches across panel names, todo tasks, projects, drafts, snippets, keyboard shortcuts, and quick actions. Results are grouped (Quick Actions → Panels → Shortcuts → Tasks → Projects → Drafts → Snippets) with inline match highlighting and shortcut badges. `↑↓` to navigate, `Enter` to select, `Escape` to close. Quick-add actions dispatch `tyunnie-new-*` custom events (80 ms delay so the target panel has mounted)
- **Shortcut help sheet** (`components/ShortcutHelp.tsx`) — press `?` anywhere (outside an input) to open a grouped keyboard shortcut reference. Auto-detects Mac vs Windows via `navigator.platform` and shows `⌘` or `Ctrl` accordingly. Groups: Navigation, Quick Add, Music, Panels & Overlays, Within a Panel
- **Comprehensive keyboard shortcuts** — all shortcuts use `e.metaKey || e.ctrlKey` for cross-platform support:
  - `Ctrl/⌘+1–9` navigate to all nine panels
  - `Ctrl/⌘+Shift+N/D/P/S` create new task / draft / project / snippet from anywhere
  - `Ctrl/⌘+Shift+F` enter Focus Mode
  - `Ctrl/⌘+Shift+T` toggle Tyunnie chat
  - `Ctrl/⌘+M` toggle music play/pause
  - `N` (panel active, not typing) quick-adds in the current panel
  - `?` opens the shortcut help sheet
- **Panel quick-add events** — `Todo.tsx`, `Writing.tsx`, `Projects.tsx`, and `Snippets.tsx` now listen for `tyunnie-new-task / draft / project / snippet` custom events and immediately focus their respective add-item input or open their form

### Fixed

- **Music skip restores wrong position** — `applyPendingRestore` overwrote `audio.onloadedmetadata` with a closure that kept the saved position. Every subsequent `playTrack` call would trigger that handler and seek to the old timestamp (e.g. 1:26). Fixed by self-clearing the handler after the one-time restore fires, resetting `onloadedmetadata` to the standard `setDuration`-only behaviour

### Changed

- `Desk.tsx` now only renders the hero section + `<DeskWidgets />` — all card, clock, pomodoro, and weather state has moved into `DeskWidgets.tsx`
- All hardcoded `#f97316` orange replaced with `var(--accent)` / `rgba(var(--accent-rgb), ...)` in Focus Mode, Pomodoro timer reset logic, and new widget content
- Pomodoro session dots in `Pomodoro.tsx` now render `settings.longAfter` dots instead of a hardcoded 4; subtitle shows the configured long-break interval
- `Sidebar.tsx` `FOCUS_IDX = 6`, `LOGOUT_IDX = 7` (bumped to make room for the new Focus Mode dock item)

---

## [3.11.0] — 2026-04-16

### Added

- **Account-synced accent color** — user's chosen accent color is now saved to the `profiles.accent_color` column in Supabase and restored on every login, so the color follows the account across devices and browsers
- `accent_color` field added to the `Profile` type in `lib/database.ts`
- `applyAccentColor(hex)` helper in `app/dashboard/page.tsx` — performs full HSL math to set all five CSS custom properties (`--accent`, `--accent-rgb`, `--accent-soft`, `--accent-mid`, `--accent-dim`) and writes to `localStorage`
- Early `useLayoutEffect` in `dashboard/page.tsx` re-applies the saved accent before the first React paint, eliminating the flash-of-orange on hard refresh
- **MiniPlayer redesign** — floating mini player no longer appears immediately on page load. It appears only after the user has played a track and then navigated away from the Music panel. Closing the MiniPlayer pauses the song and dismisses it; pressing play again makes it reappear
- **MiniPlayer navigation** — clicking the album art or track title on both desktop and mobile navigates directly to the Music panel
- **MiniPlayer drag fix** — replaced `setPointerCapture` + JSX `onPointerMove/Up` with document-level `pointermove`/`pointerup` listeners, eliminating the `releasePointerCapture: No active pointer` error
- **Inline orange overrides in `globals.css`** — Tailwind semantic classes (`bg-orange-50`, `hover:bg-orange-50`, `border-orange-200`, `text-orange-500`, `text-orange-600`) now map to accent CSS variables so Tailwind utilities follow the selected accent color without needing inline styles

### Fixed

- `getFinanceEntries error: {}` — missing `account` column in the `finance` Supabase table. SQL migration: `alter table public.finance add column if not exists account text default 'Wallet'`
- **Accent color reverts to orange after full page load** — `profiles.accent_color` column defaulted to `'#f97316'` in the DB, so loading the profile would overwrite a custom color. Fixed by changing the column default to `null` and migrating existing rows: `alter table public.profiles alter column accent_color set default null; update public.profiles set accent_color = null where accent_color = '#f97316'`
- All inline `#f97316` hardcoded orange replaced with `var(--accent)` / `rgba(var(--accent-rgb), ...)` across `FocusMode.tsx`, `Finance.tsx` (Recharts `accentHex` sync via `tyunnie-accent-changed` event), `Music.tsx` range sliders, `Pomodoro.tsx` mode colors, `TicTacToe.tsx` O-piece, `Projects.tsx` Gantt bars, `EntertainmentHub.tsx` / `ProductivityHub.tsx` icon backgrounds

### Changed

- `DATABASE.md` updated — `accent_color` column default documented as `null`; migration SQL added for existing installs

---

## [3.10.1] — 2026-04-15

### Fixed

- Committed `package-lock.json` to sync lockfile with `package.json` v3.10.1

---

## [3.10.0] — 2026-04-15

### Added

- **Floating MiniPlayer** (`components/MiniPlayer.tsx`) — replaces the in-panel mini player in TyunniePanel. Appears as a draggable overlay when music is playing and the user navigates away from the Music panel. Auto-closes 30 seconds after pausing; close button dismisses until next play. Slides in/out with a smooth CSS transition
- **Draggable MiniPlayer** — full drag support via Pointer Events API (`setPointerCapture`) for both mouse and touch. Buttons and the seek range are excluded from drag detection so controls remain usable. Position is clamped to viewport on release. `cursor: grab/grabbing` feedback while dragging
- **Mobile MiniPlayer** — compact single-row pill layout (220×58px) on viewports < 768px: album art, truncated title/artist, play/pause button, close button, and a thin accent progress bar at the bottom edge. No skip buttons or timestamps to keep it minimal
- **Music skip controls** — `−10` / `+10` second skip buttons added to both the full Music player and MiniPlayer. `skipBack(n)` and `skipForward(n)` added to `MusicContext` and its type
- **Music session persistence** — volume, last track index, and playback position saved to `localStorage` across sessions. Volume restored via `useState` lazy init; track/position restored after first playlist load via `pendingRestoreRef` (does not auto-play — requires user interaction). Position persisted every ~5 seconds in `ontimeupdate`
- **Seekable MiniPlayer progress bar** — `<input type="range">` replaces the static display bar, calls `music.handleSeek()` on change

### Changed

- MiniPlayer removed from TyunniePanel chat panel — now lives as a standalone always-visible floating overlay
- Music controls row layout adjusted (`gap-3`) to accommodate skip buttons without overflow

---

## [3.9.1] — 2026-04-14

### Added

- **Auth page redesign** — split layout with branded left panel (accent bubbles, Tyunnie sprite pinned to bottom edge, taglines under subtitle) and clean form on the right. Google button promoted above the email/password form. Full dark mode support
- `lib/tyunniePanelTypes.ts` — standalone shared props type file for `TyunniePanelProps`, extracted from `TyunniePanel.tsx` to avoid Next.js TypeScript plugin interference with named exports from `"use client"` files
- `DEPLOYMENT.md` — env vars, Vercel setup, Google OAuth consent screen fix, Supabase auth config
- `DATABASE.md` — full schema, TypeScript types, SQL setup, RLS policies, indexes, avatar storage, demo mode

### Fixed

- `dynamic<TyunniePanelProps>()` typing — `TyunniePanelProps` moved to `lib/tyunniePanelTypes.ts` so both `tsc` and the IDE language server resolve it correctly
- Implicit `any` on inline callbacks in `dashboard/page.tsx` (`onStickyCleared`, `onMemoryAdded`, `onMemoryDeleted`)
- Auth page sprite aspect ratio warning — intrinsic `width`/`height` now match actual sprite canvas (360×460)
- Stale `.tsbuildinfo` incremental cache cleared

### Changed

- `CLAUDE.md` — leaner: environment variables and schema moved to `DEPLOYMENT.md` and `DATABASE.md`; added Image aspect ratio rule and `tyunniePanelTypes.ts` note to non-obvious rules

---

## [3.9.0] — 2026-04-14

### Added

- **macOS-style dock sidebar** — desktop sidebar replaced with a fixed bottom-center frosted glass pill dock. Items magnify and glow on hover with a spring cubic-bezier easing (1.55× nearest, 1.22× adjacent, 1.08× next) inspired by macOS Dock
- **Tyunnie Panel as bottom-sheet overlay** — TyunniePanel removed from the main layout column and reimplemented as a fixed bottom-center slide-up sheet. Triggered by the new "Tyun 🧡" dock button; always mounted in the DOM so chat history persists across all panel switches
- **Snap-based panel resize** — handle bar at the top of TyunniePanel cycles through snap points on click/tap. Desktop: default (92vh) → wide (96vh, 1080px) → fullscreen (100dvh, 100vw). Mobile: default → fullscreen. Snap indicator dots in the handle bar show the current position. Replaces the old two-column `isExpanded` expanded mode entirely
- **Swipe-up-from-bottom gesture** — swiping up from the bottom 90px of the screen opens TyunniePanel without tapping the dock button (mobile UX)
- **Sticky note button in dock** — "Sticky 📌" button added to the sidebar dock (both desktop and mobile) to spawn a new sticky note directly without entering the panel
- **Mobile dock bar** — mobile gets a full-width frosted glass bottom bar with Tyun 🧡 and Sticky 📌 items alongside the main nav

### Changed

- **Sidebar props extended** — `Sidebar` now accepts `tyunnieOpen`, `onTyunnieToggle`, and `onNewSticky` to wire the dock buttons to panel state in `dashboard/page.tsx`
- **Accent color overrides extended** — `globals.css` now covers sidebar rgba bg classes (`bg-[rgba(249,115,22,0.18)]`, `hover:bg-[rgba(249,115,22,0.12)]`) so the dock active/hover states respect the user-selected accent color
- **Dark mode muted text** — `.dark .text-[#9a8f7e]` brightened to `#b0a090` for legible secondary text in dark mode
- **Main layout** — panel content area is always `flex-1` regardless of chat state; TyunniePanel renders outside the flex container

### Removed

- **isExpanded two-column mode** — the old desktop expanded view (sprite column + chat column side by side) has been removed. The fullscreen snap point serves this purpose instead. Removed `isExpanded` and `onToggleExpand` props from `TyunniePanel`, removed `tyunnieExpanded` state from `dashboard/page.tsx`, and removed the `↗` expand button from the panel header

---

## [3.8.0] — 2026-04-14

### Added

- **User-selectable accent color** — replaced the hardcoded orange theme with a CSS custom property system (`--accent`, `--accent-soft`, `--accent-mid`, `--accent-dim`) driven by user choice. Color persists via `localStorage` (`tyunnie_accent`) and is applied before first paint via an inline script in `app/layout.tsx`
- **Full inline color picker in Profile** — the color wheel button in the accent color section expands an inline picker with: 2D spectrum canvas, hue slider, hex input, RGB inputs, HSL inputs, and a live preview swatch. No external libraries — pure canvas + pointer events

### Changed

- **Sidebar alignment** — desktop nav items are now vertically centered using two `flex-1` spacers sandwiching the nav group; mobile bottom bar items are horizontally centered with `justify-center`

### Fixed

- **Hydration mismatch** — added `suppressHydrationWarning` to `<html>` in `app/layout.tsx` to silence the React hydration warning caused by the accent color inline script mutating `style` before React hydrates

---

## [3.7.0] — 2026-04-13

### Added

- **Sidebar redesign** — collapsed from 10 items to 4: Home, Productivity (⚡), Entertainment (🎮), Me
- **ProductivityHub** (`components/ProductivityHub.tsx`) — card grid linking to Tasks, Writing, Projects, Snippets, Pomodoro, Finance
- **EntertainmentHub** (`components/EntertainmentHub.tsx`) — card grid linking to Music and Games
- `productivity` and `entertainment` added to `Panel` type in `Sidebar.tsx`
- `PANEL_LABELS` updated with hub panel names
- Two new sprites: `tyun-panel-productivity.png`, `tyun-panel-entertainment.png`
- Both hub panels added to `PANEL_SPRITES` map in `TyunniePanel.tsx`
- Tyunnie `navigate` action updated to include all panels including new hubs
- **Tetris** (`components/games/Tetris.tsx`) — full Tetris implementation with all 7 tetrominoes, ghost piece, hold piece, next piece preview, wall kicks, hard drop, soft drop, level system, scoring, pause, mobile swipe + on-screen controls
- Tetris added to Games hub

### Changed

- Sidebar keyboard shortcut `Ctrl+1-4` now maps to Home, Productivity, Entertainment, Me
- Profile `onClose` now returns to `productivity` hub instead of `todo`
- `handleSnippetAdded` still auto-navigates to `snippets` — unchanged since it's still a valid panel
- `handlePomodoroStart` still navigates to `pomodoro` — unchanged
- Removed 3 debug `console.log` calls from `TyunniePanel.tsx` (`Full reply from AI`, `Clean reply from AI`, `Action found`)
- Floating sticky note `+` button is now draggable anywhere on screen like Apple's assistive touch button — starts bottom-right above mobile nav, touch drag supported
- Sticky notes support touch drag on mobile
- Snippets panel mobile layout — horizontal scrollable file strip at top, editor fills screen, terminal appears below
- Hero sprite now visible on mobile (120px, absolute positioned bottom-right of hero card)

---

## [3.6.0] — 2026-04-13

### Added

- **Password Vault website field** — vault entries now support an optional Website URL field, stored encrypted alongside username/password/notes
- Website URL displayed as a clickable `🔗` link on each entry (always visible once vault is unlocked, no need to click Show)
- Website field included in add entry form, edit entry form, and local state on unlock
- `newEntryWebsite` and `editWebsite` state added to Profile component

### Fixed

- **Vault RLS missing UPDATE policy** — Supabase `vault` table had SELECT, INSERT, DELETE policies but no UPDATE policy, causing edits to silently succeed (no error) but affect 0 rows. Added UPDATE policy: `create policy "Users can update own vault" on vault for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)`
- `decrypted` local variable in `handlePinDigit` had narrower type annotation missing `website?` field, causing website to be dropped from state on re-unlock even after being correctly decrypted
- All three entries of the `decryptedEntries` setter (add, edit, unlock) now include `website` in the object

---

## [3.5.0] — 2026-04-10

### Added

- **Chess** — full chess implementation in `components/games/Chess.tsx`
- Complete legal move validation including castling (kingside + queenside), en passant, pawn promotion modal (Queen/Rook/Bishop/Knight)
- Check, checkmate, and stalemate detection
- **3 difficulty levels** — Easy (random moves), Medium (2-ply minimax with 40% random), Hard (3-ply minimax with alpha-beta pruning + piece-square tables for positional evaluation)
- **2-player mode** — pass-and-play on same device
- **vs Tyunnie bot** — play as White or Black; board flips when playing as Black
- **Chess clock** — 8 standard time controls: No Timer, Bullet (1/2 min), Blitz (3/5 min), Rapid (10/15 min), Classical (30 min). Active clock highlighted in orange, red pulse animation when under 10 seconds, timeout triggers game end
- **Captured pieces display** — separate panels showing pieces captured by White and Black
- **Move log** — last 3 moves always visible, "Show all N moves" expander for full scrollable history in algebraic notation with check/checkmate symbols
- Board highlights: selected square (orange), legal move dots, last move highlight, check highlight (red)
- Pawn promotion modal on reaching back rank
- Touch-friendly for mobile — tap to select, tap to move
- Chess added to `Games.tsx` game card grid

### Fixed

- Chess timer — black's clock was not counting down due to missing `thinking` dependency in timer `useEffect` and incorrect bot-thinking guard; both fixed
- White chess pieces now use filled symbols colored white with warm brown stroke for visibility on both light and dark squares

---

## [3.4.0] — 2026-04-10

### Added

- **Persistent Memory** — Tyunnie now remembers facts about you across sessions via a `memories` Supabase table. Memories persist through page refreshes and new sessions
- Tyunnie saves memories when explicitly told ("remember that...", "note that...", "don't forget...") or proactively when important personal facts are revealed in conversation (preferences, schedules, goals, study habits)
- Tyunnie can delete memories on request ("forget that", "remove that memory")
- Memory context injected into every system prompt — Tyunnie reads all stored memories before responding, making him feel genuinely aware of your history
- `Memory` type and `getMemories`, `addMemory`, `deleteMemory` functions added to `lib/database.ts`
- `memories` loaded in `loadAll()` alongside todos, projects, finance, etc.
- `save_memory` and `delete_memory` actions added to Tyunnie's action system with `[id:uuid]` prefix for precise targeting
- `onMemoryAdded` and `onMemoryDeleted` props added to `TyunniePanel`
- `memories` field added to `AppData` type

### Changed

- Memories capped at 40 most recent entries (ordered by `created_at` descending) to keep system prompt token usage manageable

---

## [3.3.0] — 2026-04-09

### Added

- **Focus Mode** — fullscreen minimal overlay for distraction-free work. Triggered via `🎯 Focus Mode` button on the Desk's Focus Timer card or `Ctrl+Shift+F` shortcut
- Focus Mode shows: task selector (pick from pending todos), large Pomodoro timer circle with start/pause/reset/skip controls, mini music player with album art glow and full controls, and existing sticky notes floating on top
- Timer done sound fires on session complete (same C-E-G tone as Pomodoro panel)
- `Esc` or Exit button to leave Focus Mode
- `components/FocusMode.tsx` — new standalone component, `fixed inset-0 z-100` overlay with dark warm aesthetic matching Tyunnie's panel theme
- `Ctrl+Shift+F` added to keyboard shortcuts modal

### Changed

- Focus Timer card on Desk now has two footer links: "Full Pomodoro →" and "🎯 Focus Mode"
- `onFocusMode` prop added to `Desk` component
- `focusMode` boolean state added to `dashboard/page.tsx`

---

## [3.2.0] — 2026-04-09

### Added

- **Sticky notes system** — floating draggable, resizable sticky notes that persist across sessions via Supabase. Spawn with `Ctrl+Shift+K` or the `+` button. Five color themes (yellow, blue, green, pink, purple). Drag by header, resize from bottom-right corner. Debounced autosave on content change, position and size saved on drag/resize end
- `sticky_notes` Supabase table with RLS — stores content, position (x/y), size (w/h), color, and user_id
- `getStickyNotes`, `createStickyNote`, `updateStickyNote`, `deleteStickyNote` added to `lib/database.ts`
- `StickyNote` type exported from `lib/database.ts`
- `components/StickyNote.tsx` — individual sticky note component with drag, resize, color picker, and debounced content save
- `components/StickyLayer.tsx` — manages all sticky notes, renders above all panels via `fixed` positioning, handles `Ctrl+Shift+K` keyboard shortcut
- Sticky notes wired into `TyunniePanel` — Tyunnie can read all sticky note content via system prompt context
- **Tyunnie sticky actions** — `clear_sticky` (wipe content), `edit_sticky` (replace content with new text) actions added to Tyunnie's action system
- **Tyunnie todo actions** — `complete_todo` marks a task as done directly from chat using the task's UUID from system prompt context
- **Tyunnie project actions** — `update_project` sets progress percentage and optionally updates status from chat
- **Tyunnie Pomodoro action** — `start_pomodoro` navigates to Pomodoro panel, fuzzy-matches a task by name and pre-selects it, then auto-starts the timer via `sessionStorage` flag
- `completeTodo` and `updateProjectProgress` added to `lib/database.ts`
- Task and project IDs now exposed in Tyunnie's system prompt (`[id:uuid]` prefix) so Tyunnie can reference them precisely in actions
- `Ctrl+Shift+K` shortcut documented in the keyboard shortcuts modal
- Pomodoro done sound — three ascending sine tones (C5→E5→G5) generated via Web Audio API, fires when timer hits zero
- `initialTask` prop on `Pomodoro` component — fuzzy-matches task name against pending todos on mount
- `pomodoroKey` state in dashboard forces full Pomodoro remount on each Tyunnie-triggered session to guarantee clean autostart

### Fixed

- Sticky note textarea jitter — `useEffect` syncing `note.content` prop to local state now guarded by `isTypingRef` so prop updates from debounced saves don't reset mid-type content
- `clear_sticky` AI confusion — model was passing color instead of UUID; system prompt updated with `[id:uuid]` prefix and explicit rule to use id not color
- Groq model appending `%` or other trailing garbage to action JSON — `executeAction` now strips all non-`}` characters after the last `}` before parsing
- Malformed `<action(...)` tag variant normalised in response processing
- Pomodoro autostart race condition — switched from prop-based `autoStart` to `sessionStorage` flag (`pomodoro_autostart`) consumed on mount, eliminating async timing issues
- `update_project` TypeScript error — `status` cast as `Project["status"]` to satisfy union type constraint
- Duplicate `}: Props) {` parse errors in `TyunniePanel.tsx` from multiple edit sessions

### Changed

- `PANEL_SPRITES` map updated with `desk` and `profile` entries (`tyun-panel-desk.png`, `tyun-panel-profile.png`)
- `navigate` action panel list updated to include `"desk"` and `"profile"`
- `activePanel` default changed from `"calendar"` to `"desk"` in TyunniePanel
- Daily briefing early-return data guard (`todos.length === 0 && finance.length === 0`) removed — briefing now always fires on first load regardless of data state
- Pending todo list and project list in system prompt now include `[id:uuid]` prefix for each item
- Pomodoro `key` prop set to `pomodoroKey` counter in dashboard — increments on each Tyunnie-triggered session, guarantees remount without ever resetting to a stale value

---

## [3.1.2] — 2026-04-09

### Fixed

- Root redirect was pointing to `/chat` instead of `/dashboard` in `next.config.ts` — this was the actual source of the startup 404, not `app/page.tsx` which was already correct. Updated `destination` from `/chat` to `/dashboard`

### Added

- `DEVNOTES.md` — developer reference document added to repo root. Covers known gotchas, non-obvious decisions, and recurring issues including the `next.config.ts` routing trap, Supabase session corruption, Speech API type failures, sessionStorage guard pattern, audio reactivity DOM pattern, sprite path conventions, and environment variable history

---

## [3.1.1] - 2026-04-09

### Fixed

- Rerouting `/` to `/dashboard` in `app/page.tsx` to avoid 404

---

## [3.1.0] — 2026-04-09

### Added

- **Real-time clock widget** on Tyunnie's Desk — displays live hours, minutes, and seconds (`HH:MM:SS`), day of week, and date. Updates every second via `setInterval` in a `useEffect`
- **Weather widget on Desk** (`DeskWeather`) — inline component in `Desk.tsx` that pulls from Open-Meteo using the saved `tyunnie_city` from localStorage. Shows temperature, condition label, and weather emoji. Falls back gracefully to "No city set" if no city is configured
- Clock and weather widgets displayed side-by-side in a `grid-cols-2` row below the Tyunnie quote card on the Desk
- **Quick add a task** moved inside the Recent Activity card as a pinned bottom action, separated by a divider line
- Recent Activity capped at 3 items on the Desk for a cleaner, less cluttered layout

### Removed

- `app/demo/` — demo route deleted. No longer needed for a personal app
- `app/chat/` — standalone chat route deleted. Chat is fully integrated into the dashboard via TyunniePanel
- `app/chat-demo/` — chat demo route deleted alongside demo removal

---

## [3.0.3] — 2026-04-08

### Fixed

- Replaced entire `lib/useSpeech.ts` with fully `any`-typed Speech API implementation — `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`, and the recognition ref are all typed as `any` to prevent TypeScript production build failures on Vercel. The Web Speech API has no stable cross-environment type definitions and fighting the type system here is not worth it.

---

## [3.0.2] — 2026-04-08

### Fixed

- `SpeechRecognitionErrorEvent` type error in `lib/useSpeech.ts` causing production build failure — same root cause as 3.0.1, remaining Speech API type annotation replaced with `any`

---

## [3.0.1] — 2026-04-08

### Fixed

- `SpeechRecognitionEvent` type error in `lib/useSpeech.ts` causing production build failure on Vercel — replaced explicit type annotation with `any` since `SpeechRecognitionEvent` is a browser-only type that TypeScript's production compiler cannot resolve even with `global.d.ts` declarations

---

## [3.0.0] — 2026-04-08

### Added

- **Tyunnie's Desk** (`components/Desk.tsx`) — new landing panel that replaces the calendar as the home screen. A full personal dashboard with hero greeting, 4 quick-stat cards, recent activity timeline, and Tyunnie's quote corner
- **Hero section** — personalized greeting with time-of-day awareness, date, "Welcome home" tagline, and Taehyun upper-torso sprite flush at the bottom-right of the card
- **Today's Focus card** — shows top 3 upcoming tasks sorted by due date, inline mark-as-done buttons with overdue/due-today indicators
- **Life Progress card** — dual circular progress rings for task completion % and average project progress, plus current month's net balance
- **Focus Timer card** — inline Pomodoro mini-timer (25/5 cycle) with circular progress, start/pause/reset, and a "Full Pomodoro →" link. Runs independently on the Desk without navigating away
- **Now Playing card** — music player card with album art (glow effect when playing), track info, progress bar, and playback controls
- **Recent Activity timeline** — vertical timeline showing latest completed tasks and finance entries with connector lines
- **Quick add a task** — dashed capture button at the bottom of the activity section
- **Tyunnie's Corner** — dark warm card with AI-generated daily quote centered and displayed in large serif italic text
- **Quick Navigation grid** — 2×3 icon grid for Write, Finance, Snips, Projects, Games, Profile
- **AI one-liner** — fresh motivational sentence generated by Groq on each visit, cached in `sessionStorage("desk_oneliner")` for the tab session so it doesn't regenerate on panel switches
- `"desk"` added to `Panel` type, `PANEL_LABELS`, `NAV_ITEMS` (🏠 Home), and keyboard shortcut `Ctrl/⌘+1`
- `handleTodoToggle` in `dashboard/page.tsx` — toggles task done state from the Desk without opening the Tasks panel
- Voice input (`lib/useSpeech.ts`) — Web Speech API hook with `SpeechRecognition` type declarations in `global.d.ts`. Mic button in TyunniePanel textarea row, pulses red when listening, drops transcript into input on speech end

### Changed

- **Calendar panel removed** — replaced by Tyunnie's Desk as the home panel. Supabase `events` table retained for system context; `Calendar.tsx` component, all imports, gcal props, and event state removed from dashboard
- **Default panel changed** from `"calendar"` to `"desk"`
- **Google Calendar integration removed** — `lib/googleCalendar.ts`, `app/api/gcal-connect/route.ts`, `app/api/gcal-callback/route.ts` deleted. `google_tokens` table no longer used. Removed all gcal state, sync functions, token capture from `onAuthStateChange`, and Calendar props from dashboard
- **Demo page disabled** — `app/demo/page.tsx` now redirects to `/auth`
- **Auth timeout safety net** added — 15-second timeout guard in the auth `useEffect` prevents infinite loading screen on slow Supabase responses
- **Daily briefing and desk one-liner** now use `sessionStorage` keys (`tyunnie_briefing`, `desk_oneliner`) instead of `useRef` guards — survives panel switches without re-firing, regenerates on new tab or hard refresh
- **Topbar** — panel badge updated to show "Home" when on Desk
- **Keyboard shortcuts** — panel array updated, `Ctrl/⌘+1` now maps to Desk instead of Calendar, all subsequent panels shifted

### Fixed

- `onDesk` constant was accidentally declared inside the loading screen early return — moved to after `if (!user) return null` so it's available in the main render
- `tyunnieExpanded` initial state corrected to `false` — was briefly set to `true` causing Tyunnie to cover the Desk on load
- Briefing `useEffect` had `setBriefing` and `sessionStorage.setItem` placed outside the `fetchBriefing` async function — moved inside the `try` block
- `onDesk` sidebar/Tyunnie panel visibility logic reverted — sidebar and Tyunnie panel now always visible regardless of active panel, consistent with all other panels
- `"Event"` type removed from search results grouping array after events data was removed
- Profile `onClose` callback updated from `setActivePanel("calendar")` to `setActivePanel("todo")` after calendar panel removal

---

## [2.6.0] — 2026-04-08

### Added

- **Keyboard shortcuts panel** — press `?` anywhere (outside input fields) to open a shortcuts reference modal. Also accessible via the `?` button in the topbar
- Panel switching via `Ctrl/⌘ + 1–9` — maps to Calendar, Tasks, Writing, Projects, Snippets, Finance, Music, Pomodoro, Games in order
- `Ctrl/⌘ + P` — jump to Profile panel
- `Ctrl/⌘ + /` — toggle Tyunnie chat expand/collapse
- `Ctrl/⌘ + K` — global search (existing, now documented in shortcuts panel)
- `Esc` — closes any open modal (existing, now documented)
- Shortcuts panel grouped into Navigation, Search, and General sections. Shows both `⌘` and `Ctrl` for cross-platform clarity

### Changed

- **Topbar refactor** — search bar now absolutely centered using `absolute left-1/2 -translate-x-1/2`, guaranteed to sit at the exact midpoint regardless of left/right content width
- `?` shortcuts button, Weather widget, and date moved into a single right-side group using `ml-auto` to preserve search centering
- "Chat →" expand button removed from topbar — Tyunnie panel toggling now handled via `Ctrl/⌘ + /` shortcut
- **Tyunnie logo in topbar is now clickable** — calls `router.refresh()` to reload app data, styled with hover orange transition
- **Demo topbar synced** — matches dashboard layout with centered search bar (shown as a disabled "not available in demo" label), clickable Tyunnie logo, and Chat button removed
- **`not-found.tsx` and `error.tsx` sprite fixed** — sprite `src` was incorrectly set to `/public/sprites/...`, corrected to `/sprites/...` so Next.js resolves the path from the `public/` root correctly

---

## [2.5.1] — 2026-04-07

### Fixed

- Corrected MP3 filenames in `public/music/playlist.json` — file paths were mismatched with actual filenames on disk, causing tracks to 404 and fail to play

---

## [2.5.0] — 2026-04-07

### Added

- **User avatar upload** — profile panel now supports real photo uploads with a crop/adjust modal. Drag to reposition, zoom slider to scale, circular preview before saving
- Avatar stored in Supabase Storage (`avatars` bucket) as `avatars/{userId}.png`, public URL saved to `profiles.avatar_url`
- Cache-busting via `?t=timestamp` on upload so the new photo appears immediately without a refresh
- **Avatar in sidebar** — both desktop and mobile nav profile button now renders the actual avatar photo if set, with an orange `ring-2` when active. Falls back to initials circle if no photo uploaded
- Hover overlay on avatar in Profile panel — 📷 to upload a new photo, 🗑 to delete and revert to initials placeholder
- `avatar_url` field added to `Profile` type in `lib/database.ts`

### Changed

- **Music player glow overhaul** — album art glow now reacts to the actual audio waveform in real time using Web Audio API `AnalyserNode`. Glow size and opacity pulse with the bass frequencies of the current track
- Glow drives the DOM directly via `ref` instead of React state — zero re-render overhead, instant per-frame response on every beat
- Removed vinyl spin animation from album art — cover stays static, glow does the visual work
- `analyser` ref exposed via `MusicContext` so `Music.tsx` can read frequency data without owning the audio element

### Fixed

- `handleCropSave` and `handleDeleteAvatar` now call `onSave(updatedProfile)` after upserting — sidebar avatar updates immediately without requiring a page refresh
- `avatarUrl` tracked as independent state in `dashboard/page.tsx` so sidebar reflects changes the moment `onSave` fires
- `togglePlay` in `MusicContext` marked `async` to allow `await audioCtxRef.current.resume()` — was previously causing a syntax error
- Supabase client in Profile avatar functions replaced with the shared singleton from `@/lib/supabase` instead of a dynamically imported new instance

---

## [2.4.0] — 2026-04-06

### Added

- **User Profile panel** (`components/Profile.tsx`) — full profile management stored in Supabase `profiles` table
- Fields: display name, birth day/month (birthday detected by Tyunnie on the day), city (synced with weather widget), occupation, workplace, bio, interests (15 tag options)
- Preferences: greeting style (casual/formal), currency, locale, theme toggle, daily briefing toggle
- Profile migrates existing `tyunnie_username`, `tyunnie_city`, and `tyunnie_theme` localStorage keys on first load
- `getProfile` and `upsertProfile` functions added to `lib/database.ts` with `"demo-user"` early return guard
- **Initials avatar in Sidebar** — profile nav item now shows a generated initials circle instead of the 👤 emoji. Orange when active, muted dark when inactive. Updates live as display name changes
- **Avatar preview in Profile panel** — large orange initials circle at the top of the identity section, updates as you type
- `userName` prop added to `Sidebar` so initials are generated from the actual display name
- **Tyunnie profile context in system prompt** — full profile block injected including name, occupation, workplace, city, bio, interests, greeting style, currency, and birthday detection (`🎂 TODAY IS THEIR BIRTHDAY` flag)
- Greeting style now switches Tyunnie's tone — `formal` triggers "supportive and professional" framing vs default casual
- Album covers are added into the Music panel

### Changed

- Topbar simplified — name input and dark mode toggle removed from topbar, both now managed exclusively via the Profile panel. Search bar centred with two `flex-1` dividers. Width responsive: `w-48` → `w-64` → `w-80` across md/lg/xl breakpoints
- Dark mode toggle moved to Profile panel under Preferences section
- `profile` prop added to `TyunniePanel` — receives `ProfileType | null` from dashboard, no longer needs to fetch profile itself
- Daily briefing visibility now gated on `profile?.show_briefing !== false` — defaults to showing when no profile exists
- Demo page updated — sidebar receives `userName="Demo"` for initials display, profile panel shows a signup nudge instead of crashing

### Fixed

- Duplicate profile buttons removed from Sidebar — profile was appearing twice (once in `NAV_ITEMS` loop and once as a standalone button)
- `isDark` and `toggleTheme` were accidentally declared outside `DemoPage` component — moved inside
- `today` variable declared twice in `buildSystemPrompt()` — duplicate removed
- Unused `getProfile` import removed from `TyunniePanel.tsx` — profile is now passed as a prop

---

## [2.3.0] — 2026-04-03

### Added

- **Weather widget** (`components/Weather.tsx`) — city-based weather display in the topbar using Open-Meteo API. No location permission required — user types a city name, it geocodes and saves to `localStorage`. Persists across sessions until changed. Shows temperature, weather icon, and condition label. Click the widget anytime to change city. Hidden on mobile, visible on desktop only

---

## [2.2.0] — 2026-04-02

### Added

- **Dark mode toggle** — 🌙/☀️ button in the topbar toggles the whole app between light and dark. Preference saved to `localStorage` and applied before first paint via an inline script in `layout.tsx` to prevent flash. CSS class overrides in `globals.css` using `.dark` selector on all major background, border, and text colors
- **Confetti on task completion** — `canvas-confetti` burst fires in Tyunnie's orange palette when a task is marked as done in the Tasks panel
- **Username input** — name field in the topbar persists to `localStorage`. Tyunnie receives the name in the system prompt and uses it naturally in conversation without repeating it every message

### Changed

- **Sprite system overhaul** — separated panel sprites and mood sprites into two distinct naming conventions (`tyun-panel-*.png` and `tyun-mood-*.png`) to eliminate overlap where the same image was used for both a tab context and an emotional reaction
- Panel sprites now cover all 9 panels including Pomodoro and Games which previously fell back to default
- Mood sprites (default, happy, concerned, celebrating, thinking) are now independent from panel sprites — switching panels no longer disrupts an active mood sprite
- New sprite files added to `public/sprites/` for the new naming convention
- Tyunnie system prompt updated — casual greetings (hey, yo, sup) now get casual conversational responses instead of data dumps
- Tyunnie no longer volunteers balance, income, or expenses unless explicitly asked about money
- Tyunnie no longer auto-navigates to panels based on context — navigation only happens when explicitly requested by the user

### Fixed

- Gantt chart date labels overlapping — ticks closer than 8% of chart width are now skipped
- Year suffix now only shown on first tick and when the year changes, reducing label noise
- Labels use `whitespace-nowrap` to prevent mid-label line breaks

---

## [2.1.1] — 2026-04-02

### Fixed

- Gantt chart x-axis month labels overlapping when project spans multiple months in a short date range

---

## [2.1.0] — 2026-04-02

### Changed

- Moved project from `tyunnie-pa/tyunnie/` subdirectory to repo root `tyunnie-pa/` — cleaner repo structure
- Updated Vercel Root Directory setting from `tyunnie` to repo root
- Removed stale `.next/dev/types` include from `tsconfig.json` that caused TypeScript errors after the move

### Added

- App icon added across all required sizes (1024×1024, 512×512, 192×192, 180×180, 32×32)
- Icon metadata configured in `app/layout.tsx` under the `icons` field

---

## [2.0.0] — 2026-04-02

### Added

- **Games Hub** — new Games panel (`components/Games.tsx`) with a card-based game selector
- **Tic Tac Toe** (`components/games/TicTacToe.tsx`) — play against Tyunnie bot using minimax algorithm. Three difficulty levels: Easy (random moves), Medium (25% mistake chance), Hard (perfect play). Score tracker across rounds. Tyunnie has in-character quips on win, lose, and draw
- **Sudoku** (`components/games/Sudoku.tsx`) — pre-made puzzles across Easy, Medium, Hard. 3-mistake limit shown as ✕ dots. Notes mode for pencil marks. Timer starts on first cell input, not on load. Full cell highlighting for row, column, box, and same-number detection. Number pad and keyboard input supported
- **Minesweeper** (`components/games/Minesweeper.tsx`) — 8×8 / 10×10 / 12×12 grids depending on difficulty. First click always guaranteed safe via deferred mine placement. Flood-fill reveal for empty cells. Right-click to flag. Chord support — clicking a revealed number auto-reveals neighbours when flagged count matches. Timer starts on first reveal
- **Solitaire** (`components/games/Solitaire.tsx`) — Klondike solitaire. Draw from stock pile, move cards between tableau columns and to foundations. Click to select, click destination to place. Full move validation (alternating colour, descending value for tableau; same suit, ascending for foundation). Win detection with Tyunnie quip
- **Pomodoro Timer** (`components/Pomodoro.tsx`) — 25-minute focus sessions with 5-minute short breaks and 15-minute long breaks. Auto-advances through cycles — every 4 sessions triggers a long break. Session dot tracker (4 dots). Timer starts only on first number input, not on load. Link a pending task to current focus session from a dropdown. Color-coded modes: orange (focus), green (short break), blue (long break)
- **Global search upgraded** — search now detects panel shortcuts by keyword including all game names (sudoku, minesweeper, solitaire, tictactoe), pomodoro, focus, games, and all existing data panels. Results grouped with Panel type appearing first
- `"games"` and `"pomodoro"` added to the `Panel` type in `Sidebar.tsx`
- Both panels added to `PANEL_LABELS`, `NAV_ITEMS`, and the panel render section in `dashboard/page.tsx` and `demo/page.tsx`

### Changed

- **Scrollable mobile nav** — bottom tab bar now uses `overflow-x-auto` with fixed `w-16` per item instead of `flex-1`, preventing squishing with 9+ panels. Users swipe horizontally to access all panels
- Tyunnie system prompt updated — casual greetings (hey, yo, sup) now get casual conversational responses instead of data dumps
- Tyunnie no longer volunteers balance, income, or expenses unless explicitly asked about money
- Tyunnie no longer auto-navigates to panels based on context — navigation only happens when explicitly requested by the user

---

## [1.3.1] — 2026-03-30

### Changed

- Removed global `dataLoading` spinner — panels now render immediately on mount without waiting for all data to load
- `getFinanceEntries` query scoped to last 12 months instead of all-time, reducing payload size significantly

### Added

- Supabase database indexes on all major query columns for faster lookups:
  ```sql
  events(user_id, date)
  todos(user_id, done)
  finance(user_id, date)
  snips(user_id, created_at)
  drafts(user_id, created_at)
  projects(user_id, created_at)
  ```

### Fixed

- Vercel Real Experience Score on `/dashboard` improved after query and render optimisations
- `dataLoading` state removed after spinner was eliminated — cleanup of unused state variable

---

## [1.3.0] — 2026-03-28

### Changed

- **Mobile Tyunnie panel overhaul** — full redesign of mobile layout
- Sprite now uses `absolute` positioning on mobile so it floats in the background without pushing chat bubbles or the input box
- Chat input always visible above the bottom tab bar using `mb-16 md:mb-0`
- Expand mode restricted to desktop only — mobile never triggers the expanded layout
- Removed duplicate ✕ close buttons — only one close button remains, in the dashboard wrapper
- Briefing card changed to full-width on mobile (`w-full` instead of `max-w-52.5`)
- Chat bubbles positioned with a fixed spacer (`h-32 md:flex-1`) so they start mid-screen above the sprite rather than pinned to the very bottom

### Added

- **Carried balance** — Finance tracker now carries the net balance from all previous months into the current month view, displayed as a separate "carried · this month" breakdown in the balance card

### Fixed

- Expand button now hidden on mobile (`hidden md:flex`) — was incorrectly triggering expanded layout on small screens
- Image aspect ratio warnings resolved by adding explicit `width` and `height` style props alongside Next.js Image `width`/`height` attributes
- Sprite glow filter restored after being lost during previous aspect ratio fix

---

## [1.2.0] — 2026-03-26

### Added

- **Finance account tagging** — each finance entry can now be tagged to an account: Maybank, MAE, Grab, GXBank, TnG, Wallet, ASB
- Account balance pills on the Finance page showing net balance per account at a glance
- Filter entries by account in the Tracker view
- **By Account analytics section** — income and expense breakdown per account in the Analytics tab
- Coloured dot badge per account on each entry row
- `account` column added to the `finance` Supabase table (`alter table finance add column account text default 'Wallet'`)

---

## [1.1.0] — 2026-03-24

### Added

- **Expandable Tyunnie panel** — desktop only. Click Chat → in the topbar to expand Tyunnie into a full-width view with a larger sprite column on the left and full chat on the right. Click ✕ to collapse back
- **Daily briefing card** — generated once on mount after app data loads. Pinned above chat history. 1-2 sentence personalised summary based on today's events, tasks, balance, and time of day. Uses a `briefingFiredRef` guard to prevent re-firing on re-renders
- **Global search** (`Cmd+K` / `Ctrl+K`) — modal search across all data types: events, tasks, drafts, projects, snippets, finance entries. Keyword highlighting, grouped by type, click to navigate to panel
- `sessionStorage` flag (`visitedDashboard`) set on dashboard mount for conditional refresh logic across page transitions
- Auto-refresh briefing on return from dashboard using the `sessionStorage` flag

### Changed

- Chat page (`/chat`) merged into dashboard — `app/chat/page.tsx` now redirects to `/dashboard`
- `app/chat-demo/page.tsx` redirects to `/demo`
- `app/page.tsx` redirects to `/dashboard`
- TyunniePanel is now the single chat interface — no standalone chat page

### Fixed

- `setState` called synchronously inside `useEffect` — fixed by extracting async functions inside effects
- `activePanel` initialised from URL `?panel=` query parameter using a lazy `useState` initialiser instead of a `useEffect` setter, eliminating the ESLint cascading render warning

---

## [1.0.0] — 2026-03-20

### Added

Initial release of Tyunnie — a full-stack personal productivity assistant web app.

**Core panels:**

- **Calendar** — Month, Week, 3-Day, and Year views. Add and delete events. Upcoming events list
- **Tasks** — Add tasks with tags (CS, Writing, Personal, Other), due dates, and mark as done
- **Writing** — Draft editor with word count, create/edit/delete drafts
- **Projects** — Project cards with status (Planning, Active, Paused, Done), progress bars, Gantt chart for date-ranged projects, inline progress slider
- **Snippets** — Code editor with line numbers, Tab indentation, Cmd+S to save, live code execution via JDoodle API (Python, JS, TS, Bash), terminal output panel
- **Finance** — Monthly income and expense tracking, navigate between months, category tagging, Analytics tab with 6-month bar chart, spending donut, and 50/30/20 rule tracker
- **Music** — Upload MP3s to `public/music/`, play/pause/skip/previous, shuffle, repeat modes (none/all/one), seekable progress bar, volume control, album art with spin animation, persistent playback across panel switches

**Tyunnie AI Panel:**

- Context-aware assistant powered by Groq API (Llama 3.3 70B)
- Reads all app data (events, todos, drafts, projects, snippets, finance) and includes it in the system prompt
- Can add events (with confirmation), tasks, drafts, projects, finance entries, and code snippets via natural language
- Action block parsing — AI responses include structured `<action>` blocks that are executed client-side after stripping from visible chat
- **Sprite system** — 10 named PNG sprites in `public/sprites/` mapped to panels and moods. Mood override with 4-second reset back to panel sprite
- Mini music player embedded in the Tyunnie panel with progress bar and controls
- Greeting bubble on first load from a pool of randomised messages

**Auth:**

- Email/password sign up and login via Supabase Auth
- Google OAuth one-click sign in
- Auto session refresh and redirect to `/auth` on expiry or sign out

**Infrastructure:**

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Supabase PostgreSQL backend with RLS enabled on all tables
- Deployed on Vercel with Vercel Analytics and Speed Insights
- Demo mode at `/demo` — no auth required, uses `"demo-user"` guard in `database.ts` to return empty data and suppress Supabase errors
- Fonts: Instrument Serif (`font-serif`), Nunito (`font-sans`), Geist Mono (`font-mono`) via `next/font/google`
- Mobile responsive layout with bottom tab bar navigation
