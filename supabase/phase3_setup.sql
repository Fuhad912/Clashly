-- Clashly Phase 3 Supabase setup

create extension if not exists pgcrypto;

create table if not exists public.takes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz not null default now(),
  constraint takes_content_length check (char_length(content) between 1 and 180)
);

create index if not exists takes_created_at_idx on public.takes (created_at desc);
create index if not exists takes_user_created_at_idx on public.takes (user_id, created_at desc);

alter table public.takes enable row level security;

create policy "takes_read_authenticated"
on public.takes
for select
to authenticated
using (true);

create policy "takes_insert_own"
on public.takes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "takes_update_own"
on public.takes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('take-images', 'take-images', true)
on conflict (id) do nothing;

create policy "take_images_public_read"
on storage.objects
for select
to public
using (bucket_id = 'take-images');

create policy "take_images_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'take-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "take_images_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'take-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'take-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "take_images_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'take-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
