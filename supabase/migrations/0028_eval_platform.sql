-- Eval platform: store live evaluation runs and per-question results.
-- Labels remain in git (evals/gold/). This table stores measured outcomes.

create table if not exists public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'staging'
    check (environment in ('staging', 'local', 'ci')),
  git_sha text,
  rank_config_version text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  question_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists eval_runs_started_idx
  on public.eval_runs (started_at desc);

create table if not exists public.eval_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.eval_runs(id) on delete cascade,
  question_id text not null,
  query text not null,
  intent_expected text,
  intent_detected text,
  pass_intent boolean,
  pass_top1 boolean,
  pass_top3 boolean,
  pass_top5 boolean,
  metrics jsonb not null default '{}'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, question_id)
);

create index if not exists eval_results_run_idx
  on public.eval_results (run_id);

create index if not exists eval_results_fail_idx
  on public.eval_results (run_id)
  where pass_top1 is false or pass_intent is false;

alter table public.eval_runs enable row level security;
alter table public.eval_results enable row level security;

-- Admins can read; service_role (bypass) writes from eval scripts.
create policy eval_runs_admin_select on public.eval_runs
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

create policy eval_results_admin_select on public.eval_results
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

comment on table public.eval_runs is
  'Search quality / AI evaluation run summaries (staging/local).';
comment on table public.eval_results is
  'Per-question evaluation outcomes for a given eval_runs row.';
