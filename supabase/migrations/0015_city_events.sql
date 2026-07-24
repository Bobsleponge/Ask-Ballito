-- City calendar events for the homepage "Nearby events" strip.

create table if not exists public.city_events (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null references public.cities (slug) on delete cascade,
  title text not null,
  description text null,
  venue_name text null,
  address text null,
  lat double precision null,
  lng double precision null,
  starts_at timestamptz not null,
  ends_at timestamptz null,
  url text null,
  source text not null default 'admin',
  external_id text null,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists city_events_city_starts_idx
  on public.city_events (city_slug, starts_at)
  where status = 'published';

alter table public.city_events enable row level security;

-- Anyone can read published upcoming events; writes are service_role / admin only.
create policy "city_events_select_published"
  on public.city_events
  for select
  to anon, authenticated
  using (status = 'published');

grant select on table public.city_events to anon, authenticated;
grant select, insert, update, delete on table public.city_events to service_role;

-- Seed a handful of Ballito lifestyle events (relative to migration time + fixed seasonal-ish dates).
insert into public.city_events (
  city_slug, title, description, venue_name, address, starts_at, ends_at, url, source, status
) values
  (
    'ballito',
    'Ballito Farmers Market',
    'Fresh produce, artisan goods, and local food stalls.',
    'Ballito Lifestyle Centre',
    'Ballito Drive, Ballito',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '6 days' + time '08:00',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '6 days' + time '13:00',
    null,
    'admin',
    'published'
  ),
  (
    'ballito',
    'Sunset Yoga on the Beach',
    'Beginner-friendly yoga session with ocean views.',
    'Willard Beach',
    'Ballito Beachfront',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '3 days' + time '17:00',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '3 days' + time '18:15',
    null,
    'admin',
    'published'
  ),
  (
    'ballito',
    'Live Music at Salt Rock',
    'Local bands and sundowners along the coast.',
    'Salt Rock Beach Bar',
    'Salt Rock',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '5 days' + time '18:30',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '5 days' + time '22:00',
    null,
    'admin',
    'published'
  ),
  (
    'ballito',
    'Kids Surf Lesson',
    'Group intro surf for ages 6–12 with local instructors.',
    'Ballito Bay',
    'Ballito Beachfront',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '6 days' + time '09:30',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '6 days' + time '11:00',
    null,
    'admin',
    'published'
  ),
  (
    'ballito',
    'Coastal Parkrun',
    'Free 5k community run — all fitness levels welcome.',
    'Compensation Beach',
    'Ballito / Compensation',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '6 days' + time '07:00',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '6 days' + time '08:30',
    null,
    'admin',
    'published'
  ),
  (
    'ballito',
    'Artisan Night Market',
    'Evening stalls, street food, and coastal crafts.',
    'Ballito Junction',
    'Ballito',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '12 days' + time '16:00',
    date_trunc('week', now() at time zone 'Africa/Johannesburg') + interval '12 days' + time '21:00',
    null,
    'admin',
    'published'
  );
