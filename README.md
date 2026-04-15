# Tyunnie — Your Personal AI Assistant

> A full-stack personal assistant web app inspired by Taehyun from TXT. Built with Next.js, Supabase, and Groq AI.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)
![Version](https://img.shields.io/badge/version-3.10.1-f97316?style=flat-square)

---

## Features

### Tyunnie AI Panel

- Context-aware assistant powered by **Groq (Llama 3.3 70B)**
- Knows your tasks, drafts, projects, finances, snippets, sticky notes, and memories
- Natural language actions: add/delete tasks, create drafts, log finance, run snippets, start Pomodoro, toggle theme, enter focus mode
- **Daily briefing** — personalised 1-2 sentence summary on load, togglable from profile
- **Bottom-sheet overlay** — slides up from the dock; chat history persists across all tab switches
- **Snap resize** — cycle through snap sizes (default → wide → fullscreen on desktop; fullscreen-only on mobile)
- **Swipe-up gesture** — swipe from the bottom edge to open on mobile
- **Persistent memory** — remembers facts about you across sessions

### Desk (Home)

- Time-aware greeting, top 3 tasks, life progress rings, finance balance
- Inline Pomodoro mini-timer, Now Playing card, Recent Activity timeline
- Daily quote card (AI-generated via Groq), Quick Navigation grid

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

- 25/5/15 timer with session dots and task linking
- Fullscreen Focus Mode: task + timer + music + sticky notes (`Ctrl+Shift+F`)

### Games Hub

- Tetris, Chess (3 difficulties, 8 time controls), Sudoku, Minesweeper, Solitaire, Tic Tac Toe

### Navigation Dock

- **Desktop** — fixed bottom-center frosted glass pill with macOS-style magnification
- **Mobile** — full-width bottom bar
- Items: Home, Productivity, Entertainment, Profile, Tyun (chat), Sticky (new note), Sign Out

### Profile + Vault

- Display name, avatar, city, occupation, interests, locale, currency
- Full accent color picker (spectrum canvas, hue slider, hex/RGB/HSL inputs)
- **Password Vault** — AES-GCM 256-bit encrypted, PIN-protected, auto-locks after 30s

### Other

- Global search `Cmd+K` / `Ctrl+K`
- Draggable/resizable sticky notes, persisted to Supabase
- City-based weather (Open-Meteo, no API key needed)
- Dark / light mode, user-selectable accent color

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
