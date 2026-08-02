-- Knowledge Engine P1: per-field provenance/confidence on listings.
-- Does not replace columns — annotates who owns each scalar fact.

alter table public.businesses
  add column if not exists field_meta jsonb not null default '{}'::jsonb;

comment on column public.businesses.field_meta is
  'Per-field provenance: { field: { confidence, source, verified_at, method } }.';

create index if not exists businesses_field_meta_gin
  on public.businesses using gin (field_meta);
