# 🧡 Tyunnie — Your Personal AI Assistant

> A full-stack personal assistant web app inspired by Taehyun from TXT. Built with Next.js, Supabase, and Groq AI.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)
![Version](https://img.shields.io/badge/version-2.0.0-f97316?style=flat-square)

---

## ✨ Features

### 🤖 Tyunnie AI Panel
- Context-aware AI assistant powered by **Groq (Llama 3.3 70B)**
- Knows your calendar, tasks, drafts, projects, finances, and snippets
- Can add events, tasks, drafts, projects, finance entries, and code snippets via natural language
- **Daily briefing** — personalised 1-2 sentence summary generated on load
- **Expandable panel** — desktop full-screen chat mode with larger sprite (desktop only)
- Scrollable chat history, auto-scrolls to latest message
- Warm, personal tone inspired by Taehyun from TXT
- **Sprite system** — 10 named sprites that react to active panel and Tyunnie's current mood with 4-second mood reset
- **Mobile optimised** — sprite floats as background decoration, input always above tab bar

### 📅 Calendar
- Month, Week, 3-Day, and Year views
- Add and delete events
- Upcoming events list
- Tyunnie can schedule events with confirmation

### ✅ Tasks
- Add tasks with tags (CS, Writing, Personal, Other)
- Due dates, mark as done
- Tyunnie can add tasks instantly via chat

### ✍️ Writing
- Full draft editor with word count
- Create, edit, and delete drafts
- Tyunnie can generate draft templates

### 🗂️ Projects
- Project cards with status (Planning, Active, Paused, Done)
- Progress bars and Gantt chart for date-ranged projects
- Inline progress slider
- Tyunnie can create new projects

### 💻 Snippets
- Code editor with syntax language support
- Line numbers, Tab indentation, Cmd+S to save
- **Live code execution** via JDoodle API (Python, JS, TS, Bash)
- Terminal output panel
- Tyunnie can generate and save code snippets

### 💰 Finance Tracker
- Monthly income and expense tracking with **account tagging** (Maybank, MAE, Grab, GXBank, TnG, Wallet, ASB)
- Navigate between months with ‹ › arrows
- **Carried balance** — previous months' balance rolls into current month
- Account balance pills showing net balance per account
- Filter entries by type and by account
- **Analytics tab** with 6-month bar chart, by-account breakdown, category donut, and 50/30/20 rule tracker
- Reset month button
- Tyunnie can log entries and reset months

### 🎵 Music Player
- Upload your own MP3s to `public/music/`
- Play, pause, skip, previous, shuffle, repeat (none/all/one)
- Seekable progress bar and volume control
- Album art with slow spin animation while playing
- Persistent playback across panel switches
- Mini player in the Tyunnie panel

### ⏲️ Pomodoro Timer
- 25-minute focus sessions with 5-minute short breaks and 15-minute long breaks
- Auto-advances through cycles — every 4 sessions triggers a long break
- Session dot tracker
- **Timer starts only on first input** — clock stays at 00:00 until you begin
- Link a pending task to your focus session
- Color-coded modes (orange / green / blue)

### 🎮 Games Hub
Four minigames accessible from the Games panel:

**Tic Tac Toe** — Play against Tyunnie bot using minimax. Three difficulty levels: Easy (random), Medium (25% mistake chance), Hard (perfect). Score tracker across rounds. Tyunnie has personality quips on win, lose, and draw.

**Sudoku** — Pre-made puzzles across Easy, Medium, Hard. 3-mistake limit. Notes mode (pencil marks). Timer starts on first input. Highlighted cells for row/column/box and same-number detection. Number pad + keyboard input.

**Minesweeper** — 8×8 / 10×10 / 12×12 grids. First click always safe. Flood-fill reveal. Right-click to flag. Chord support — click a revealed number to auto-reveal neighbours when flags match. Timer starts on first reveal.

**Solitaire** — Klondike solitaire. Draw from stock, move cards between tableau columns and to foundations. Click to select then click destination to place. Full move validation and win detection with Tyunnie quip.

### 🔍 Global Search
- `Cmd+K` / `Ctrl+K` to open
- Searches **panel shortcuts** (games, focus, money, sudoku, minesweeper, solitaire, etc.) AND all data
- Covers events, tasks, drafts, projects, snippets, finance entries
- Highlighted keyword matches, grouped by type
- Click any result to jump directly to that panel

### 🔐 Authentication
- Email/password sign up and login
- Google OAuth one-click sign in
- Auto session refresh and redirect on expiry

### 📱 Mobile Responsive
- **Scrollable bottom tab bar** — swipe left/right to access all 9 panels without squishing
- Tyunnie chat slides in as full-screen overlay
- Sprite visible as background without blocking chat or input
- Touch-friendly controls throughout

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth + Google OAuth |
| AI | Groq API (Llama 3.3 70B) |
| Code Execution | JDoodle API |
| Charts | Recharts 3 |
| Date Utilities | date-fns 4 |
| Fonts | Instrument Serif + Nunito + Geist Mono |
| Deployment | Vercel |
| Analytics | Vercel Analytics + Speed Insights |

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account
- A [Groq](https://groq.com) API key
- A [JDoodle](https://jdoodle.com) account (for code execution)
- A [Google Cloud](https://console.cloud.google.com) project (for OAuth)

### 1. Clone the repository

```bash
git clone https://github.com/affannajiy/tyunnie-pa.git
cd tyunnie-pa
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GROQ_API_KEY=gsk_your-groq-key
JDOODLE_CLIENT_ID=your-jdoodle-client-id
JDOODLE_CLIENT_SECRET=your-jdoodle-client-secret
```

### 3. Set up Supabase database

```sql
-- Events
create table events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  date date not null,
  time text,
  created_at timestamptz default now()
);

-- Todos
create table todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  text text not null,
  tag text default 'other',
  due date,
  done boolean default false,
  created_at timestamptz default now()
);

-- Drafts
create table drafts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  body text,
  created_at timestamptz default now()
);

-- Projects
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  status text default 'planning',
  description text,
  start_date date,
  end_date date,
  progress integer default 0,
  created_at timestamptz default now()
);

-- Snips
create table snips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  language text default 'other',
  code text,
  created_at timestamptz default now()
);

-- Finance
create table finance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  type text not null,
  description text not null,
  amount numeric(10,2) not null,
  category text default 'Other',
  account text default 'Wallet',
  date date not null,
  created_at timestamptz default now()
);
```

Enable RLS on all tables and add policies so users can only access their own data.

### 4. Add database indexes

Run in the Supabase SQL editor:

```sql
create index if not exists events_user_date      on events(user_id, date);
create index if not exists todos_user_done       on todos(user_id, done);
create index if not exists finance_user_date     on finance(user_id, date);
create index if not exists snips_user_created    on snips(user_id, created_at);
create index if not exists drafts_user_created   on drafts(user_id, created_at);
create index if not exists projects_user_created on projects(user_id, created_at);
```

> **Upgrading from v1.x?** Also run:
> ```sql
> alter table finance add column account text default 'Wallet';
> ```

### 5. Set up Google OAuth (optional)

1. Go to Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client
2. Add `https://your-project.supabase.co/auth/v1/callback` as an authorised redirect URI
3. Paste Client ID and Secret into Supabase → Authentication → Providers → Google
4. Set your Supabase Site URL and redirect URLs to your app's domain

### 6. Add sprites (optional)

Create `public/sprites/` and add transparent PNG sprites (recommended 360×460px):

```
tyun-default.png
tyun-casual.png
tyun-focused.png
tyun-writing.png
tyun-serious.png
tyun-coding.png
tyun-thinking.png
tyun-happy.png
tyun-celebrating.png
tyun-concerned.png
```

### 7. Add music (optional)

Create `public/music/` and add MP3 files and a `playlist.json`:

```json
[
  {
    "title": "Song Title",
    "artist": "Artist Name",
    "file": "/music/song.mp3",
    "cover": "/music/cover.jpg"
  }
]
```

### 8. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📁 Project Structure

```
tyunnie/
├── app/
│   ├── api/
│   │   ├── chat/route.ts           # Groq AI endpoint
│   │   └── run/route.ts            # JDoodle code execution
│   ├── auth/page.tsx               # Login / signup
│   ├── chat/page.tsx               # Redirects → /dashboard
│   ├── chat-demo/page.tsx          # Redirects → /demo
│   ├── demo/page.tsx               # Demo (no auth)
│   ├── dashboard/page.tsx          # Main app (requires auth)
│   ├── layout.tsx
│   ├── page.tsx                    # Redirects → /dashboard
│   └── globals.css
├── components/
│   ├── Sidebar.tsx                 # Scrollable bottom nav (mobile) + vertical (desktop)
│   ├── TyunniePanel.tsx            # AI chat panel
│   ├── Calendar.tsx
│   ├── Todo.tsx
│   ├── Writing.tsx
│   ├── Projects.tsx
│   ├── Snippets.tsx
│   ├── Finance.tsx
│   ├── Music.tsx
│   ├── Pomodoro.tsx                # Focus timer with task linking
│   ├── Games.tsx                   # Games hub
│   └── games/
│       ├── TicTacToe.tsx           # vs Tyunnie bot (minimax, 3 difficulties)
│       ├── Sudoku.tsx              # Notes mode, 3-mistake limit, lazy timer
│       ├── Minesweeper.tsx         # First-click safe, chord support
│       └── Solitaire.tsx           # Klondike solitaire
├── lib/
│   ├── supabase.ts
│   ├── database.ts                 # All DB query functions
│   └── MusicContext.tsx            # Global music state
└── public/
    ├── sprites/                    # Tyunnie sprite PNGs
    └── music/                      # MP3s + playlist.json
```

---

## 🌐 Demo

**Live:** [tyunnie-pa.vercel.app](https://tyunnie-pa.vercel.app)

**Demo (no login):** [tyunnie-pa.vercel.app/demo](https://tyunnie-pa.vercel.app/demo)

---

## 🚢 Deployment

1. Push to GitHub
2. Import repo on [vercel.com](https://vercel.com)
3. Add all environment variables in Vercel → Settings → Environment Variables
4. Deploy

---

## 📋 Changelog

### v2.0.0
- **Games Hub** — new Games panel with four playable minigames
- Tic Tac Toe vs Tyunnie bot (Easy / Medium / Hard with minimax)
- Sudoku with notes mode, 3-mistake limit, timer starts on first input
- Minesweeper with first-click safe guarantee, flood fill, and chord support
- Solitaire (Klondike) with full move validation and win detection
- **Pomodoro Timer** — 25/5/15 cycle, session dots, task linking, lazy timer start
- **Global search upgraded** — now detects panel shortcuts including all games by name
- **Scrollable mobile nav** — bottom tab bar scrolls horizontally, fixed squishing with 9+ panels
- Briefing card full-width on mobile

### v1.3.1
- Removed global data loading spinner — panels render immediately
- Finance queries scoped to last 12 months
- Supabase indexes on all major query columns
- Vercel RES improved on /dashboard

### v1.3.0
- Mobile Tyunnie panel overhaul
- Carried balance from previous months in Finance
- Expand mode desktop-only
- Removed duplicate close buttons

### v1.2.0
- Finance account tagging (Maybank, MAE, Grab, GXBank, TnG, Wallet, ASB)
- By-account analytics and balance pills

### v0.2.0
- Expandable Tyunnie panel
- Daily briefing card
- Global search Cmd+K
- Chat page merged into dashboard

### v0.1.0
- Initial release — calendar, tasks, writing, projects, snippets, finance, music
- Tyunnie AI panel with action execution
- Google OAuth, Supabase auth
- Mobile responsive layout
- Sprite system with mood-based switching

---

## 🧡 About

Tyunnie is a personal productivity app built as a CS student project. The assistant is designed to feel like a warm, supportive friend — not a corporate AI — inspired by the personality of Taehyun from TXT.

---

## 📄 License

MIT — feel free to use this as inspiration for your own projects.