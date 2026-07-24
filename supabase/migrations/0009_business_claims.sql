-- Business Claiming foundation: admin flag, memberships, claims + RLS.
-- Ownership is expressed only via business_members (no owner_user_id on businesses).

-- ---------------------------------------------------------------------------
-- profiles.is_admin
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Clients must not flip is_admin (service role / SQL only).
create or replace function public.profiles_protect_identity()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.email := old.email;
    new.created_at := old.created_at;
    new.is_admin := old.is_admin;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- business_members
-- ---------------------------------------------------------------------------
create table if not exists public.business_members (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint business_members_role_check
    check (role in ('owner', 'manager')),
  constraint business_members_status_check
    check (status in ('active', 'inactive')),
  constraint business_members_business_user_unique
    unique (business_id, user_id)
);

create unique index if not exists business_members_one_active_owner
  on public.business_members (business_id)
  where role = 'owner' and status = 'active';

create index if not exists business_members_user_idx
  on public.business_members (user_id);

create index if not exists business_members_business_idx
  on public.business_members (business_id);

create or replace function public.business_members_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_members_touch_updated_at_trigger on public.business_members;
create trigger business_members_touch_updated_at_trigger
  before update on public.business_members
  for each row execute function public.business_members_touch_updated_at();

-- ---------------------------------------------------------------------------
-- business_claims
-- ---------------------------------------------------------------------------
create table if not exists public.business_claims (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses (id) on delete cascade,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  status               text not null default 'pending',
  verification_method  text not null default 'self_attestation',
  claimant_name        text not null,
  claimant_email       text not null,
  claimant_phone       text not null,
  claimant_role        text not null,
  notes                text,
  submitted_at         timestamptz not null default now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid references public.profiles (id) on delete set null,
  rejection_reason     text,
  constraint business_claims_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint business_claims_claimant_role_check
    check (claimant_role in ('owner', 'manager', 'marketing', 'other')),
  constraint business_claims_rejection_reason_check
    check (
      (status = 'rejected' and rejection_reason is not null and length(trim(rejection_reason)) > 0)
      or status <> 'rejected'
    )
);

create unique index if not exists business_claims_one_pending_per_business
  on public.business_claims (business_id)
  where status = 'pending';

create index if not exists business_claims_user_idx
  on public.business_claims (user_id);

create index if not exists business_claims_status_idx
  on public.business_claims (status);

create index if not exists business_claims_submitted_idx
  on public.business_claims (submitted_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.business_members enable row level security;
alter table public.business_claims enable row level security;

-- Members: users can read their own memberships. Writes via service role only.
drop policy if exists "business_members_select_own" on public.business_members;
create policy "business_members_select_own" on public.business_members
  for select using (auth.uid() = user_id);

-- Claims: users can read/insert their own pending claims. Review via service role.
drop policy if exists "business_claims_select_own" on public.business_claims;
create policy "business_claims_select_own" on public.business_claims
  for select using (auth.uid() = user_id);

drop policy if exists "business_claims_insert_own" on public.business_claims;
create policy "business_claims_insert_own" on public.business_claims
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and rejection_reason is null
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on table public.business_members from anon;
revoke all on table public.business_claims from anon;

grant select on table public.business_members to authenticated;
grant select, insert on table public.business_claims to authenticated;
grant all on table public.business_members to service_role;
grant all on table public.business_claims to service_role;
