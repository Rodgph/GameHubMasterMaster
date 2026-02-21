-- Chat all-in-one migration (follows + stories + groups + policy fixes + storage fixes)
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- =========================================================
-- 0) DIRECT MESSAGES TABLE
-- =========================================================
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_key text not null,
  sender_id uuid not null,
  receiver_id uuid not null,
  text text not null,
  created_at timestamptz not null default now(),
  status text not null default 'sent'
);

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
  loop
    execute format('drop policy if exists %I on public.chat_messages', p.policyname);
  end loop;
end $$;

alter table public.chat_messages
  alter column sender_id type uuid using sender_id::uuid,
  alter column receiver_id type uuid using receiver_id::uuid;

create index if not exists idx_chat_messages_conversation_created_at
  on public.chat_messages (conversation_key, created_at);

alter table public.chat_messages enable row level security;

create policy chat_messages_select_own
  on public.chat_messages
  for select
  using ((sender_id = auth.uid()) or (receiver_id = auth.uid()));

create policy chat_messages_insert_own
  on public.chat_messages
  for insert
  with check ((sender_id = auth.uid()) or (receiver_id = auth.uid()));

create policy chat_messages_update_own
  on public.chat_messages
  for update
  using ((sender_id = auth.uid()) or (receiver_id = auth.uid()))
  with check ((sender_id = auth.uid()) or (receiver_id = auth.uid()));

-- =========================================================
-- 1) FOLLOWS
-- =========================================================
create table if not exists public.chat_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index if not exists idx_chat_follows_follower_id
  on public.chat_follows (follower_id);

create index if not exists idx_chat_follows_followed_id
  on public.chat_follows (followed_id);

alter table public.chat_follows enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_follows'
      and policyname = 'chat_follows_select_own'
  ) then
    create policy chat_follows_select_own
      on public.chat_follows
      for select
      using ((follower_id = auth.uid()) or (followed_id = auth.uid()));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_follows'
      and policyname = 'chat_follows_insert_own'
  ) then
    create policy chat_follows_insert_own
      on public.chat_follows
      for insert
      with check (follower_id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_follows'
      and policyname = 'chat_follows_delete_own'
  ) then
    create policy chat_follows_delete_own
      on public.chat_follows
      for delete
      using (follower_id = auth.uid());
  end if;
end $$;

-- =========================================================
-- 2) STORIES
-- =========================================================
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

-- =========================================================
-- 3) GROUPS
-- =========================================================
create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  room_id text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text null,
  image_path text null,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.chat_group_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  schedule_at timestamptz not null,
  payload jsonb not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_groups_room_id
  on public.chat_groups (room_id);

create index if not exists idx_chat_group_members_user_id
  on public.chat_group_members (user_id);

create index if not exists idx_chat_group_members_group_id
  on public.chat_group_members (group_id);

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_schedules enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_groups' and policyname = 'chat_groups_select_members'
  ) then
    create policy chat_groups_select_members
      on public.chat_groups
      for select
      using (
        owner_id = auth.uid()
        or exists (
          select 1
          from public.chat_group_members gm
          where gm.group_id = chat_groups.id
            and gm.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_groups' and policyname = 'chat_groups_insert_owner'
  ) then
    create policy chat_groups_insert_owner
      on public.chat_groups
      for insert
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_groups' and policyname = 'chat_groups_update_owner'
  ) then
    create policy chat_groups_update_owner
      on public.chat_groups
      for update
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_groups' and policyname = 'chat_groups_delete_owner'
  ) then
    create policy chat_groups_delete_owner
      on public.chat_groups
      for delete
      using (owner_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_group_members' and policyname = 'chat_group_members_select_members'
  ) then
    create policy chat_group_members_select_members
      on public.chat_group_members
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_group_members' and policyname = 'chat_group_members_insert_owner'
  ) then
    create policy chat_group_members_insert_owner
      on public.chat_group_members
      for insert
      with check (
        exists (
          select 1
          from public.chat_groups g
          where g.id = chat_group_members.group_id
            and g.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_group_members' and policyname = 'chat_group_members_delete_owner'
  ) then
    create policy chat_group_members_delete_owner
      on public.chat_group_members
      for delete
      using (
        exists (
          select 1
          from public.chat_groups g
          where g.id = chat_group_members.group_id
            and g.owner_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_group_schedules' and policyname = 'chat_group_schedules_select_owner'
  ) then
    create policy chat_group_schedules_select_owner
      on public.chat_group_schedules
      for select
      using (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_group_schedules' and policyname = 'chat_group_schedules_insert_owner'
  ) then
    create policy chat_group_schedules_insert_owner
      on public.chat_group_schedules
      for insert
      with check (owner_id = auth.uid());
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('chat-groups', 'chat-groups', false)
on conflict (id) do nothing;

-- Storage policies (final fixed version)
drop policy if exists chat_groups_storage_insert_owner on storage.objects;
drop policy if exists chat_groups_storage_update_owner on storage.objects;
drop policy if exists chat_groups_storage_delete_owner on storage.objects;
drop policy if exists chat_groups_storage_select_members on storage.objects;

create policy chat_groups_storage_insert_owner
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-groups'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy chat_groups_storage_update_owner
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'chat-groups'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'chat-groups'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy chat_groups_storage_delete_owner
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-groups'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy chat_groups_storage_select_members
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-groups'
    and exists (
      select 1
      from public.chat_groups g
      where g.id::text = split_part(name, '/', 2)
        and (
          g.owner_id = auth.uid()
          or exists (
            select 1
            from public.chat_group_members gm
            where gm.group_id = g.id
              and gm.user_id = auth.uid()
          )
        )
    )
  );
