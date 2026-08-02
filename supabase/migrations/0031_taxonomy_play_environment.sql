-- Amenity terms for outdoor/indoor play (eligibility-backed enrichment).
-- weather_fit outdoor|indoor already exist; these amenity slugs mirror play-specific attrs.

select public._seed_term(
  'amenities',
  'outdoor_play',
  'Outdoor play',
  array['outdoor play', 'outdoor playground', 'adventure park', 'farm activity']
);
select public._seed_term(
  'amenities',
  'indoor_play',
  'Indoor play',
  array['indoor play', 'soft play', 'play centre', 'trampoline']
);

-- Map outdoorPlay / indoorPlay attribute terms in classify (code) to weather_fit + these amenities when present.
