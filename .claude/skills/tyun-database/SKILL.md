---
name: tyun-database
description: >
  Change or audit the Supabase data layer in the Tyunnie PA project. Use for adding or
  altering a table or column, writing a migration in docs/sql/, RLS policies and grants,
  indexes, Supabase Storage buckets, and any edit to lib/database.ts. Also for "is the
  schema in sync", "did the migration run", and pending-migration checks before a
  deploy. For auth flows, crypto, and API-route security use tyun-security.
---

Data layer for Tyunnie PA. Every table is per-user and RLS-isolated; every new one has
to earn that same shape before it ships.

## Read these first

- **`docs/DATABASE.md`** — the full schema, RLS policies, grants and indexes. This is
  the source of truth for what the database *should* look like. A schema change that
  isn't reflected here is unfinished.
- **`docs/sql/`** — migration files, named `<version>-<what>.sql`. There is one pending:
  `3.23.0-recurring-and-streaks.sql`. **Check it has actually been run in Supabase
  before shipping anything that depends on recurring finance or streaks.**
- **`lib/database.ts`** — every read and write. There is no other data path.

---

## Adding a table — the five things, none optional

Miss one and it fails in a different way each time. Follow the existing block in
`docs/DATABASE.md` verbatim:

1. **Table** — `id uuid primary key default gen_random_uuid()`, `user_id uuid references
   auth.users not null`, `created_at timestamptz default now()`. `profiles` is the one
   exception: it keys on `id`, not `user_id`.
2. **`alter table <t> enable row level security;`** — a table without this is readable by
   every authenticated user with the anon key. It is a public key; assume it is known.
3. **`create policy "owner" on <t> for all using (auth.uid() = user_id);`** — `for all`,
   not `for select`. A SELECT-only policy leaves INSERT/UPDATE/DELETE ungoverned.
4. **`grant select, insert, update, delete on public.<t> to authenticated;`** — required
   for new projects since May 30 2026, enforced for all from Oct 30 2026. RLS without
   the grant fails closed and looks like a policy bug.
5. **Index** on the columns actually filtered — `(user_id, <sort or filter col>)`, matching
   the `todos_user_done` / `finance_user_date` pattern.

Then: add the CRUD to `lib/database.ts`, **add the `GUEST_ID` branch**, and update
`docs/DATABASE.md`.

---

## The guest branch is not optional

`lib/database.ts` routes on `userId === GUEST_ID` (or `isGuest()` where only an id is
available) to `lib/guest.ts`, which stores in `localStorage['tyunnie_guest_data']`.

A new read or write with no guest branch returns `null`/`void` for a demo user — and
that silence reaches the UI as a feature that appears to work and doesn't. This is
exactly how the vault shipped broken until 3.25.0. Two questions before you finish:

- Does this have a guest implementation in `lib/guest.ts`?
- If it *can't* (it's account-bound, like the daily-quote email), **does the UI visibly
  say so?** A DB layer returning `null` is not a UI state.

---

## Migrations

- One file per release in `docs/sql/`, named `<version>-<what>.sql`.
- Idempotent: `create table if not exists`, `add column if not exists`,
  `create index if not exists`. Assume it may be run twice.
- Additive. Never drop or rename a column in the same release that stops using it —
  the old deploy is still live for the minutes it takes Vercel to swap.
- New column on an existing table needs a default, or existing rows break on read.
- The migration is not "done" when the file is written. It is done when it has been run
  in Supabase. Say which state it's in, every time.

---

## RLS auditing

- Policy present **and** RLS actually enabled — the two are separate statements, and a
  policy on a table with RLS off does nothing.
- `for all`, not `for select`.
- `profiles` uses `auth.uid() = id`; everything else `auth.uid() = user_id`. A
  copy-pasted `user_id` policy onto `profiles` silently denies everything.
- Storage buckets have their own policies — bucket-level type and size limits are the
  real control. `accept=` on a file input is a picker hint.
- The service-role key bypasses RLS entirely. It appears in exactly one place
  (`app/api/daily-quote`) and must never reach a client file.

---

## Out of scope

Auth flows, JWT verification, rate limiting, crypto → `tyun-security`. Query caching
and request waterfalls → `tyun-network`. The fire-and-forget write path in
`lib/database.ts` is tracked debt, owned by `tyun-engineer` — don't add a `boolean`
return before a caller exists to read it. Don't add an ORM or a query builder; the app
uses the Supabase client directly and `lib/database.ts` is the single seam.
