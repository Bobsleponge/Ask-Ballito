-- Seed the city registry. Keep in sync with src/config/cities.ts.

insert into public.cities (slug, name, region, country, center_lat, center_lng, enabled)
values
  ('ballito',      'Ballito',      'KwaZulu-Natal', 'South Africa', -29.5387, 31.2143, true),
  ('umhlanga',     'Umhlanga',     'KwaZulu-Natal', 'South Africa', -29.7273, 31.0855, false),
  ('durban',       'Durban',       'KwaZulu-Natal', 'South Africa', -29.8587, 31.0218, false),
  ('cape-town',    'Cape Town',    'Western Cape',  'South Africa', -33.9249, 18.4241, false),
  ('johannesburg', 'Johannesburg', 'Gauteng',       'South Africa', -26.2041, 28.0473, false)
on conflict (slug) do update
  set name        = excluded.name,
      region      = excluded.region,
      country     = excluded.country,
      center_lat  = excluded.center_lat,
      center_lng  = excluded.center_lng,
      enabled     = excluded.enabled;
