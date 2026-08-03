create or replace function public.end_stale_scholar_livestreams()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ended_count integer;
begin
  update public.scholar_livestreams
  set
    status = 'ended',
    ended_at = now()
  where status = 'live'
    and coalesce(last_heartbeat_at, started_at, created_at)
        < now() - interval '2 minutes';

  get diagnostics ended_count = row_count;
  return ended_count;
end;
$$;

revoke all on function public.end_stale_scholar_livestreams() from public;
