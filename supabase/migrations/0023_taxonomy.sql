-- Knowledge Engine P2: extensible taxonomy (dimensions + terms + listing links).

create table if not exists public.taxonomy_dimensions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  multi_value boolean not null default true,
  applies_to text[] not null default '{business,place,event}',
  created_at timestamptz not null default now()
);

create table if not exists public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  dimension_id uuid not null references public.taxonomy_dimensions (id) on delete cascade,
  slug text not null,
  label text not null,
  parent_id uuid references public.taxonomy_terms (id) on delete set null,
  synonyms text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (dimension_id, slug)
);

create index if not exists taxonomy_terms_dimension_idx
  on public.taxonomy_terms (dimension_id);

create index if not exists taxonomy_terms_synonyms_gin
  on public.taxonomy_terms using gin (synonyms);

create table if not exists public.listing_terms (
  id uuid primary key default gen_random_uuid(),
  listing_kind text not null check (listing_kind in ('business', 'place', 'event')),
  listing_id uuid not null,
  term_id uuid not null references public.taxonomy_terms (id) on delete cascade,
  confidence real not null default 0.7 check (confidence >= 0 and confidence <= 1),
  source text not null default 'heuristic',
  verified_at timestamptz,
  verification_method text not null default 'heuristic',
  created_at timestamptz not null default now(),
  unique (listing_kind, listing_id, term_id)
);

create index if not exists listing_terms_listing_idx
  on public.listing_terms (listing_kind, listing_id);

create index if not exists listing_terms_term_idx
  on public.listing_terms (term_id);

alter table public.taxonomy_dimensions enable row level security;
alter table public.taxonomy_terms enable row level security;
alter table public.listing_terms enable row level security;

create policy taxonomy_dimensions_public_read
  on public.taxonomy_dimensions for select to anon, authenticated using (true);

create policy taxonomy_terms_public_read
  on public.taxonomy_terms for select to anon, authenticated using (true);

create policy listing_terms_public_read
  on public.listing_terms for select to anon, authenticated using (true);

grant select on public.taxonomy_dimensions, public.taxonomy_terms, public.listing_terms
  to anon, authenticated;
grant all on public.taxonomy_dimensions, public.taxonomy_terms, public.listing_terms
  to service_role;

-- Seed core dimensions
insert into public.taxonomy_dimensions (slug, label, multi_value, applies_to) values
  ('business_type', 'Business Type', true, '{business}'),
  ('cuisine', 'Cuisine', true, '{business}'),
  ('services', 'Services', true, '{business}'),
  ('experience', 'Experience', true, '{business,place,event}'),
  ('atmosphere', 'Atmosphere', true, '{business,place}'),
  ('audience', 'Audience', true, '{business,place,event}'),
  ('activities', 'Activities', true, '{business,place,event}'),
  ('amenities', 'Amenities', true, '{business,place}'),
  ('accessibility', 'Accessibility', true, '{business,place}'),
  ('dietary', 'Dietary', true, '{business}'),
  ('price', 'Price', false, '{business,place,event}'),
  ('nightlife', 'Nightlife', true, '{business}'),
  ('health', 'Health', true, '{business}'),
  ('fitness', 'Fitness', true, '{business,place}'),
  ('nature', 'Nature', true, '{place}'),
  ('water', 'Water Activities', true, '{place,business}'),
  ('shopping', 'Shopping', true, '{business,place}'),
  ('professional', 'Professional Services', true, '{business}'),
  ('transport', 'Transport', true, '{business}'),
  ('emergency', 'Emergency', true, '{business,place}'),
  ('tourism', 'Tourism', true, '{business,place,event}'),
  ('weather_fit', 'Weather Fit', true, '{business,place,event}'),
  ('accommodation', 'Accommodation', true, '{business}')
on conflict (slug) do nothing;

-- Helper: insert term if dimension exists
create or replace function public._seed_term(
  p_dim text, p_slug text, p_label text, p_synonyms text[] default '{}'
) returns void
language plpgsql as $$
declare
  dim_id uuid;
begin
  select id into dim_id from public.taxonomy_dimensions where slug = p_dim;
  if dim_id is null then return; end if;
  insert into public.taxonomy_terms (dimension_id, slug, label, synonyms)
  values (dim_id, p_slug, p_label, p_synonyms)
  on conflict (dimension_id, slug) do nothing;
end;
$$;

