-- Owner content: branding/listing overrides + specials + storage bucket.
-- Does not overwrite Google Places fields on businesses.

-- ---------------------------------------------------------------------------
-- business_profiles (1:1 owner overrides)
-- ---------------------------------------------------------------------------
create table if not exists public.business_profiles (
  business_id  uuid primary key references public.businesses (id) on delete cascade,
  description  text,
  phone        text,
  website      text,
  logo_path    text,
  hero_path    text,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id) on delete set null
);

create or replace function public.business_profiles_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_profiles_touch_updated_at_trigger on public.business_profiles;
create trigger business_profiles_touch_updated_at_trigger
  before update on public.business_profiles
  for each row execute function public.business_profiles_touch_updated_at();

-- ---------------------------------------------------------------------------
-- business_specials
-- ---------------------------------------------------------------------------
create table if not exists public.business_specials (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  title        text not null,
  description  text,
  image_path   text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  status       text not null default 'draft',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null,
  constraint business_specials_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint business_specials_title_check
    check (length(trim(title)) > 0)
);

create index if not exists business_specials_business_status_idx
  on public.business_specials (business_id, status);

create index if not exists business_specials_active_window_idx
  on public.business_specials (business_id, starts_at, ends_at)
  where status = 'active';

create or replace function public.business_specials_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_specials_touch_updated_at_trigger on public.business_specials;
create trigger business_specials_touch_updated_at_trigger
  before update on public.business_specials
  for each row execute function public.business_specials_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.business_profiles enable row level security;
alter table public.business_specials enable row level security;

-- Members can read their business profile/specials; writes via service role.
drop policy if exists "business_profiles_select_member" on public.business_profiles;
create policy "business_profiles_select_member" on public.business_profiles
  for select using (
    exists (
      select 1 from public.business_members m
      where m.business_id = business_profiles.business_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

drop policy if exists "business_specials_select_member" on public.business_specials;
create policy "business_specials_select_member" on public.business_specials
  for select using (
    exists (
      select 1 from public.business_members m
      where m.business_id = business_specials.business_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Public can read active specials (for Ask Ballito cards).
drop policy if exists "business_specials_select_active_public" on public.business_specials;
create policy "business_specials_select_active_public" on public.business_specials
  for select using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

-- Profiles are world-readable for public logo/hero merge (paths only; images in storage).
drop policy if exists "business_profiles_select_public" on public.business_profiles;
create policy "business_profiles_select_public" on public.business_profiles
  for select using (true);

revoke all on table public.business_profiles from anon;
revoke all on table public.business_specials from anon;
grant select on table public.business_profiles to anon, authenticated;
grant select on table public.business_specials to anon, authenticated;
grant all on table public.business_profiles to service_role;
grant all on table public.business_specials to service_role;

-- ---------------------------------------------------------------------------
-- Storage: business-media (public read, service-role write)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media',
  'business-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read
drop policy if exists "business_media_public_read" on storage.objects;
create policy "business_media_public_read" on storage.objects
  for select using (bucket_id = 'business-media');

-- Service role handles all writes from trusted server actions.
-- (service_role bypasses RLS; no insert/update/delete policies for authenticated)
