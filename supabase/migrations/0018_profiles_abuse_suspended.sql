-- Abuse throttle: admins may suspend chat for a profile (service_role only).
alter table public.profiles
  add column if not exists abuse_suspended boolean not null default false;

comment on column public.profiles.abuse_suspended is
  'When true, /api/chat returns 403 until an admin clears the flag.';

-- Clients must not flip abuse_suspended (same pattern as is_admin).
create or replace function public.profiles_protect_identity()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.email := old.email;
    new.created_at := old.created_at;
    -- Lock privileged flags for end-user sessions. Service role may update.
    if coalesce(auth.role(), '') <> 'service_role' then
      new.is_admin := old.is_admin;
      new.abuse_suspended := old.abuse_suspended;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
