-- P4: Places + city FAQs (Ballito curated knowledge leaves TypeScript).

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null references public.cities (slug),
  place_kind text not null check (place_kind in (
    'beach', 'park', 'trail', 'estate', 'mall', 'landmark',
    'school', 'emergency', 'nature', 'other'
  )),
  slug text not null,
  title text not null,
  summary text,
  lat double precision,
  lng double precision,
  location geography(Point, 4326),
  props jsonb not null default '{}'::jsonb,
  field_meta jsonb not null default '{}'::jsonb,
  popularity_score real not null default 0,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  search_tsv tsvector,
  embedding vector(1536),
  embedding_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_slug, slug)
);

create index if not exists places_city_kind_idx
  on public.places (city_slug, place_kind)
  where status = 'published';

create index if not exists places_location_idx
  on public.places using gist (location);

create index if not exists places_search_tsv_gin
  on public.places using gin (search_tsv);

create or replace function public.places_sync()
returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  end if;
  new.search_tsv :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.place_kind, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.embedding_text, '')), 'D');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists places_sync_trigger on public.places;
create trigger places_sync_trigger
  before insert or update on public.places
  for each row execute function public.places_sync();

create table if not exists public.city_faqs (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null references public.cities (slug),
  slug text not null,
  match_patterns text[] not null default '{}',
  question text not null,
  answer text not null,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_slug, slug)
);

create index if not exists city_faqs_city_idx
  on public.city_faqs (city_slug)
  where status = 'published';

alter table public.places enable row level security;
alter table public.city_faqs enable row level security;

create policy places_public_read on public.places
  for select to anon, authenticated using (status = 'published');

create policy city_faqs_public_read on public.city_faqs
  for select to anon, authenticated using (status = 'published');

grant select on public.places, public.city_faqs to anon, authenticated;
grant all on public.places, public.city_faqs to service_role;

-- Seed Ballito places from former geo-references / local knowledge
insert into public.places (city_slug, place_kind, slug, title, summary, lat, lng, popularity_score) values
  ('ballito', 'landmark', 'salt-rock', 'Salt Rock', 'Coastal village north of Ballito.', -29.5035, 31.2378, 80),
  ('ballito', 'estate', 'zimbali', 'Zimbali', 'Coastal estate and resort.', -29.551, 31.205, 70),
  ('ballito', 'estate', 'simbithi', 'Simbithi', 'Eco estate west of Ballito.', -29.525, 31.195, 65),
  ('ballito', 'estate', 'elaleni', 'Elaleni', 'Coastal forest estate.', -29.518, 31.208, 60),
  ('ballito', 'beach', 'willard-beach', 'Willard Beach', 'Popular Ballito beachfront.', -29.5421, 31.2141, 90),
  ('ballito', 'beach', 'compensation-beach', 'Compensation Beach', 'Beach near Compensation.', -29.5398, 31.2165, 75),
  ('ballito', 'mall', 'ballito-junction', 'Ballito Junction', 'Major shopping centre.', -29.5342, 31.2119, 85),
  ('ballito', 'emergency', 'ballito-medical-centre', 'Ballito Medical Centre', 'Non-emergency medical enquiry — confirm hours.', -29.5387, 31.2143, 50)
on conflict (city_slug, slug) do nothing;

insert into public.city_faqs (city_slug, slug, match_patterns, question, answer) values
  ('ballito', 'what-is-ask-ballito', array['what is ask ballito'], 'What is Ask Ballito?',
   'Ask Ballito is a local AI concierge for Ballito. Ask in plain language for restaurants, things to do, places to stay, and practical local help — I find options from our local directory and explain the best fits.'),
  ('ballito', 'how-does-this-work', array['how does this work'], 'How does this work?',
   'Tell me what you need (dinner, coffee, beach day, moving here, etc.). I plan the request, search local businesses, rank the best matches, and explain why they fit.'),
  ('ballito', 'who-are-you', array['who are you'], 'Who are you?',
   'I''m Ask Ballito — your local guide for Ballito and surrounds. I search a curated business directory and help you find places and services nearby.'),
  ('ballito', 'what-can-you-help', array['what can you help with'], 'What can you help with?',
   'Restaurants and cafés, beaches and activities, accommodation, healthcare, trades (plumbers, electricians), shopping, property, and emergency contacts. Try “best breakfast” or “plumber for a burst pipe”.'),
  ('ballito', 'are-you-free', array['are you free'], 'Are you free?',
   'Yes — you can ask as a guest with a daily limit, or sign in for a higher allowance. Business owners can claim and enrich their listings for free during early access.'),
  ('ballito', 'which-areas', array['which areas do you cover'], 'Which areas do you cover?',
   'I''m focused on Ballito and nearby North Coast spots (Salt Rock, Zimbali, Compensation, and surrounds). Ask about a neighbourhood if you want results near a specific landmark.'),
  ('ballito', 'claim-business', array['how do i claim my business'], 'How do I claim my business?',
   'Open your business page or visit the business portal, start a claim, and verify ownership. Once approved you can update hours, menus, photos, and services so search stays accurate.')
on conflict (city_slug, slug) do nothing;
