-- Improvements roadmap: cost column, sticky conversation memory, claim verification,
-- and schema_migrations ledger for additive applies.

alter table public.ai_logs
  add column if not exists estimated_cost_usd numeric(12, 6);

comment on column public.ai_logs.estimated_cost_usd is
  'Estimated USD from token usage × configured model pricing at write time.';

alter table public.conversations
  add column if not exists sticky_summary jsonb not null default '{}'::jsonb;

comment on column public.conversations.sticky_summary is
  'Compact planner sticky constraints across turns (party size, cuisine, etc.).';

alter table public.business_claims
  drop constraint if exists business_claims_verification_method_check;

alter table public.business_claims
  add constraint business_claims_verification_method_check
  check (
    verification_method in (
      'self_attestation',
      'email_domain',
      'phone_otp',
      'document'
    )
  );

create table if not exists public.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

revoke all on table public.schema_migrations from anon, authenticated;
grant all on table public.schema_migrations to service_role;
