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

-- =========================================================
-- 4) CHAT PRODUCTION SCHEMA (MESSAGES + MEDIA + READS)
-- =========================================================

create table if not exists public.chat_dm_rooms (
  room_id text primary key,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);

create unique index if not exists uq_chat_dm_rooms_pair
  on public.chat_dm_rooms (least(user_a, user_b), greatest(user_a, user_b));

alter table public.chat_messages
  add column if not exists room_id text,
  add column if not exists type text,
  add column if not exists body_text text,
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_size int,
  add column if not exists audio_duration_ms int,
  add column if not exists reply_to_ids uuid[],
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_for_all boolean not null default false;

update public.chat_messages
set room_id = conversation_key
where room_id is null and conversation_key is not null;

update public.chat_messages
set body_text = text
where body_text is null and text is not null;

update public.chat_messages
set type = 'text'
where type is null;

alter table public.chat_messages
  alter column room_id set not null,
  alter column sender_id set not null,
  alter column type set not null;

-- Legacy columns kept for backward compatibility: make them optional
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'conversation_key'
      and is_nullable = 'NO'
  ) then
    alter table public.chat_messages
      alter column conversation_key drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'receiver_id'
      and is_nullable = 'NO'
  ) then
    alter table public.chat_messages
      alter column receiver_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'text'
      and is_nullable = 'NO'
  ) then
    alter table public.chat_messages
      alter column text drop not null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_type_check'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_type_check check (type in ('text', 'image', 'audio', 'file'));
  end if;
end $$;

create index if not exists idx_chat_messages_room_created_at
  on public.chat_messages (room_id, created_at);

create index if not exists idx_chat_messages_sender_id
  on public.chat_messages (sender_id);

create index if not exists idx_chat_messages_room_deleted_for_all
  on public.chat_messages (room_id, deleted_for_all);

create table if not exists public.chat_message_edits (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  room_id text not null,
  editor_id uuid not null references auth.users(id) on delete cascade,
  previous_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_message_edits_message_id
  on public.chat_message_edits (message_id, created_at desc);

create table if not exists public.chat_message_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create table if not exists public.chat_message_pins (
  room_id text not null,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, message_id)
);

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  room_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists idx_chat_message_reactions_message_id
  on public.chat_message_reactions (message_id);

create index if not exists idx_chat_message_reactions_room_id
  on public.chat_message_reactions (room_id);

