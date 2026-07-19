-- Ask Ballito - initial schema
-- Extensions: pgvector for embeddings, postgis for geospatial queries.

create extension if not exists vector;
create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- cities (mirrors src/config/cities.ts; city is data)
-- ---------------------------------------------------------------------------
create table if not exists public.cities (
  slug        text primary key,
  name        text not null,
  region      text,
  country     text default 'South Africa',
  center_lat  double precision,
  center_lng  double precision,
  enabled     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Create a profile row automatically when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- businesses (provider-agnostic, with embedding for semantic search)
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,
  external_id    text,
  city_slug      text not null references public.cities (slug),
  name           text not null,
  category       text,
  categories     text[] not null default '{}',
  description    text,
  address        text,
  phone          text,
  website        text,
  rating         double precision,
  rating_count   integer,
  price_level    integer,
  lat            double precision,
  lng            double precision,
  location       geography(Point, 4326),
  photos         jsonb not null default '[]'::jsonb,
  metadata       jsonb not null default '{}'::jsonb,
  embedding      vector(1536),
  embedding_text text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (provider, external_id)
);

create index if not exists businesses_city_idx on public.businesses (city_slug);
create index if not exists businesses_category_idx on public.businesses (category);
create index if not exists businesses_metadata_idx on public.businesses using gin (metadata);
create index if not exists businesses_location_idx on public.businesses using gist (location);
create index if not exists businesses_embedding_idx
  on public.businesses using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Keep the geography column and updated_at in sync.
create or replace function public.businesses_sync()
returns trigger
language plpgsql
as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists businesses_sync_trigger on public.businesses;
create trigger businesses_sync_trigger
  before insert or update on public.businesses
  for each row execute function public.businesses_sync();

-- ---------------------------------------------------------------------------
-- conversations + messages
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  city_slug   text references public.cities (slug),
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversations_user_idx on public.conversations (user_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id);

-- ---------------------------------------------------------------------------
-- ai_logs (every AI call is logged here)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,
  conversation_id uuid,
  service         text not null,
  prompt_version  text,
  model           text,
  input           jsonb not null default '{}'::jsonb,
  output          jsonb not null default '{}'::jsonb,
  input_tokens    integer,
  output_tokens   integer,
  latency_ms      integer,
  status          text not null default 'success',
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists ai_logs_service_idx on public.ai_logs (service);
create index if not exists ai_logs_created_idx on public.ai_logs (created_at desc);
