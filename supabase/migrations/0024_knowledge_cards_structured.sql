-- P3: Structured knowledge cards (rules + members + render hints).

alter table public.knowledge_cards
  add column if not exists rule jsonb not null default '{}'::jsonb;

alter table public.knowledge_cards
  add column if not exists members jsonb not null default '[]'::jsonb;

alter table public.knowledge_cards
  add column if not exists render jsonb not null default '{}'::jsonb;

comment on column public.knowledge_cards.rule is
  'Membership rule: listing_kinds, require_terms, prefer_terms, min_rating, limit, etc.';
comment on column public.knowledge_cards.members is
  'Materialised [{kind,id,rank,score,reasons[]}] from last refresh.';
comment on column public.knowledge_cards.render is
  'Render hints: {headline, disclaimer, cta?} — templates apply at read time.';

-- Backfill render.headline from title where empty
update public.knowledge_cards
set render = jsonb_build_object('headline', title)
where render = '{}'::jsonb or render is null;
