-- Portal Stage 2: menu items table, specials recurrence, gallery, invites,
-- listing overrides, storage MIME expansion.

-- ---------------------------------------------------------------------------
-- business_profiles: listing fields + drop menu_items jsonb
-- ---------------------------------------------------------------------------
alter table public.business_profiles
  add column if not exists tagline text,
  add column if not exists hours_override jsonb,
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists notify_special_reminders boolean not null default true,
  add column if not exists notify_team_updates boolean not null default true;

-- ---------------------------------------------------------------------------
-- business_menu_items (replaces business_profiles.menu_items)
-- ---------------------------------------------------------------------------
create table if not exists public.business_menu_items (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null,
  description  text,
  price        text,
  category     text,
  image_path   text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint business_menu_items_name_check
    check (length(trim(name)) > 0)
);

create index if not exists business_menu_items_business_sort_idx
  on public.business_menu_items (business_id, sort_order, name);

-- Backfill from jsonb menu_items if present
do $$
declare
  r record;
  item jsonb;
  idx int;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'business_profiles'
      and column_name = 'menu_items'
  ) then
    for r in
      select business_id, menu_items
      from public.business_profiles
      where menu_items is not null
        and jsonb_typeof(menu_items) = 'array'
        and jsonb_array_length(menu_items) > 0
    loop
      idx := 0;
      for item in select * from jsonb_array_elements(r.menu_items)
      loop
        if coalesce(trim(item->>'name'), '') <> '' then
          insert into public.business_menu_items (
            business_id, name, description, price, category, sort_order
          ) values (
            r.business_id,
            trim(item->>'name'),
            nullif(trim(item->>'description'), ''),
            nullif(trim(item->>'price'), ''),
            nullif(trim(item->>'category'), ''),
            idx
          );
          idx := idx + 1;
        end if;
      end loop;
    end loop;

    alter table public.business_profiles drop column if exists menu_items;
  end if;
end $$;

create or replace function public.business_menu_items_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_menu_items_touch_updated_at_trigger
  on public.business_menu_items;
create trigger business_menu_items_touch_updated_at_trigger
  before update on public.business_menu_items
  for each row execute function public.business_menu_items_touch_updated_at();

-- ---------------------------------------------------------------------------
-- business_gallery
-- ---------------------------------------------------------------------------
create table if not exists public.business_gallery (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  path         text not null,
  caption      text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists business_gallery_business_sort_idx
  on public.business_gallery (business_id, sort_order, created_at);

-- ---------------------------------------------------------------------------
-- business_specials: recurrence + richer fields
-- ---------------------------------------------------------------------------
alter table public.business_specials
  add column if not exists kind text not null default 'deal',
  add column if not exists discount_label text,
  add column if not exists terms text,
  add column if not exists cta_url text,
  add column if not exists schedule_type text not null default 'one_time',
  add column if not exists recurrence jsonb,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_specials_kind_check'
  ) then
    alter table public.business_specials
      add constraint business_specials_kind_check
      check (kind in ('deal', 'happy_hour', 'event', 'other'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'business_specials_schedule_type_check'
  ) then
    alter table public.business_specials
      add constraint business_specials_schedule_type_check
      check (schedule_type in ('one_time', 'recurring'));
  end if;
end $$;

-- Public select for active specials: status only (live window evaluated in app
-- so recurring schedules work). Keep permissive public read of status=active.
drop policy if exists "business_specials_select_active_public" on public.business_specials;
create policy "business_specials_select_active_public" on public.business_specials
  for select using (status = 'active');

-- ---------------------------------------------------------------------------
-- business_invites
-- ---------------------------------------------------------------------------
create table if not exists public.business_invites (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  email        text not null,
  role         text not null default 'manager',
  token        text not null unique,
  status       text not null default 'pending',
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  accepted_at  timestamptz,
  constraint business_invites_role_check check (role in ('manager')),
  constraint business_invites_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create index if not exists business_invites_business_status_idx
  on public.business_invites (business_id, status);

create index if not exists business_invites_token_idx
  on public.business_invites (token);

create unique index if not exists business_invites_pending_email_idx
  on public.business_invites (business_id, lower(email))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- profiles: phone + notification prefs
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists phone text,
  add column if not exists notify_claim_updates boolean not null default true;

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------
alter table public.business_menu_items enable row level security;
alter table public.business_gallery enable row level security;
alter table public.business_invites enable row level security;

drop policy if exists "business_menu_items_select_public" on public.business_menu_items;
create policy "business_menu_items_select_public" on public.business_menu_items
  for select using (true);

drop policy if exists "business_gallery_select_public" on public.business_gallery;
create policy "business_gallery_select_public" on public.business_gallery
  for select using (true);

drop policy if exists "business_invites_select_member" on public.business_invites;
create policy "business_invites_select_member" on public.business_invites
  for select using (
    exists (
      select 1 from public.business_members m
      where m.business_id = business_invites.business_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'owner'
    )
  );

revoke all on table public.business_menu_items from anon;
revoke all on table public.business_gallery from anon;
revoke all on table public.business_invites from anon;
grant select on table public.business_menu_items to anon, authenticated;
grant select on table public.business_gallery to anon, authenticated;
grant select on table public.business_invites to authenticated;
grant all on table public.business_menu_items to service_role;
grant all on table public.business_gallery to service_role;
grant all on table public.business_invites to service_role;

-- ---------------------------------------------------------------------------
-- Storage: allow PDF for menu import; raise size limit to 10MB
-- ---------------------------------------------------------------------------
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
where id = 'business-media';
