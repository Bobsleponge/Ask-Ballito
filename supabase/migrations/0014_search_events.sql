-- Append-only search events for trending questions on the homepage.

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null references public.cities (slug) on delete cascade,
  query_raw text not null,
  query_norm text not null,
  query_hash text not null,
  user_id uuid null references auth.users (id) on delete set null,
  session_id text null,
  source text not null default 'chat',
  created_at timestamptz not null default now()
);

create index if not exists search_events_city_created_idx
  on public.search_events (city_slug, created_at desc);

create index if not exists search_events_city_hash_created_idx
  on public.search_events (city_slug, query_hash, created_at desc);

alter table public.search_events enable row level security;

-- Public reads are via API (service role / anon aggregate). No direct client writes.
revoke all on table public.search_events from anon, authenticated;
grant select, insert on table public.search_events to service_role;

-- Optional rollup table for fast reads (populated on demand or by future cron).
create table if not exists public.trending_queries (
  city_slug text not null references public.cities (slug) on delete cascade,
  query_norm text not null,
  display_text text not null,
  hit_count int not null default 0,
  window_start timestamptz not null,
  window_end timestamptz not null,
  primary key (city_slug, query_norm, window_start)
);

alter table public.trending_queries enable row level security;

revoke all on table public.trending_queries from anon, authenticated;
grant select, insert, update, delete on table public.trending_queries to service_role;
