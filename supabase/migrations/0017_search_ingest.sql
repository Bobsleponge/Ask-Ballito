-- One-time claim ingest + deferred restudy queue for search recommendations.
-- search_ingested_at: set when admin runs Ingest (Places enrich + study + embed).
-- search_restudy_due_at: owner offering changes schedule a batch restudy (≥48h later).
-- search_last_studied_at: last successful LLM offerings study (ingest or batch).

alter table public.businesses
  add column if not exists search_ingested_at timestamptz,
  add column if not exists search_restudy_due_at timestamptz,
  add column if not exists search_last_studied_at timestamptz;

create index if not exists businesses_search_restudy_due_idx
  on public.businesses (search_restudy_due_at)
  where search_restudy_due_at is not null;

comment on column public.businesses.search_ingested_at is
  'When admin completed the one-time search ingest for this listing.';
comment on column public.businesses.search_restudy_due_at is
  'When a deferred offerings restudy may run (owner updates coalesce here).';
comment on column public.businesses.search_last_studied_at is
  'Last time offerings were LLM-studied for services/keywords.';
