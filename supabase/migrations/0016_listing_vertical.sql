-- Owner-selected vertical for which listing attribute form to show.
alter table public.business_profiles
  add column if not exists listing_vertical text;

comment on column public.business_profiles.listing_vertical is
  'Vertical slug controlling which portal listing attribute fields are shown; null = use first metadata.verticals entry.';
