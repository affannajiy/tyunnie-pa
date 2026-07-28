-- ─────────────────────────────────────────────────────────────────────────────
--  Migration: 3.23.0 — Recurring transactions + Writing streaks
--  Run this in the Supabase SQL editor. Safe to run once; uses IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Recurring finance rules ──────────────────────────────────────────────────
--    Templates the client materialises into real `finance` rows on Finance mount
--    (catch-up on load). One row per recurring income/expense.
create table if not exists public.recurring_finance (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  type           text not null check (type in ('income', 'expense')),
  description    text not null,
  amount         numeric not null check (amount > 0),
  category       text not null,
  account        text not null default 'Wallet',
  day_of_month   int  not null check (day_of_month between 1 and 31),
  active         boolean not null default true,
  last_generated text,            -- 'YYYY-MM' of the most recent materialised month, or null
  created_at     timestamptz not null default now()
);

create index if not exists recurring_finance_user_idx
  on public.recurring_finance (user_id);

alter table public.recurring_finance enable row level security;

-- Owner-only access (mirrors the finance table's policy).
drop policy if exists "recurring_finance owner" on public.recurring_finance;
create policy "recurring_finance owner"
  on public.recurring_finance
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Link generated entries back to their rule ────────────────────────────────
--    Nullable: manual entries keep it null; auto-logged entries carry the rule id
--    so the UI can badge them and the engine can avoid double-inserts.
alter table public.finance
  add column if not exists recurring_id uuid
  references public.recurring_finance (id) on delete set null;

-- 3. Writing streaks need per-day activity ────────────────────────────────────
--    Drafts only tracked created_at; add updated_at so edits count toward the
--    streak, not just brand-new drafts. Backfill existing rows to created_at.
alter table public.drafts
  add column if not exists updated_at timestamptz;

update public.drafts
  set updated_at = created_at
  where updated_at is null;

alter table public.drafts
  alter column updated_at set default now();
