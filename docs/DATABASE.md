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
| `finance` | Income / expense entries (`recurring_id` links auto-logged rows to a rule) |
| `recurring_finance` | Monthly income/expense templates; client materialises them into `finance` on load |
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
Draft:        { title, body, updated_at }   // updated_at touched on every save — drives the writing streak
Project:      { name, status: 'planning'|'active'|'paused'|'done', start_date, end_date, progress: 0-100, description }
Snip:         { name, language: 'py'|'js'|'ts'|'bash', code }
FinanceEntry: { type: 'income'|'expense', description, amount, category, account, date: 'YYYY-MM-DD', recurring_id? }
RecurringRule:{ type: 'income'|'expense', description, amount, category, account, day_of_month: 1-31, active, last_generated: 'YYYY-MM'|null }
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
-- 3.23.0 recurring transactions + writing streaks: run docs/sql/3.23.0-recurring-and-streaks.sql
--   (creates recurring_finance, adds finance.recurring_id, adds drafts.updated_at)
-- alter table public.profiles alter column accent_color set default null;
-- update public.profiles set accent_color = null where accent_color = '#f97316';
-- alter table public.profiles add column if not exists desk_layout jsonb default null;
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

-- Grants (required from May 30 2026 for new projects; enforced Oct 30 2026 for all)
grant select, insert, update, delete on public.todos        to authenticated;
grant select, insert, update, delete on public.drafts       to authenticated;
grant select, insert, update, delete on public.projects     to authenticated;
grant select, insert, update, delete on public.snips        to authenticated;
grant select, insert, update, delete on public.finance      to authenticated;
grant select, insert, update, delete on public.profiles     to authenticated;
grant select, insert, update, delete on public.sticky_notes to authenticated;
grant select, insert, update, delete on public.memories     to authenticated;
grant select, insert, update, delete on public.vault        to authenticated;
grant select, insert, update, delete on public.vault_meta   to authenticated;

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
grant select, insert, update, delete on public.music_tracks to authenticated;
create index if not exists music_tracks_user on music_tracks(user_id, position);
```

### Music Storage Buckets

The RLS policies below check *path ownership* only — they say nothing about what
a file contains or how big it is. Size and MIME limits are bucket columns, and
they are the authoritative gate: the client-side checks in `Music.tsx` exist to
give a readable error, not to enforce this (anyone can call the Storage API
directly and skip them).

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-audio', 'music-audio', true,
  20971520, -- 20 MB
  array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/x-m4a','audio/aac']
);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-covers', 'music-covers', true,
  5242880, -- 5 MB
  array['image/png','image/jpeg','image/webp','image/gif']
);

-- Already have these buckets? Apply the limits in place instead:
-- update storage.buckets set file_size_limit = 20971520,
--   allowed_mime_types = array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/x-m4a','audio/aac']
--   where id = 'music-audio';
-- update storage.buckets set file_size_limit = 5242880,
--   allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
--   where id = 'music-covers';

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

Same as the music buckets: the policies check path ownership, the bucket columns
enforce size and type. `Profile.tsx` mirrors these limits client-side for the
error message only.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  5242880, -- 5 MB
  array['image/png','image/jpeg','image/webp','image/gif']
);

-- Existing bucket:
-- update storage.buckets set file_size_limit = 5242880,
--   allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
--   where id = 'avatars';

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
