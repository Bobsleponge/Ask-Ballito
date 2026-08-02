-- P5: Minimal listing relations (LOCATED_IN, PART_OF, HOSTS only).

create table if not exists public.listing_relations (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null references public.cities (slug),
  subject_kind text not null check (subject_kind in ('business', 'place', 'event')),
  subject_id uuid not null,
  predicate text not null check (predicate in ('LOCATED_IN', 'PART_OF', 'HOSTS')),
  object_kind text not null check (object_kind in ('business', 'place', 'event')),
  object_id uuid not null,
  confidence real not null default 0.7 check (confidence >= 0 and confidence <= 1),
  source text not null default 'heuristic',
  verified_at timestamptz,
  verification_method text not null default 'heuristic',
  created_at timestamptz not null default now(),
  unique (subject_kind, subject_id, predicate, object_kind, object_id)
);

create index if not exists listing_relations_subject_idx
  on public.listing_relations (subject_kind, subject_id, predicate);

create index if not exists listing_relations_object_idx
  on public.listing_relations (object_kind, object_id, predicate);

create index if not exists listing_relations_city_idx
  on public.listing_relations (city_slug);

alter table public.listing_relations enable row level security;

create policy listing_relations_public_read
  on public.listing_relations for select to anon, authenticated using (true);

grant select on public.listing_relations to anon, authenticated;
grant all on public.listing_relations to service_role;

-- Seed: link city_events venues to places by name where possible
insert into public.listing_relations (
  city_slug, subject_kind, subject_id, predicate, object_kind, object_id,
  confidence, source, verified_at, verification_method
)
select
  e.city_slug,
  'event',
  e.id,
  'HOSTS',
  'place',
  p.id,
  0.7,
  'heuristic',
  now(),
  'heuristic'
from public.city_events e
join public.places p
  on p.city_slug = e.city_slug
 and (
   lower(coalesce(e.venue_name, '')) like '%' || lower(p.title) || '%'
   or lower(coalesce(e.address, '')) like '%' || lower(p.title) || '%'
 )
where e.city_slug = 'ballito'
on conflict do nothing;
