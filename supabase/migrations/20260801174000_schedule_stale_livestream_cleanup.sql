create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'end-stale-scholar-livestreams'
  ) then
    perform cron.unschedule('end-stale-scholar-livestreams');
  end if;
end
$$;

select cron.schedule(
  'end-stale-scholar-livestreams',
  '* * * * *',
  $$select public.end_stale_scholar_livestreams();$$
);
