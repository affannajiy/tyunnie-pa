# 🧡 Tyunnie — Your Personal AI Assistant

> A full-stack personal assistant web app inspired by Taehyun from TXT. Built with Next.js, Supabase, and Groq AI.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)
![Version](https://img.shields.io/badge/version-2.6.0-f97316?style=flat-square)

---

## ✨ Features

### 🤖 Tyunnie AI Panel

- Context-aware AI assistant powered by **Groq (Llama 3.3 70B)**
- Knows your calendar, tasks, drafts, projects, finances, and snippets
- Can add events, tasks, drafts, projects, finance entries, and code snippets via natural language
- **Daily briefing** — personalised 1-2 sentence summary on load, togglable from profile
- **Expandable panel** — desktop full-screen chat mode with larger sprite
- **Sprite system** — separate panel sprites and mood sprites, reacts to active tab and emotional state
- Calls you by name and adapts tone based on your profile preferences
- Mobile optimised — sprite floats as background, input always accessible

### 👤 User Profile

- Display name, date of birth (day + month), city, occupation, workplace, bio
- Interest tags used by Tyunnie for personalised context
- Greeting style (casual / formal), currency, locale preferences
- Theme toggle (light / dark) and daily briefing toggle
- Syncs to Supabase `profiles` table, migrates from localStorage on first load
- Initials avatar in the sidebar nav, full avatar preview in the profile panel

### 📅 Calendar

- Month, Week, 3-Day, and Year views
- Add and delete events, upcoming events list

### ✅ Tasks

- Tags (CS, Writing, Personal, Other), due dates, mark as done
- Confetti burst on completion 🎉

### ✍️ Writing

- Draft editor with word count, create/edit/delete drafts

### 🗂️ Projects

- Status tracking, progress bars, Gantt chart for date-ranged projects

### 💻 Snippets

- Code editor with live execution via JDoodle API (Python, JS, TS, Bash)

### 💰 Finance Tracker

- Monthly tracking with account tagging (Maybank, MAE, Grab, GXBank, TnG, Wallet, ASB)
- Carried balance across months, analytics tab with charts and 50/30/20 rule

### 🎵 Music Player

- Upload your own MP3s with album art (500×500px), full playback controls, persistent across panels

### ⏲️ Pomodoro Timer

- 25/5/15 cycle, session dots, task linking, timer starts on first input

### 🎮 Games Hub

- **Tic Tac Toe** — vs Tyunnie bot (Easy / Medium / Hard, minimax)
- **Sudoku** — notes mode, 3-mistake limit, lazy timer
- **Minesweeper** — first-click safe, flood fill, chord support
- **Solitaire** — Klondike with full move validation

### 🔍 Global Search

- `Cmd+K` / `Ctrl+K` — searches panels, events, tasks, drafts, projects, snippets, finance

### 🌤️ Weather Widget

- City-based weather in the topbar — no location permission needed
- Type a city name once, saved permanently

### 🌙 Dark Mode

- Toggle from the Profile panel, preference persisted across sessions

### 🔐 Authentication

- Email/password + Google OAuth, auto session refresh

### 📱 Mobile Responsive

- Scrollable bottom tab bar, Tyunnie chat as full-screen overlay

---

## 🚀 Tech Stack

| Layer          | Technology                             |
| -------------- | -------------------------------------- |
| Framework      | Next.js 16 (App Router)                |
| Language       | TypeScript 5                           |
| Styling        | Tailwind CSS v4                        |
| Database       | Supabase (PostgreSQL)                  |
| Auth           | Supabase Auth + Google OAuth           |
| AI             | Groq API (Llama 3.3 70B)               |
| Code Execution | JDoodle API                            |
| Charts         | Recharts 3                             |
| Weather        | Open-Meteo API (free, no key)          |
| Fonts          | Instrument Serif + Nunito + Geist Mono |
| Deployment     | Vercel                                 |

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
create table events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null, date date not null, time text,
  created_at timestamptz default now()
);
create table todos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  text text not null, tag text default 'other', due date,
  done boolean default false, created_at timestamptz default now()
);
create table drafts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null, body text, created_at timestamptz default now()
);
create table projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null, status text default 'planning',
  description text, start_date date, end_date date,
  progress integer default 0, created_at timestamptz default now()
);
create table snips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null, language text default 'other',
  code text, created_at timestamptz default now()
);
create table finance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  type text not null, description text not null,
  amount numeric(10,2) not null, category text default 'Other',
  account text default 'Wallet', date date not null,
  created_at timestamptz default now()
);
create table profiles (
  id uuid references auth.users primary key,
  display_name text, birth_day integer, birth_month integer,
  city text, city_lat numeric, city_lon numeric,
  theme text default 'light', locale text default 'en-MY',
  currency text default 'RM', occupation text, workplace text,
  bio text, interests text[] default '{}',
  greeting_style text default 'casual', show_briefing boolean default true,
  updated_at timestamptz default now()
);
```

Enable RLS on all tables. Add indexes:

```sql
create index if not exists events_user_date      on events(user_id, date);
create index if not exists todos_user_done       on todos(user_id, done);
create index if not exists finance_user_date     on finance(user_id, date);
create index if not exists snips_user_created    on snips(user_id, created_at);
create index if not exists drafts_user_created   on drafts(user_id, created_at);
create index if not exists projects_user_created on projects(user_id, created_at);
```

### 4. Add sprites (optional)

Create `public/sprites/` with transparent PNG sprites (360×460px recommended):

- Panel sprites: `tyun-panel-calendar.png`, `tyun-panel-todo.png`, `tyun-panel-writing.png`, `tyun-panel-projects.png`, `tyun-panel-snippets.png`, `tyun-panel-finance.png`, `tyun-panel-music.png`, `tyun-panel-pomodoro.png`, `tyun-panel-games.png`
- Mood sprites: `tyun-mood-default.png`, `tyun-mood-happy.png`, `tyun-mood-concerned.png`, `tyun-mood-celebrating.png`, `tyun-mood-thinking.png`

### 5. Add music (optional)

Create `public/music/` with MP3 files, album art (500×500px JPEGs recommended), and a `playlist.json`:

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

## 📁 Project Structure

```
tyunnie-pa/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # Groq AI endpoint
│   │   └── run/route.ts        # JDoodle code execution
│   ├── auth/page.tsx
│   ├── demo/page.tsx           # No-auth demo
│   ├── dashboard/page.tsx      # Main app
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── Sidebar.tsx
│   ├── TyunniePanel.tsx
│   ├── Weather.tsx
│   ├── Profile.tsx
│   ├── Calendar.tsx
│   ├── Todo.tsx
│   ├── Writing.tsx
│   ├── Projects.tsx
│   ├── Snippets.tsx
│   ├── Finance.tsx
│   ├── Music.tsx
│   ├── Pomodoro.tsx
│   ├── Games.tsx
│   └── games/
│       ├── TicTacToe.tsx
│       ├── Sudoku.tsx
│       ├── Minesweeper.tsx
│       └── Solitaire.tsx
├── lib/
│   ├── supabase.ts
│   ├── database.ts
│   └── MusicContext.tsx
└── public/
    ├── sprites/
    └── music/
```

---

## 🌐 Demo

**Live:** [tyunnie-pa.vercel.app](https://tyunnie-pa.vercel.app)

**Demo (no login):** [tyunnie-pa.vercel.app/demo](https://tyunnie-pa.vercel.app/demo)

---

## 🚢 Deployment

1. Push to GitHub
2. Import on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel → Settings → Environment Variables
4. Deploy

---

## 📋 Release History

See [CHANGELOG.md](./CHANGELOG.md) for the full version history.

---

## 🧡 About

Tyunnie is a personal productivity app built as a CS student project. The assistant is designed to feel like a warm, supportive friend — not a corporate AI — inspired by the personality of Taehyun from TXT.

---

## 📄 License

MIT — feel free to use this as inspiration for your own projects.
