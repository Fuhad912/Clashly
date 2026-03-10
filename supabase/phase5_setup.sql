-- Clashly Phase 5 Supabase setup

create extension if not exists pgcrypto;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  take_id uuid not null references public.takes (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint comments_content_length check (char_length(trim(content)) between 1 and 280)
);

create index if not exists comments_take_created_at_idx on public.comments (take_id, created_at desc);
create index if not exists comments_parent_created_at_idx on public.comments (parent_id, created_at desc);
create index if not exists comments_user_created_at_idx on public.comments (user_id, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "comments_read_authenticated" on public.comments;
create policy "comments_read_authenticated"
on public.comments
for select
to authenticated
using (true);

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own"
on public.comments
for insert
to authenticated
with check (
  auth.uid() = user_id
  and char_length(trim(content)) between 1 and 280
);

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own"
on public.comments
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and char_length(trim(content)) between 1 and 280
);

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own"
on public.comments
for delete
to authenticated
using (auth.uid() = user_id);
