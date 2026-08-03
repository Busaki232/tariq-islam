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
    not public.is_user_suspended(p_user_id)
    and (
      -- Admins and moderators receive an eligibility pass
      -- for livestream testing. Scholar approval is still required.
      exists (
        select 1
        from public.user_roles role_row
        where role_row.user_id = p_user_id
          and role_row.role::text in ('admin', 'moderator')
      )

      or (
        -- Standard eligibility for regular app members.
        exists (
          select 1
          from public.profiles profile
          where profile.user_id = p_user_id
            and profile.created_at <=
              now() - interval '30 days'
        )

        and exists (
          select 1
          from public.monthly_activity_scores score
          where score.user_id = p_user_id
            and score.month_start =
              date_trunc('month', current_date)::date
            and score.active_days >= 10
        )
      )
    );
$$;

revoke all
on function public.is_regular_livestream_guest(uuid)
from public;

grant execute
on function public.is_regular_livestream_guest(uuid)
to authenticated;
