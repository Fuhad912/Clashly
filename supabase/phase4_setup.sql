-- Clashly Phase 4 Supabase setup

create extension if not exists pgcrypto;

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  take_id uuid not null references public.takes (id) on delete cascade,
  vote_type text not null,
  created_at timestamptz not null default now(),
  constraint votes_vote_type_check check (vote_type in ('agree', 'disagree')),
  constraint votes_user_take_unique unique (user_id, take_id)
);

create index if not exists votes_take_id_idx on public.votes (take_id);
create index if not exists votes_user_id_idx on public.votes (user_id);
create index if not exists votes_take_vote_type_idx on public.votes (take_id, vote_type);

alter table public.votes enable row level security;

create policy "votes_read_authenticated"
on public.votes
for select
to authenticated
using (true);

create policy "votes_insert_own"
on public.votes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and vote_type in ('agree', 'disagree')
);

create policy "votes_update_own"
on public.votes
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and vote_type in ('agree', 'disagree')
);

create policy "votes_delete_own"
on public.votes
for delete
to authenticated
using (auth.uid() = user_id);