select public._seed_term('amenities', 'wifi', 'Wi‑Fi', array['wifi','wi-fi','internet']);
select public._seed_term('amenities', 'parking', 'Parking', array['parking','park']);
select public._seed_term('amenities', 'outdoor_seating', 'Outdoor seating', array['outdoor','patio','garden']);
select public._seed_term('amenities', 'ocean_view', 'Ocean view', array['sea view','ocean view','seaview']);
select public._seed_term('amenities', 'kids_area', 'Kids area', array['kids play','play area']);
select public._seed_term('amenities', 'power_backup', 'Power backup', array['generator','inverter','load shedding']);
select public._seed_term('audience', 'family', 'Family', array['family friendly','kids','children']);
select public._seed_term('audience', 'pets', 'Pet friendly', array['dog friendly','pet friendly','dogs welcome']);
select public._seed_term('audience', 'couples', 'Couples', array['romantic','date night']);
select public._seed_term('audience', 'kids', 'Kids', array['children','child friendly']);
select public._seed_term('experience', 'romantic', 'Romantic', array['date night','anniversary']);
select public._seed_term('experience', 'remote_work', 'Remote work', array['laptop friendly','coworking','work cafe']);
select public._seed_term('experience', 'rainy_day', 'Rainy day', array['indoor','wet weather']);
select public._seed_term('experience', 'celebration', 'Celebration', array['birthday','party']);
select public._seed_term('atmosphere', 'quiet', 'Quiet', array['peaceful','calm']);
select public._seed_term('atmosphere', 'lively', 'Lively', array['buzzing','busy']);
select public._seed_term('atmosphere', 'casual', 'Casual', '{}');
select public._seed_term('atmosphere', 'luxury', 'Luxury', array['upscale','fine dining']);
select public._seed_term('weather_fit', 'indoor', 'Indoor', array['covered','aircon']);
select public._seed_term('weather_fit', 'outdoor', 'Outdoor', array['outside','al fresco']);
select public._seed_term('weather_fit', 'rain_friendly', 'Rain friendly', array['rainy day','indoor']);
select public._seed_term('accessibility', 'wheelchair', 'Wheelchair accessible', array['wheelchair','disabled access']);
select public._seed_term('dietary', 'vegan', 'Vegan options', array['vegan','plant based']);
select public._seed_term('dietary', 'halal', 'Halal options', array['halal']);
select public._seed_term('price', 'budget', 'Budget', array['cheap','affordable']);
select public._seed_term('price', 'mid', 'Mid-range', array['moderate']);
select public._seed_term('price', 'upscale', 'Upscale', array['fine','expensive']);
select public._seed_term('price', 'luxury', 'Luxury', array['premium']);
select public._seed_term('cuisine', 'sushi', 'Sushi', array['japanese','sashimi']);
select public._seed_term('cuisine', 'italian', 'Italian', array['pasta','pizza']);
select public._seed_term('cuisine', 'seafood', 'Seafood', array['fish','prawns']);
select public._seed_term('nightlife', 'cocktails', 'Cocktails', array['cocktail bar']);
select public._seed_term('nightlife', 'live_music', 'Live music', array['band','live band']);
select public._seed_term('nightlife', 'late_night', 'Late night', array['open late','after hours']);
select public._seed_term('nature', 'beach', 'Beach', array['beaches','swim']);
select public._seed_term('nature', 'park', 'Park', array['parks','garden']);
select public._seed_term('nature', 'trail', 'Trail', array['hike','hiking']);
select public._seed_term('water', 'surf', 'Surf', array['surfing','waves']);
select public._seed_term('water', 'swim', 'Swim', array['swimming']);
select public._seed_term('shopping', 'mall', 'Shopping centre', array['mall','shopping center']);
select public._seed_term('emergency', 'after_hours', 'After hours', array['24 hour','24hr','emergency callout']);
select public._seed_term('business_type', 'restaurant', 'Restaurant', array['restaurants','dining']);
select public._seed_term('business_type', 'cafe', 'Café', array['coffee','cafes','coffee shop']);
select public._seed_term('business_type', 'hotel', 'Hotel', array['hotels','stay']);
select public._seed_term('accommodation', 'bnb', 'B&B', array['bed and breakfast','guest house']);
select public._seed_term('fitness', 'gym', 'Gym', array['fitness','workout']);

drop function if exists public._seed_term(text, text, text, text[]);
