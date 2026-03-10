-- Clashly Phase 7 Supabase setup

create extension if not exists pgcrypto;

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  take_id uuid not null references public.takes (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bookmarks_unique_pair unique (user_id, take_id)
);

create index if not exists bookmarks_user_idx on public.bookmarks (user_id, created_at desc);
create index if not exists bookmarks_take_idx on public.bookmarks (take_id);

alter table public.bookmarks enable row level security;

drop policy if exists "bookmarks_read_own" on public.bookmarks;
create policy "bookmarks_read_own"
on public.bookmarks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "bookmarks_insert_own" on public.bookmarks;
create policy "bookmarks_insert_own"
on public.bookmarks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "bookmarks_delete_own" on public.bookmarks;
create policy "bookmarks_delete_own"
on public.bookmarks
for delete
to authenticated
using (auth.uid() = user_id);
