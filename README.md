# 🧡 Tyunnie — Your Personal AI Assistant

> A full-stack personal assistant web app inspired by Taehyun from TXT. Built with Next.js, Supabase, and Groq AI.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=flat-square&logo=tailwindcss)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)
![Version](https://img.shields.io/badge/version-1.2.0-f97316?style=flat-square)

---

## ✨ Features

### 🤖 Tyunnie AI Panel
- Context-aware AI assistant powered by **Groq (Llama 3.3 70B)**
- Knows your calendar, tasks, drafts, projects, finances, and snippets
- Can add events, tasks, drafts, projects, finance entries, and code snippets via natural language
- **Daily briefing** — personalised 1-2 sentence summary generated on load based on your data
- **Expandable panel** — click Chat → to expand Tyunnie into a full-screen chat view with a larger sprite; click ✕ to collapse back
- Persistent chat history within each session, scrollable in both collapsed and expanded modes
- Warm, personal tone inspired by Taehyun from TXT
- **Sprite system** — 10 named sprites that react to active panel and Tyunnie's current mood

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
- **Account balance pills** showing net balance per account at a glance
- Filter entries by type and by account
- Coloured account badge on each entry row
- **Analytics tab** with:
  - 6-month income vs expenses bar chart
  - **By Account** breakdown — income and expense bars per account
  - Spending by category donut chart
  - 50/30/20 rule tracker (Needs / Wants / Savings)
- Reset month button
- Tyunnie can log entries and reset months

### 🎵 Music Player
- Upload your own MP3s to `public/music/`
- Play, pause, skip, previous, shuffle, repeat (none/all/one)
- Seekable progress bar and volume control
- Album art with slow spin animation while playing
- **Persistent playback** — music continues when switching panels
- **Mini player** in the Tyunnie panel with progress bar and controls

### 🔍 Global Search
- `Cmd+K` / `Ctrl+K` to open search modal
- Searches across all data types: events, tasks, drafts, projects, snippets, finance
- Highlighted keyword matches, grouped by type
- Click any result to jump straight to that panel

### 🔐 Authentication
- Email/password sign up and login
- **Google OAuth** one-click sign in
- Auto session refresh and redirect on expiry

### 📱 Mobile Responsive
- Bottom tab bar navigation on mobile
- Tyunnie chat slides in as a full-screen overlay
- Touch-friendly controls

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

Create the following tables in your Supabase project with RLS enabled:

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

> **Upgrading from v0.x?** Run this migration to add the account column:
> ```sql
> alter table finance add column account text default 'Wallet';
> ```

### 4. Set up Google OAuth (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client
2. Add `https://your-project.supabase.co/auth/v1/callback` as an authorised redirect URI
3. Paste the Client ID and Secret into Supabase → Authentication → Providers → Google
4. Set your Supabase Site URL and redirect URLs to your app's domain

### 5. Add sprites (optional)

Create `public/sprites/` and add your sprite PNGs (recommended 360×460px transparent PNG):

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

### 6. Add music (optional)

Create `public/music/` and add your MP3 files and a `playlist.json`:

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

### 7. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
tyunnie/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # Groq AI endpoint
│   │   └── run/route.ts        # JDoodle code execution
│   ├── auth/page.tsx           # Login / signup
│   ├── chat/page.tsx           # Redirects → /dashboard
│   ├── chat-demo/page.tsx      # Redirects → /demo
│   ├── demo/page.tsx           # Demo dashboard (no auth)
│   ├── dashboard/page.tsx      # Main app (requires auth)
│   ├── error.tsx               # Custom error page
│   ├── not-found.tsx           # Custom 404 page
│   ├── layout.tsx
│   ├── page.tsx                # Redirects → /dashboard
│   └── globals.css
├── components/
│   ├── Sidebar.tsx
│   ├── TyunniePanel.tsx        # AI chat panel (expandable)
│   ├── Calendar.tsx
│   ├── Todo.tsx
│   ├── Writing.tsx
│   ├── Projects.tsx
│   ├── Snippets.tsx
│   ├── Finance.tsx             # Finance tracker with account support
│   └── Music.tsx
├── lib/
│   ├── supabase.ts
│   ├── database.ts             # All DB query functions
│   └── MusicContext.tsx        # Global music state
└── public/
    ├── sprites/                # Tyunnie sprite PNGs
    └── music/                  # MP3 files + playlist.json
```

---

## 🌐 Demo

Try the live demo without signing in:

**Dashboard:** [tyunnie-pa.vercel.app/demo](https://tyunnie-pa.vercel.app/demo)

> Demo data resets on page refresh. No account needed.

---

## 🚢 Deployment

The app is deployed on Vercel. To deploy your own:

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add all environment variables in Vercel → Settings → Environment Variables
4. Deploy

---

## 📸 Screenshots

> Add screenshots here

---

## 📋 Changelog

### v1.2.0
- Finance tracker now supports account tagging (Maybank, MAE, Grab, GXBank, TnG, Wallet, ASB)
- Account balance pills on the finance page showing net balance per account
- Filter entries by account in the tracker view
- New "By Account" analytics section with income and expense breakdown per account
- Coloured account badge on each entry row

### v0.2.0
- Tyunnie panel is now expandable — full-screen chat mode with larger sprite
- Daily briefing card generated on load, pinned above chat history
- Removed standalone chat page — dashboard is now the single entry point
- Scrollable chat history in both collapsed and expanded panel modes
- Animated panel expand/collapse transitions
- Demo mode cleaned up — no more separate chat-demo page
- Global search modal (`Cmd+K`) across all data types

### v0.1.0
- Initial release — calendar, tasks, writing, projects, snippets, finance, music
- Tyunnie AI panel with action execution
- Google OAuth, Supabase auth
- Mobile responsive layout
- Sprite system with mood-based switching
- Mini music player in Tyunnie panel

---

## 🧡 About

Tyunnie is a personal productivity app built as a CS student project. The assistant is designed to feel like a warm, supportive friend — not a corporate AI — inspired by the personality of Taehyun from TXT.

---

## 📄 License

MIT — feel free to use this as inspiration for your own projects.
