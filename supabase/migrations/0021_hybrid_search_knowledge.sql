-- Hybrid retrieval: Postgres FTS + pgvector RRF fusion + metadata/geo filters.
-- Vector similarity is never the sole ranking signal.

-- Full-text search document (name, category, description, services/keywords from metadata).
alter table public.businesses
  add column if not exists search_tsv tsvector;

create or replace function public.businesses_search_tsv_update()
returns trigger
language plpgsql
as $$
declare
  services_text text := '';
  keywords_text text := '';
begin
  if new.metadata is not null then
    services_text := coalesce(new.metadata->>'services', '') || ' ' ||
                     coalesce(new.metadata->>'servicesText', '');
    keywords_text := coalesce(new.metadata->>'keywords', '') || ' ' ||
                     coalesce(new.metadata->>'searchKeywords', '');
    if jsonb_typeof(new.metadata->'services') = 'array' then
      select coalesce(string_agg(value::text, ' '), '')
        into services_text
        from jsonb_array_elements_text(new.metadata->'services') as t(value);
    end if;
    if jsonb_typeof(new.metadata->'keywords') = 'array' then
      select coalesce(string_agg(value::text, ' '), '')
        into keywords_text
        from jsonb_array_elements_text(new.metadata->'keywords') as t(value);
    end if;
  end if;

  new.search_tsv :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.category, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.categories, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(services_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(keywords_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.embedding_text, '')), 'D');
  return new;
end;
$$;

drop trigger if exists trg_businesses_search_tsv on public.businesses;
create trigger trg_businesses_search_tsv
  before insert or update of name, category, categories, description, metadata, embedding_text
  on public.businesses
  for each row
  execute function public.businesses_search_tsv_update();

-- Backfill existing rows
update public.businesses set name = name where search_tsv is null;

create index if not exists businesses_search_tsv_gin
  on public.businesses using gin (search_tsv);

-- Knowledge cards for common local discovery asks
create table if not exists public.knowledge_cards (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null references public.cities(slug),
  slug text not null,
  title text not null,
  query_class text not null default 'DISCOVERY',
  match_patterns text[] not null default '{}',
  search_queries text[] not null default '{}',
  business_ids uuid[] not null default '{}',
  body_md text not null default '',
  content_hash text,
  version integer not null default 1,
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_slug, slug)
);

create index if not exists knowledge_cards_city_idx
  on public.knowledge_cards (city_slug);

alter table public.knowledge_cards enable row level security;

create policy knowledge_cards_public_read
  on public.knowledge_cards
  for select
  to anon, authenticated
  using (true);

-- Hybrid match RPC: RRF fusion of FTS + vector, with optional filters.
create or replace function public.hybrid_match_businesses(
  p_city_slug          text,
  query_embedding      vector(1536),
  query_text           text,
  match_count          int default 30,
  similarity_threshold float default 0.12,
  p_category           text default null,
  p_lat                double precision default null,
  p_lng                double precision default null,
  p_radius_meters      double precision default null,
  p_min_rating         double precision default null,
  p_min_rating_count   integer default null,
  p_verified_only      boolean default false
)
returns table (
  id           uuid,
  name         text,
  category     text,
  description  text,
  address      text,
  website      text,
  phone        text,
  rating       double precision,
  rating_count integer,
  price_level  integer,
  lat          double precision,
  lng          double precision,
  photos       jsonb,
  metadata     jsonb,
  similarity   float,
  fts_rank     float,
  fused_score  float
)
language sql
stable
security definer
set search_path = public
as $$
  with
  params as (
    select
      least(greatest(coalesce(match_count, 30), 1), 50) as lim,
      plainto_tsquery('english', coalesce(nullif(trim(query_text), ''), 'ballito')) as tsq
  ),
  vector_hits as (
    select
      b.id,
      1 - (b.embedding <=> query_embedding) as similarity,
      row_number() over (order by b.embedding <=> query_embedding) as vec_rank
    from public.businesses b, params p
    where b.city_slug = p_city_slug
      and b.embedding is not null
      and (p_category is null or b.category = p_category)
      and 1 - (b.embedding <=> query_embedding) >= similarity_threshold
      and (p_min_rating is null or coalesce(b.rating, 0) >= p_min_rating)
      and (p_min_rating_count is null or coalesce(b.rating_count, 0) >= p_min_rating_count)
      and (
        not coalesce(p_verified_only, false)
        or coalesce((b.metadata->>'portalClaimed')::boolean, false) = true
        or coalesce((b.metadata->>'ownerProfileComplete')::boolean, false) = true
      )
      and (
        p_lat is null or p_lng is null or p_radius_meters is null
        or b.location is null
        or ST_DWithin(
          b.location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius_meters
        )
      )
    order by b.embedding <=> query_embedding
    limit (select lim from params) * 2
  ),
  fts_hits as (
    select
      b.id,
      ts_rank_cd(b.search_tsv, p.tsq) as fts_rank,
      row_number() over (order by ts_rank_cd(b.search_tsv, p.tsq) desc) as fts_rn
    from public.businesses b, params p
    where b.city_slug = p_city_slug
      and b.search_tsv is not null
      and b.search_tsv @@ p.tsq
      and (p_category is null or b.category = p_category)
      and (p_min_rating is null or coalesce(b.rating, 0) >= p_min_rating)
      and (p_min_rating_count is null or coalesce(b.rating_count, 0) >= p_min_rating_count)
      and (
        not coalesce(p_verified_only, false)
        or coalesce((b.metadata->>'portalClaimed')::boolean, false) = true
        or coalesce((b.metadata->>'ownerProfileComplete')::boolean, false) = true
      )
      and (
        p_lat is null or p_lng is null or p_radius_meters is null
        or b.location is null
        or ST_DWithin(
          b.location::geography,
          ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
          p_radius_meters
        )
      )
    order by ts_rank_cd(b.search_tsv, p.tsq) desc
    limit (select lim from params) * 2
  ),
  fused as (
    select
      coalesce(v.id, f.id) as id,
      coalesce(v.similarity, 0.15::float) as similarity,
      coalesce(f.fts_rank, 0::float) as fts_rank,
      (
        coalesce(1.0 / (60 + v.vec_rank), 0) +
        coalesce(1.0 / (60 + f.fts_rn), 0)
      )::float as fused_score
    from vector_hits v
    full outer join fts_hits f on v.id = f.id
  )
  select
    b.id,
    b.name,
    b.category,
    b.description,
    b.address,
    b.website,
    b.phone,
    b.rating,
    b.rating_count,
    b.price_level,
    b.lat,
    b.lng,
    b.photos,
    b.metadata,
    f.similarity,
    f.fts_rank,
    f.fused_score
  from fused f
  join public.businesses b on b.id = f.id
  where coalesce((b.metadata->>'seeded')::boolean, false) is not true
  order by f.fused_score desc, f.similarity desc
  limit (select lim from params);
$$;

revoke all on function public.hybrid_match_businesses(
  text, vector, text, int, float, text, double precision, double precision,
  double precision, double precision, integer, boolean
) from public;

grant execute on function public.hybrid_match_businesses(
  text, vector, text, int, float, text, double precision, double precision,
  double precision, double precision, integer, boolean
) to service_role;
