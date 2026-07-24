-- Owner-editable offerings that improve semantic search matching.
-- Stored on business_profiles (does not overwrite Google enrichment metadata).

alter table public.business_profiles
  add column if not exists services text[] not null default '{}',
  add column if not exists keywords text[] not null default '{}',
  add column if not exists menu_items jsonb not null default '[]'::jsonb;

comment on column public.business_profiles.services is
  'Owner-listed services / what they do (feeds search embeddings).';
comment on column public.business_profiles.keywords is
  'Owner search aliases (e.g. gel, balayage, kids haircut).';
comment on column public.business_profiles.menu_items is
  'Menu or priced service options: [{name, description?, price?, category?}].';
