-- Row Level Security policies.
-- The service-role client bypasses RLS and is used for ingestion + ai_logs.

alter table public.cities        enable row level security;
alter table public.profiles      enable row level security;
alter table public.businesses    enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.ai_logs       enable row level security;

-- cities: world-readable.
drop policy if exists "cities_read" on public.cities;
create policy "cities_read" on public.cities
  for select using (true);

-- businesses: world-readable. Writes happen via service role only (no policy).
drop policy if exists "businesses_read" on public.businesses;
create policy "businesses_read" on public.businesses
  for select using (true);

-- profiles: owner can read/update their own row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- conversations: owner-scoped CRUD.
drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own" on public.conversations
  for select using (auth.uid() = user_id);

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own" on public.conversations
  for insert with check (auth.uid() = user_id);

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own" on public.conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own" on public.conversations
  for delete using (auth.uid() = user_id);

-- messages: accessible only through conversations the user owns.
drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ai_logs: locked down. RLS is enabled with no policies, so only the
-- service-role client (which bypasses RLS) can read or write.
