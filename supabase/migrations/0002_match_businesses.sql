-- Semantic search over businesses using pgvector cosine distance.
-- Metadata/distance re-ranking is applied in the application layer
-- (BusinessSearchService) on top of these vector-similarity candidates.

create or replace function public.match_businesses(
  p_city_slug          text,
  query_embedding      vector(1536),
  match_count          int default 10,
  similarity_threshold float default 0.0,
  p_category           text default null
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
  similarity   float
)
language sql
stable
as $$
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
    1 - (b.embedding <=> query_embedding) as similarity
  from public.businesses b
  where b.city_slug = p_city_slug
    and b.embedding is not null
    and (p_category is null or b.category = p_category)
    and 1 - (b.embedding <=> query_embedding) >= similarity_threshold
  order by b.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_businesses(text, vector, int, float, text)
  to anon, authenticated, service_role;
