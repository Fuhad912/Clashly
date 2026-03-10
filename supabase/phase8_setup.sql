-- Clashly Phase 8 Supabase setup

create extension if not exists pgcrypto;

create table if not exists public.hashtags (
  id uuid primary key default gen_random_uuid(),
  tag text not null unique,
  created_at timestamptz not null default now(),
  constraint hashtags_tag_format check (
    tag = lower(tag)
    and tag ~ '^[a-z0-9_]{1,32}$'
  )
);

create table if not exists public.take_hashtags (
  id uuid primary key default gen_random_uuid(),
  take_id uuid not null references public.takes (id) on delete cascade,
  hashtag_id uuid not null references public.hashtags (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint take_hashtags_unique_pair unique (take_id, hashtag_id)
);

create index if not exists hashtags_tag_idx on public.hashtags (tag);
create index if not exists take_hashtags_take_idx on public.take_hashtags (take_id);
create index if not exists take_hashtags_hashtag_idx on public.take_hashtags (hashtag_id);

alter table public.hashtags enable row level security;
alter table public.take_hashtags enable row level security;

drop policy if exists "hashtags_read_authenticated" on public.hashtags;
create policy "hashtags_read_authenticated"
on public.hashtags
for select
to authenticated
using (true);

drop policy if exists "hashtags_insert_authenticated" on public.hashtags;
create policy "hashtags_insert_authenticated"
on public.hashtags
for insert
to authenticated
with check (true);

drop policy if exists "take_hashtags_read_authenticated" on public.take_hashtags;
create policy "take_hashtags_read_authenticated"
on public.take_hashtags
for select
to authenticated
using (true);

drop policy if exists "take_hashtags_insert_owner" on public.take_hashtags;
create policy "take_hashtags_insert_owner"
on public.take_hashtags
for insert
to authenticated
with check (
  exists (
    select 1
    from public.takes
    where takes.id = take_id
      and takes.user_id = auth.uid()
  )
);