create table if not exists public.chat_room_reads (
  room_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.chat_message_deletes (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  room_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create or replace function public.chat_is_room_member(p_room_id text, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.chat_dm_rooms dm
      where dm.room_id = p_room_id
        and (dm.user_a = p_user_id or dm.user_b = p_user_id)
    )
    or exists (
      select 1
      from public.chat_groups g
      where g.room_id = p_room_id
        and (
          g.owner_id = p_user_id
          or exists (
            select 1
            from public.chat_group_members gm
            where gm.group_id = g.id
              and gm.user_id = p_user_id
          )
        )
    );
$$;

alter table public.chat_dm_rooms enable row level security;
alter table public.chat_message_edits enable row level security;
alter table public.chat_message_favorites enable row level security;
alter table public.chat_message_pins enable row level security;
alter table public.chat_message_reactions enable row level security;
alter table public.chat_room_reads enable row level security;
alter table public.chat_message_deletes enable row level security;

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

create policy chat_messages_select_member
  on public.chat_messages
  for select
  using (public.chat_is_room_member(room_id, auth.uid()));

create policy chat_messages_insert_member_sender
  on public.chat_messages
  for insert
  with check (
    sender_id = auth.uid()
    and public.chat_is_room_member(room_id, auth.uid())
  );

create policy chat_messages_update_sender_only
  on public.chat_messages
  for update
  using (
    sender_id = auth.uid()
    and public.chat_is_room_member(room_id, auth.uid())
  )
  with check (
    sender_id = auth.uid()
    and public.chat_is_room_member(room_id, auth.uid())
  );

create policy chat_messages_delete_sender_or_group_owner
  on public.chat_messages
  for delete
  using (
    public.chat_is_room_member(room_id, auth.uid())
    and (
      sender_id = auth.uid()
      or exists (
        select 1
        from public.chat_groups g
        where g.room_id = chat_messages.room_id
          and g.owner_id = auth.uid()
      )
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_dm_rooms' and policyname = 'chat_dm_rooms_select_member'
  ) then
    create policy chat_dm_rooms_select_member
      on public.chat_dm_rooms
      for select
      using (user_a = auth.uid() or user_b = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_dm_rooms' and policyname = 'chat_dm_rooms_insert_member'
  ) then
    create policy chat_dm_rooms_insert_member
      on public.chat_dm_rooms
      for insert
      with check (user_a = auth.uid() or user_b = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_dm_rooms' and policyname = 'chat_dm_rooms_update_member'
  ) then
    create policy chat_dm_rooms_update_member
      on public.chat_dm_rooms
      for update
      using (user_a = auth.uid() or user_b = auth.uid())
      with check (user_a = auth.uid() or user_b = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_dm_rooms' and policyname = 'chat_dm_rooms_delete_member'
  ) then
    create policy chat_dm_rooms_delete_member
      on public.chat_dm_rooms
      for delete
      using (user_a = auth.uid() or user_b = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_edits' and policyname = 'chat_message_edits_select_member'
  ) then
    create policy chat_message_edits_select_member
      on public.chat_message_edits
      for select
      using (public.chat_is_room_member(room_id, auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_edits' and policyname = 'chat_message_edits_insert_editor'
  ) then
    create policy chat_message_edits_insert_editor
      on public.chat_message_edits
      for insert
      with check (
        editor_id = auth.uid()
        and public.chat_is_room_member(room_id, auth.uid())
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_favorites' and policyname = 'chat_message_favorites_select_own'
  ) then
    create policy chat_message_favorites_select_own
      on public.chat_message_favorites
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_favorites' and policyname = 'chat_message_favorites_insert_own'
  ) then
    create policy chat_message_favorites_insert_own
      on public.chat_message_favorites
      for insert
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_favorites' and policyname = 'chat_message_favorites_delete_own'
  ) then
    create policy chat_message_favorites_delete_own
      on public.chat_message_favorites
      for delete
      using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_pins' and policyname = 'chat_message_pins_select_member'
  ) then
    create policy chat_message_pins_select_member
      on public.chat_message_pins
      for select
      using (public.chat_is_room_member(room_id, auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_pins' and policyname = 'chat_message_pins_insert_member'
  ) then
    create policy chat_message_pins_insert_member
      on public.chat_message_pins
      for insert
      with check (
        pinned_by = auth.uid()
        and public.chat_is_room_member(room_id, auth.uid())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_pins' and policyname = 'chat_message_pins_delete_member'
  ) then
    create policy chat_message_pins_delete_member
      on public.chat_message_pins
      for delete
      using (public.chat_is_room_member(room_id, auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_reactions' and policyname = 'chat_message_reactions_select_member'
  ) then
    create policy chat_message_reactions_select_member
      on public.chat_message_reactions
      for select
      using (public.chat_is_room_member(room_id, auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_reactions' and policyname = 'chat_message_reactions_insert_own'
  ) then
    create policy chat_message_reactions_insert_own
      on public.chat_message_reactions
      for insert
      with check (user_id = auth.uid() and public.chat_is_room_member(room_id, auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_reactions' and policyname = 'chat_message_reactions_delete_own'
  ) then
    create policy chat_message_reactions_delete_own
      on public.chat_message_reactions
      for delete
      using (user_id = auth.uid() and public.chat_is_room_member(room_id, auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_room_reads' and policyname = 'chat_room_reads_select_own'
  ) then
    create policy chat_room_reads_select_own
      on public.chat_room_reads
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_room_reads' and policyname = 'chat_room_reads_insert_own'
  ) then
    create policy chat_room_reads_insert_own
      on public.chat_room_reads
      for insert
      with check (user_id = auth.uid() and public.chat_is_room_member(room_id, auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_room_reads' and policyname = 'chat_room_reads_update_own'
  ) then
    create policy chat_room_reads_update_own
      on public.chat_room_reads
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_deletes' and policyname = 'chat_message_deletes_select_own'
  ) then
    create policy chat_message_deletes_select_own
      on public.chat_message_deletes
      for select
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_deletes' and policyname = 'chat_message_deletes_insert_own'
  ) then
    create policy chat_message_deletes_insert_own
      on public.chat_message_deletes
      for insert
      with check (user_id = auth.uid() and public.chat_is_room_member(room_id, auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_message_deletes' and policyname = 'chat_message_deletes_delete_own'
  ) then
    create policy chat_message_deletes_delete_own
      on public.chat_message_deletes
      for delete
      using (user_id = auth.uid());
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

drop policy if exists chat_media_storage_insert_owner on storage.objects;
drop policy if exists chat_media_storage_update_owner on storage.objects;
drop policy if exists chat_media_storage_delete_owner on storage.objects;
drop policy if exists chat_media_storage_select_members on storage.objects;

create policy chat_media_storage_insert_owner
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-media'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy chat_media_storage_update_owner
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'chat-media'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'chat-media'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy chat_media_storage_delete_owner
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-media'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy chat_media_storage_select_members
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and public.chat_is_room_member(split_part(name, '/', 2), auth.uid())
  );
