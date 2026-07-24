-- Allow service_role to set profiles.is_admin.
-- Client sessions (authenticated/anon) still cannot flip the flag.

create or replace function public.profiles_protect_identity()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.email := old.email;
    new.created_at := old.created_at;
    -- Lock is_admin for end-user sessions only. Service role may promote admins.
    if coalesce(auth.role(), '') <> 'service_role' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
