create extension if not exists pgcrypto;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_key text not null,
  sender_id text not null,
  receiver_id text not null,
  text text not null,
  created_at timestamptz not null default now(),
  status text not null default 'sent'
);

create index if not exists idx_chat_messages_conversation_created_at
  on public.chat_messages (conversation_key, created_at);

alter table public.chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'chat_messages_select_own'
  ) then
    create policy chat_messages_select_own
      on public.chat_messages
      for select
      using ((sender_id = auth.uid()::text) or (receiver_id = auth.uid()::text));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'chat_messages_insert_own'
  ) then
    create policy chat_messages_insert_own
      on public.chat_messages
      for insert
      with check ((sender_id = auth.uid()::text) or (receiver_id = auth.uid()::text));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'chat_messages_update_own'
  ) then
    create policy chat_messages_update_own
      on public.chat_messages
      for update
      using ((sender_id = auth.uid()::text) or (receiver_id = auth.uid()::text))
      with check ((sender_id = auth.uid()::text) or (receiver_id = auth.uid()::text));
  end if;
end $$;
