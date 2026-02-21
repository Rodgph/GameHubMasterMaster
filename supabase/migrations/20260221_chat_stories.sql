create extension if not exists pgcrypto;

create table if not exists public.chat_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('text', 'media', 'mixed')),
  text text null,
  media_path text null,
  media_type text null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_chat_stories_user_expires_desc
  on public.chat_stories (user_id, expires_at desc);

create index if not exists idx_chat_stories_expires
  on public.chat_stories (expires_at);

create or replace view public.active_chat_stories as
select *
from public.chat_stories
where expires_at > now();

alter table public.chat_stories enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_stories'
      and policyname = 'chat_stories_insert_owner'
  ) then
    create policy chat_stories_insert_owner
      on public.chat_stories
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_stories'
      and policyname = 'chat_stories_select_active_authenticated'
  ) then
    create policy chat_stories_select_active_authenticated
      on public.chat_stories
      for select
      using ((expires_at > now()) and (auth.uid() is not null));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_stories'
      and policyname = 'chat_stories_update_owner'
  ) then
    create policy chat_stories_update_owner
      on public.chat_stories
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_stories'
      and policyname = 'chat_stories_delete_owner'
  ) then
    create policy chat_stories_delete_owner
      on public.chat_stories
      for delete
      using (user_id = auth.uid());
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('chat-stories', 'chat-stories', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'chat_stories_storage_insert_own'
  ) then
    create policy chat_stories_storage_insert_own
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'chat-stories'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'chat_stories_storage_update_own'
  ) then
    create policy chat_stories_storage_update_own
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'chat-stories'
        and split_part(name, '/', 1) = auth.uid()::text
      )
      with check (
        bucket_id = 'chat-stories'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'chat_stories_storage_delete_own'
  ) then
    create policy chat_stories_storage_delete_own
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'chat-stories'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'chat_stories_storage_select_authenticated'
  ) then
    create policy chat_stories_storage_select_authenticated
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'chat-stories');
  end if;
end $$;
