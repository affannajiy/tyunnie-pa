# Changelog

All notable changes to Tyunnie are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
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
