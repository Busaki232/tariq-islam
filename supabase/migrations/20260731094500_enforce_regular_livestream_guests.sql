create or replace function public.is_regular_livestream_guest(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.user_id = p_user_id
        and p.created_at <= now() - interval '30 days'
    )
    and exists (
      select 1
      from public.monthly_activity_scores mas
      where mas.user_id = p_user_id
        and mas.month_start =
          date_trunc('month', current_date)::date
        and mas.active_days >= 10
    )
    and not public.is_user_suspended(p_user_id);
$$;

revoke all
on function public.is_regular_livestream_guest(uuid)
from public;

grant execute
on function public.is_regular_livestream_guest(uuid)
to authenticated;

-- Replace the original request policy.
drop policy if exists
  "Users can request to join live"
on public.scholar_livestream_join_requests;

drop policy if exists
  "Eligible users create own join requests"
on public.scholar_livestream_join_requests;

create policy
  "Eligible users can request to join live"
on public.scholar_livestream_join_requests
for insert
to authenticated
with check (
  requester_id = auth.uid()

  and public.is_regular_livestream_guest(auth.uid())

  -- The broadcast must currently be live,
  -- and the broadcaster cannot request to join their own stream.
  and exists (
    select 1
    from public.scholar_livestreams livestream
    where livestream.id =
      scholar_livestream_join_requests.livestream_id
      and livestream.status = 'live'
      and livestream.created_by <> auth.uid()
  )

  -- The requesting user must not be blocked by this scholar.
  and not exists (
    select 1
    from public.scholar_livestreams livestream
    join public.scholar_livestream_blocks block
      on block.scholar_id = livestream.scholar_id
    where livestream.id =
      scholar_livestream_join_requests.livestream_id
      and block.blocked_user_id = auth.uid()
  )
);
