# Database

Tyunnie uses **Supabase (PostgreSQL)** with Row Level Security on every table.

---

## Tables

| Table | Purpose |
|---|---|
| `todos` | Tasks with tag, due date, done flag |
| `drafts` | Writing drafts |
| `projects` | Project tracker with status + progress |
| `snips` | Code snippets |
| `finance` | Income / expense entries |
| `profiles` | User profile + preferences |
| `vault` | AES-GCM encrypted password entries |
| `vault_meta` | PIN verifier + salt (PIN never stored) |
| `sticky_notes` | Draggable sticky notes with position + color |
| `memories` | AI memory entries (latest 40 kept) |
| `music_tracks` | User-uploaded tracks (file + cover URLs, position) |

---

## TypeScript Types

Defined in `lib/database.ts`:

```ts
Todo:         { text, tag: 'cs'|'write'|'personal'|'other', due: 'YYYY-MM-DD'|null, done }
Draft:        { title, body }
Project:      { name, status: 'planning'|'active'|'paused'|'done', start_date, end_date, progress: 0-100, description }
Snip:         { name, language: 'py'|'js'|'ts'|'bash', code }
FinanceEntry: { type: 'income'|'expense', description, amount, category, account, date: 'YYYY-MM-DD' }
Profile:      { display_name, birth_day, birth_month, city, city_lat, city_lon, theme, locale, currency,
                occupation, workplace, bio, interests[], greeting_style, show_briefing, avatar_url, daily_quote_email }
VaultEntry:   { name, encrypted_data, iv, salt }   // all base64
StickyNote:   { content, x, y, width, height, color }
Memory:       { content }
```

---

## SQL Setup

Run in Supabase SQL Editor:

```sql
-- Core tables
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
  daily_quote_email boolean default false,
  accent_color text default null,
  updated_at timestamptz default now()
);

-- Migrations (run if table already exists):
-- alter table public.profiles add column if not exists accent_color text default null;
-- alter table public.profiles alter column accent_color set default null;
-- update public.profiles set accent_color = null where accent_color = '#f97316';
create table sticky_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  content text default '', x integer default 100, y integer default 100,
  width integer default 220, height integer default 160,
  color text default 'yellow', created_at timestamptz default now()
);
create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  content text not null, created_at timestamptz default now()
);

-- Vault tables
create table vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null, encrypted_data text not null,
  iv text not null, salt text not null,
  created_at timestamptz default now()
);
create table vault_meta (
  user_id uuid references auth.users primary key,
  verifier text not null, salt text not null, iv text not null,
  updated_at timestamptz default now()
);

-- RLS
alter table todos        enable row level security;
alter table drafts       enable row level security;
alter table projects     enable row level security;
alter table snips        enable row level security;
alter table finance      enable row level security;
alter table profiles     enable row level security;
alter table sticky_notes enable row level security;
alter table memories     enable row level security;
alter table vault        enable row level security;
alter table vault_meta   enable row level security;

create policy "owner" on todos        for all using (auth.uid() = user_id);
create policy "owner" on drafts       for all using (auth.uid() = user_id);
create policy "owner" on projects     for all using (auth.uid() = user_id);
create policy "owner" on snips        for all using (auth.uid() = user_id);
create policy "owner" on finance      for all using (auth.uid() = user_id);
create policy "owner" on profiles     for all using (auth.uid() = id);
create policy "owner" on sticky_notes for all using (auth.uid() = user_id);
create policy "owner" on memories     for all using (auth.uid() = user_id);
create policy "owner" on vault        for all using (auth.uid() = user_id);
create policy "owner" on vault_meta   for all using (auth.uid() = user_id);

-- Indexes
create index if not exists todos_user_done       on todos(user_id, done);
create index if not exists finance_user_date     on finance(user_id, date);
create index if not exists snips_user_created    on snips(user_id, created_at);
create index if not exists drafts_user_created   on drafts(user_id, created_at);
create index if not exists projects_user_created on projects(user_id, created_at);
```

---

## Music Tracks

```sql
create table music_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  artist text not null,
  file_url text not null,
  cover_url text,
  position integer default 0,
  created_at timestamptz default now()
);
alter table music_tracks enable row level security;
create policy "owner" on music_tracks for all using (auth.uid() = user_id);
create index if not exists music_tracks_user on music_tracks(user_id, position);
```

### Music Storage Buckets

```sql
insert into storage.buckets (id, name, public) values ('music-audio', 'music-audio', true);
insert into storage.buckets (id, name, public) values ('music-covers', 'music-covers', true);

create policy "music_audio_upload" on storage.objects
  for insert with check (
    bucket_id = 'music-audio' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "music_audio_read" on storage.objects for select using (bucket_id = 'music-audio');
create policy "music_audio_delete" on storage.objects
  for delete using (
    bucket_id = 'music-audio' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "music_covers_upload" on storage.objects
  for insert with check (
    bucket_id = 'music-covers' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "music_covers_read" on storage.objects for select using (bucket_id = 'music-covers');
create policy "music_covers_delete" on storage.objects
  for delete using (
    bucket_id = 'music-covers' and auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## Avatar Storage

```sql
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "avatar_upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatar_read"   on storage.objects for select using (bucket_id = 'avatars');
create policy "avatar_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## Demo Mode

All `database.ts` functions short-circuit when `userId === "demo-user"` — no DB writes. Add this guard to any new function.
