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
