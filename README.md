# Tyunnie — Your Personal AI Assistant

> A full-stack personal assistant web app inspired by Taehyun from TXT. Built with Next.js, Supabase, and Groq AI.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)
![Version](https://img.shields.io/badge/version-3.17.1-f97316?style=flat-square)

---

## Features

### Tyunnie AI Panel

- Context-aware assistant powered by **Groq (Llama 3.3 70B)**
- Knows your tasks, drafts, projects, finances, snippets, sticky notes, and memories
- Natural language actions: add/delete tasks, create drafts, log finance (with account tagging), run snippets, start Pomodoro, toggle theme, enter focus mode, control music (play/pause/next/volume), **calculate** (evaluates math and sends the expression to the Calculator panel)
- **Live workspace awareness** — Tyunnie reads the content you're actively editing (code, draft, or task list) and injects it into every chat request; ask "what does this do?" or "fix this bug" without pasting anything
- **Proactive suggestions** — after 4 seconds of editing, Tyunnie silently analyses your active workspace and surfaces a non-intrusive tip (bug catch for code, quiz questions for writing, focus nudge for tasks) as a dismissable card with a "Use this →" pre-fill shortcut
- **Daily briefing** — personalised 1-2 sentence summary on load, togglable from profile
- **Detachable floating window** — "Float panel" button (desktop) converts the bottom-sheet into a free-floating, draggable 400×560px window; position persists across page loads. Snap-back button returns to the sheet
- **Bottom-sheet overlay** — slides up from the dock; chat history persists across all tab switches
- **Snap resize** — cycle through snap sizes (default → wide → fullscreen on desktop; fullscreen-only on mobile)
- **Swipe-up gesture** — swipe from the bottom edge to open on mobile
- **Persistent memory** — remembers facts about you across sessions

### Desk (Home)

- Time-aware greeting with Taehyun hero sprite and animated accent bubbles
- **Widget grid** — 8 draggable, resizable widgets: Today's Focus, Life Progress, Focus Timer, Now Playing, Recent Activity, Tyunnie Says, Clock, Weather
- Edit mode: grab handles, resize corners, remove/add widgets, wiggle animation, column guides
- **Layout persisted to Supabase** — widget positions/sizes sync across all devices on login; `localStorage` used as instant-read cache
- **Collision avoidance** — widgets push down automatically on drag/resize; nothing overlaps (Apple-style repositioning)
- **Layout templates** — Dashboard, Focus, Minimal, Finance presets accessible via the Templates button in edit mode
- Mobile: 2-column responsive grid, no drag/resize required

### Tasks, Writing, Projects, Snippets

- Tasks with tags (CS / Writing / Personal / Other), due dates, confetti on completion
- Draft editor with word count
- Project tracker with status, progress bars, Gantt chart
- Code editor with live execution via JDoodle (Python, JS, TS, Bash)

### Finance

- Monthly income/expense tracking with account tags
- Recharts analytics, 50/30/20 rule breakdown, balance carry-forward

### Music Player

- Upload MP3s + album art, full playback controls, Web Audio visualizer, persistent across panels

### Pomodoro + Focus Mode

- **Adjustable timer** — configurable focus, short break, and long break durations with four presets: Classic (25/5/15), Extended (50/10/30), Short Sprint (15/3/10), Deep Work (90/15/30). Settings sync across the full panel, desk widget, and Focus Mode
- Session dot tracker scales with the configured long-break interval
- **Focus Mode** (`Ctrl/⌘+Shift+F` or Sidebar dock button) — fullscreen overlay with music-reactive background glow (Web Audio beat detection drives the radial gradient in real time), preset picker, task selector, full Pomodoro controls, and floating sticky notes

### Calculator Hub

Four-mode calculator accessible from the Productivity hub — switch modes via a scrollable tab bar:

- **Scientific** — Casio fx-570EX–style; full trig (sin/cos/tan + inverses), hyperbolic, log/ln, powers, roots, combinatorics (nCr, nPr, n!), absolute value, constants (π, ℯ), memory (MC/MR/M+/M−); SHIFT key unlocks secondary functions; DEG/RAD toggle, live expression preview, ANS and Mem references, keyboard input
- **Graphing** — canvas-based 2D plotter; type expressions like `sin(x)`, `x^2 + 1`; drag to pan, zoom in/out; up to 5 functions plotted simultaneously in distinct colours
- **Converter** — 7 categories: Length, Weight, Temperature, Area, Volume, Speed, Currency; live exchange rates via Frankfurter API (USD base, cached hourly); swap button flips units
- **Date** — Duration mode (difference between two dates in years/months/days) and Add/Subtract mode (start date ± days/months/years)

All modes follow the app's light/dark theme and chosen accent colour.

### Games Hub

- Tetris, Chess (3 difficulties, 8 time controls), Sudoku, Minesweeper, Solitaire, Tic Tac Toe

### Navigation Dock

- **Desktop** — fixed bottom-center frosted glass pill with macOS-style magnification
- **Mobile** — full-width bottom bar
- Items: Home, Productivity, Entertainment, Profile, Tyun (chat), Sticky (new note), Focus Mode 🎯, Sign Out

### Profile + Vault

- Display name, avatar, city, occupation, interests, locale, currency
- Full accent color picker (spectrum canvas, hue slider, hex/RGB/HSL inputs)
- **Password Vault** — AES-GCM 256-bit encrypted, PIN-protected, auto-locks after 30s

### Keyboard Shortcuts & Command Palette

- **`Ctrl/⌘+K`** — command palette: search panels, tasks, projects, drafts, snippets, and shortcuts. Results grouped with inline match highlighting and shortcut badges. `↑↓/Enter/Esc` keyboard navigation
- **`Ctrl/⌘+1–9`** — jump to any panel instantly
- **`Ctrl/⌘+Shift+N/D/P/S`** — new task / draft / project / snippet from anywhere; focuses the add form in the target panel
- **`Ctrl/⌘+Shift+F`** — Focus Mode · **`Ctrl/⌘+Shift+T`** — Tyunnie chat · **`Ctrl/⌘+M`** — play/pause music
- **`N`** — new item in current panel (when not typing) · **`?`** — shortcut reference sheet
- All shortcuts show both Windows (`Ctrl`) and Mac (`⌘`) in the help sheet

### Other

- Draggable/resizable sticky notes, persisted to Supabase
- City-based weather (Open-Meteo, no API key needed)
- Dark / light mode, user-selectable accent color (synced to account via Supabase)
- **MiniPlayer** — floating draggable overlay appears when music is playing outside the Music panel; click art/title to navigate to the player
- **Fluid animations** — spring-based panel entrance, modal scale-in, backdrop fade, and dock/tab active-dot pop throughout the app
- **Mobile pull-to-refresh** — swipe down at scroll top to reload all data; horizontal swipe to navigate between Home, Productivity, and Entertainment

### Performance

- **Parallel data loading** — profile, tasks, drafts, projects, snippets, finance, sticky notes, and memories all fetched in a single `Promise.all` on login; no sequential waterfalls
- **Lazy panel loading with skeletons** — each panel chunk downloads only on first visit; pulsing skeleton shown while the chunk loads so the UI is never blank
- **Immutable static asset cache** — hashed JS/CSS chunks cached for 1 year; public images cached 1 day with stale-while-revalidate
- **Bundle tree-shaking** — `recharts` and `date-fns` tree-shaken via `optimizePackageImports`; only imported symbols included in the final bundle
- **Preconnect hints** — Supabase, Groq, and Open-Meteo DNS + TLS resolved before first request fires
- **No `X-Powered-By` header** — reduces response size and hides tech fingerprint

---

## Tech Stack

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| Framework       | Next.js 16 (App Router)                |
| Language        | TypeScript 5                           |
| Styling         | Tailwind CSS v4                        |
| Database / Auth | Supabase (PostgreSQL + Auth)           |
| AI              | Groq API (Llama 3.3 70B)               |
| Code Execution  | JDoodle API                            |
| Charts          | Recharts 3                             |
| Weather         | Open-Meteo API (free, no key)          |
| Fonts           | Instrument Serif + Nunito + Geist Mono |
| Deployment      | Vercel                                 |

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/affannajiy/tyunnie-pa.git
cd tyunnie-pa
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in the values — see [DEPLOYMENT.md](./DEPLOYMENT.md) for the full variable list.

### 3. Set up Supabase

Create tables, enable RLS, add indexes — see [DATABASE.md](./DATABASE.md) for the complete SQL.

### 4. Add sprites (optional)

Place transparent PNGs in `public/sprites/`. Canvas size: **360×460px** for panel/mood sprites, **560×720px** for the hero.

- Panel sprites: `tyun-panel-{desk,profile,todo,writing,projects,snippets,finance,music,pomodoro,games,productivity,entertainment}.png`
- Mood sprites: `tyun-mood-{default,happy,concerned,celebrating,thinking}.png`

### 5. Add music (optional)

Place MP3s + cover art in `public/music/` with a `playlist.json`:

```json
[
  {
    "title": "Song",
    "artist": "Artist",
    "file": "/music/song.mp3",
    "cover": "/music/cover.jpg"
  }
]
```

### 6. Run

```bash
npm run dev
```

---

## Deployment

Push to GitHub → import on [vercel.com](https://vercel.com) → add env vars → deploy.

Full instructions, Google OAuth setup, and Supabase auth config: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Project Structure

```
app/                    Pages, API routes, layout
components/             All UI panels and games
lib/                    Supabase client, database queries, crypto, contexts
public/sprites/         Tyunnie sprite PNGs
public/music/           MP3s, cover art, playlist.json
```

Full file-by-file breakdown in [CLAUDE.md](./CLAUDE.md).

---

## Live Demo

[tyunnie-pa.vercel.app](https://tyunnie-pa.vercel.app)

---

## Release History

See [CHANGELOG.md](./CHANGELOG.md).

---

## About

Tyunnie is a personal productivity app built as a CS student project. The assistant is designed to feel like a warm, supportive friend — calm, a little dry, and genuinely helpful — inspired by the personality of Taehyun from TXT.

---

## License

MIT — feel free to use this as inspiration for your own projects.
