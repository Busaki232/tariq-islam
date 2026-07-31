do $$
declare
  v_job_id bigint;
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'calculate-tariq-monthly-badge-scores'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$$;
select cron.schedule(
  'calculate-tariq-monthly-badge-scores',
  '15 5 * * *',
  $cron$
    select public.calculate_monthly_badge_scores(
      date_trunc('month', current_date)::date
    );

    select public.calculate_monthly_badge_scores(
      (date_trunc('month', current_date) - interval '1 month')::date
    )
    where extract(day from current_date) <= 2;
  $cron$
);
