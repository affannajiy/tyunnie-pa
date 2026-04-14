# Changelog

All notable changes to Tyunnie are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
