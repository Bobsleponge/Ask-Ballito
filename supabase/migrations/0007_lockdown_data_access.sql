-- Lock down public data access: hide embeddings, revoke public vector RPC,
-- prevent client-inserted system messages, protect profile identity columns.

-- ---------------------------------------------------------------------------
-- match_businesses: app uses service_role only; revoke anon/authenticated.
-- ---------------------------------------------------------------------------
revoke execute on function public.match_businesses(text, vector, int, float, text)
  from anon, authenticated;

grant execute on function public.match_businesses(text, vector, int, float, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- businesses: column-level SELECT — no embedding / embedding_text for clients.
-- ---------------------------------------------------------------------------
revoke select on table public.businesses from anon, authenticated;

grant select (
  id,
  provider,
  external_id,
  city_slug,
  name,
  category,
  categories,
  description,
  address,
  phone,
  website,
  rating,
  rating_count,
  price_level,
  lat,
  lng,
  location,
  photos,
  metadata,
  created_at,
  updated_at
) on table public.businesses to anon, authenticated;

-- service_role keeps full access (from 0005_grants).
grant select on table public.businesses to service_role;

-- ---------------------------------------------------------------------------
-- messages: clients may only insert user | assistant (not system).
-- ---------------------------------------------------------------------------
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages
  for insert with check (
    role in ('user', 'assistant')
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: block client overwrites of email / id via trigger.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_protect_identity()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity_trigger on public.profiles;
create trigger profiles_protect_identity_trigger
  before update on public.profiles
  for each row execute function public.profiles_protect_identity();
