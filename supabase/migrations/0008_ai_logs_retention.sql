-- ai_logs retention helper: delete rows older than 90 days.
-- Call via service_role / scheduled job (Supabase cron or Edge Function).
-- Example (pg_cron, if enabled):
--   select cron.schedule(
--     'purge-ai-logs',
--     '0 3 * * *',
--     $$select public.purge_old_ai_logs();$$
--   );

create or replace function public.purge_old_ai_logs(
  retention_days integer default 90
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if retention_days is null or retention_days < 1 then
    raise exception 'retention_days must be >= 1';
  end if;

  delete from public.ai_logs
  where created_at < now() - make_interval(days => retention_days);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_old_ai_logs(integer) from public;
revoke all on function public.purge_old_ai_logs(integer) from anon, authenticated;
grant execute on function public.purge_old_ai_logs(integer) to service_role;
