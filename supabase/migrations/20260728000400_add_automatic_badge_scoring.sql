create table if not exists public.monthly_activity_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  active_days integer not null default 0,
  reflection_views integer not null default 0,
  lecture_engagements integer not null default 0,
  community_posts integer not null default 0,
  helpful_comments integer not null default 0,
  positive_reactions integer not null default 0,
  mosque_follows integer not null default 0,
  scholar_follows integer not null default 0,
  volunteer_signups integer not null default 0,
  knowledge_points integer not null default 0,
  community_points integer not null default 0,
  mosque_points integer not null default 0,
  total_points integer not null default 0,
  eligible boolean not null default false,
  disqualification_reason text,
  calculated_at timestamptz not null default now(),
  unique (user_id, month_start)
);
create table if not exists public.monthly_badge_candidates (
  id uuid primary key default gen_random_uuid(),
  month_start date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_slug text not null references public.badges(slug) on delete cascade,
  rank integer not null,
  score integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (month_start, user_id, badge_slug)
);
create index if not exists monthly_activity_scores_month_rank_idx
  on public.monthly_activity_scores
  (month_start, eligible, total_points desc);
create index if not exists monthly_activity_scores_user_idx
  on public.monthly_activity_scores(user_id, month_start desc);
create index if not exists monthly_badge_candidates_review_idx
  on public.monthly_badge_candidates(month_start, status, rank);
alter table public.monthly_activity_scores enable row level security;
alter table public.monthly_badge_candidates enable row level security;
drop policy if exists "Users view own activity scores"
  on public.monthly_activity_scores;
create policy "Users view own activity scores"
on public.monthly_activity_scores
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin', 'moderator')
  )
);
drop policy if exists "Admins view badge candidates"
  on public.monthly_badge_candidates;
create policy "Admins view badge candidates"
on public.monthly_badge_candidates
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin', 'moderator')
  )
);
create or replace function public.calculate_monthly_badge_scores(
  p_month_start date default date_trunc('month', current_date)::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date :=
    date_trunc('month', p_month_start)::date;
  v_month_end date :=
    (date_trunc('month', p_month_start) + interval '1 month')::date;
  v_rows integer := 0;
begin
  if auth.uid() is not null and not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin', 'moderator')
  ) then
    raise exception 'Administrator or moderator access required';
  end if;

  delete from public.monthly_activity_scores
  where month_start = v_month_start;

  with raw_activity as (
    select user_id, created_at, 'reflection_view'::text as kind
    from public.reflection_views
    where created_at >= v_month_start
      and created_at < v_month_end

    union all

    select user_id, created_at, 'community_post'
    from public.community_posts
    where created_at >= v_month_start
      and created_at < v_month_end

    union all

    select user_id, created_at, 'reflection_comment'
    from public.reflection_comments
    where created_at >= v_month_start
      and created_at < v_month_end

    union all

    select user_id, created_at, 'lecture_comment'
    from public.scholar_lecture_comments
    where created_at >= v_month_start
      and created_at < v_month_end

    union all

    select user_id, created_at, 'reflection_like'
    from public.reflection_likes
    where created_at >= v_month_start
      and created_at < v_month_end

    union all

    select user_id, created_at, 'lecture_like'
    from public.scholar_lecture_likes
    where created_at >= v_month_start
      and created_at < v_month_end

    union all

    select user_id, followed_at, 'mosque_follow'
    from public.mosque_followers
    where followed_at >= v_month_start
      and followed_at < v_month_end

    union all

    select user_id, created_at, 'scholar_follow'
    from public.scholar_followers
    where created_at >= v_month_start
      and created_at < v_month_end

    union all

    select user_id, created_at, 'volunteer'
    from public.mosque_volunteer_signups
    where created_at >= v_month_start
      and created_at < v_month_end
      and status <> 'cancelled'

    union all

    select user_id, updated_at, 'lecture_progress'
    from public.scholar_lecture_progress
    where updated_at >= v_month_start
      and updated_at < v_month_end
      and (
        completed = true
        or current_time_seconds >= 180
        or (
          duration_seconds is not null
          and duration_seconds > 0
          and current_time_seconds / duration_seconds >= 0.25
        )
      )
  ),
  daily_counts as (
    select
      user_id,
      created_at::date as activity_date,
      kind,
      count(*)::integer as item_count
    from raw_activity
    where user_id is not null
      and created_at is not null
    group by user_id, created_at::date, kind
  ),
  capped as (
    select
      user_id,
      activity_date,
      sum(
        case kind
          when 'reflection_view'
            then least(item_count, 5)
          when 'lecture_progress'
            then least(item_count, 3)
          when 'community_post'
            then least(item_count, 3)
          when 'reflection_comment'
            then least(item_count, 5)
          when 'lecture_comment'
            then least(item_count, 5)
          when 'reflection_like'
            then least(item_count, 5)
          when 'lecture_like'
            then least(item_count, 5)
          when 'mosque_follow'
            then least(item_count, 2)
          when 'scholar_follow'
            then least(item_count, 2)
          when 'volunteer'
            then least(item_count, 2)
          else 0
        end
      )::integer as capped_count,
      sum(
        case when kind = 'reflection_view'
          then least(item_count, 5) else 0 end
      )::integer as reflection_views,
      sum(
        case when kind = 'lecture_progress'
          then least(item_count, 3) else 0 end
      )::integer as lecture_engagements,
      sum(
        case when kind = 'community_post'
          then least(item_count, 3) else 0 end
      )::integer as community_posts,
      sum(
        case when kind in (
          'reflection_comment',
          'lecture_comment'
        ) then least(item_count, 5) else 0 end
      )::integer as helpful_comments,
      sum(
        case when kind in (
          'reflection_like',
          'lecture_like'
        ) then least(item_count, 5) else 0 end
      )::integer as positive_reactions,
      sum(
        case when kind = 'mosque_follow'
          then least(item_count, 2) else 0 end
      )::integer as mosque_follows,
      sum(
        case when kind = 'scholar_follow'
          then least(item_count, 2) else 0 end
      )::integer as scholar_follows,
      sum(
        case when kind = 'volunteer'
          then least(item_count, 2) else 0 end
      )::integer as volunteer_signups
    from daily_counts
    group by user_id, activity_date
  ),
  totals as (
    select
      user_id,
      count(distinct activity_date)::integer as active_days,
      sum(reflection_views)::integer as reflection_views,
      sum(lecture_engagements)::integer as lecture_engagements,
      sum(community_posts)::integer as community_posts,
      sum(helpful_comments)::integer as helpful_comments,
      sum(positive_reactions)::integer as positive_reactions,
      sum(mosque_follows)::integer as mosque_follows,
      sum(scholar_follows)::integer as scholar_follows,
      sum(volunteer_signups)::integer as volunteer_signups
    from capped
    group by user_id
  )
  insert into public.monthly_activity_scores (
    user_id,
    month_start,
    active_days,
    reflection_views,
    lecture_engagements,
    community_posts,
    helpful_comments,
    positive_reactions,
    mosque_follows,
    scholar_follows,
    volunteer_signups,
    knowledge_points,
    community_points,
    mosque_points,
    total_points,
    eligible,
    disqualification_reason,
    calculated_at
  )
  select
    t.user_id,
    v_month_start,
    t.active_days,
    t.reflection_views,
    t.lecture_engagements,
    t.community_posts,
    t.helpful_comments,
    t.positive_reactions,
    t.mosque_follows,
    t.scholar_follows,
    t.volunteer_signups,

    (
      t.reflection_views +
      t.lecture_engagements * 2
    )::integer as knowledge_points,

    (
      t.community_posts * 2 +
      t.helpful_comments +
      t.positive_reactions
    )::integer as community_points,

    (
      t.mosque_follows * 3 +
      t.scholar_follows * 2 +
      t.volunteer_signups * 5
    )::integer as mosque_points,

    (
      t.active_days * 3 +
      t.reflection_views +
      t.lecture_engagements * 2 +
      t.community_posts * 2 +
      t.helpful_comments +
      t.positive_reactions +
      t.mosque_follows * 3 +
      t.scholar_follows * 2 +
      t.volunteer_signups * 5
    )::integer as total_points,

    (
      t.active_days >= 10
      and not exists (
        select 1
        from public.user_suspensions us
        where us.user_id = t.user_id
          and us.is_active = true
          and (
            us.is_permanent = true
            or us.expires_at is null
            or us.expires_at > now()
          )
      )
    ) as eligible,

    case
      when exists (
        select 1
        from public.user_suspensions us
        where us.user_id = t.user_id
          and us.is_active = true
          and (
            us.is_permanent = true
            or us.expires_at is null
            or us.expires_at > now()
          )
      ) then 'Active suspension'
      when t.active_days < 10
        then 'Fewer than 10 active days'
      else null
    end,
    now()
  from totals t;

  get diagnostics v_rows = row_count;

  delete from public.monthly_badge_candidates
  where month_start = v_month_start
    and status = 'pending';

  insert into public.monthly_badge_candidates (
    month_start,
    user_id,
    badge_slug,
    rank,
    score
  )
  select
    v_month_start,
    ranked.user_id,
    'member-of-the-month',
    ranked.position,
    ranked.total_points
  from (
    select
      mas.user_id,
      mas.total_points,
      row_number() over (
        order by
          mas.total_points desc,
          mas.active_days desc,
          mas.user_id
      )::integer as position
    from public.monthly_activity_scores mas
    where mas.month_start = v_month_start
      and mas.eligible = true
  ) ranked
  where ranked.position <= 3
  on conflict (month_start, user_id, badge_slug)
  do update set
    rank = excluded.rank,
    score = excluded.score,
    status = 'pending',
    reviewed_by = null,
    reviewed_at = null;

  insert into public.user_badges (
    user_id,
    badge_id,
    award_key,
    reason,
    awarded_at,
    is_featured
  )
  select
    mas.user_id,
    b.id,
    'automatic',
    'Active on at least 10 different days during a month.',
    now(),
    true
  from public.monthly_activity_scores mas
  join public.badges b
    on b.slug = 'consistent-member'
  where mas.month_start = v_month_start
    and mas.active_days >= 10
    and mas.eligible = true
  on conflict (user_id, badge_id, award_key)
  do nothing;

  insert into public.user_badges (
    user_id,
    badge_id,
    award_key,
    reason,
    awarded_at,
    is_featured
  )
  select
    mas.user_id,
    b.id,
    'automatic',
    'Consistently engaged with Islamic educational content.',
    now(),
    true
  from public.monthly_activity_scores mas
  join public.badges b
    on b.slug = 'knowledge-seeker'
  where mas.month_start = v_month_start
    and mas.knowledge_points >= 20
    and mas.eligible = true
  on conflict (user_id, badge_id, award_key)
  do nothing;

  insert into public.user_badges (
    user_id,
    badge_id,
    award_key,
    reason,
    awarded_at,
    is_featured
  )
  select
    mas.user_id,
    b.id,
    'automatic',
    'Made positive and helpful community contributions.',
    now(),
    true
  from public.monthly_activity_scores mas
  join public.badges b
    on b.slug = 'community-builder'
  where mas.month_start = v_month_start
    and mas.community_points >= 20
    and mas.eligible = true
  on conflict (user_id, badge_id, award_key)
  do nothing;

  insert into public.user_badges (
    user_id,
    badge_id,
    award_key,
    reason,
    awarded_at,
    is_featured
  )
  select
    mas.user_id,
    b.id,
    'automatic',
    'Regularly followed or supported mosque activities.',
    now(),
    true
  from public.monthly_activity_scores mas
  join public.badges b
    on b.slug = 'mosque-supporter'
  where mas.month_start = v_month_start
    and mas.mosque_points >= 10
    and mas.eligible = true
  on conflict (user_id, badge_id, award_key)
  do nothing;

  return v_rows;
end;
$$;
create or replace function public.review_monthly_badge_candidate(
  p_candidate_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate public.monthly_badge_candidates%rowtype;
  v_badge_id uuid;
begin
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin', 'moderator')
  ) then
    raise exception 'Administrator or moderator access required';
  end if;

  select *
  into v_candidate
  from public.monthly_badge_candidates
  where id = p_candidate_id
  for update;

  if not found then
    raise exception 'Badge candidate not found';
  end if;

  update public.monthly_badge_candidates
  set
    status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_candidate_id;

  if p_approve then
    select id
    into v_badge_id
    from public.badges
    where slug = v_candidate.badge_slug
      and active = true;

    if v_badge_id is null then
      raise exception 'Active badge not found';
    end if;

    insert into public.user_badges (
      user_id,
      badge_id,
      award_key,
      reason,
      awarded_by,
      awarded_at,
      is_featured
    )
    values (
      v_candidate.user_id,
      v_badge_id,
      to_char(v_candidate.month_start, 'YYYY-MM'),
      'Selected from verified monthly activity.',
      auth.uid(),
      now(),
      true
    )
    on conflict (user_id, badge_id, award_key)
    do nothing;
  end if;
end;
$$;
revoke all on function
public.calculate_monthly_badge_scores(date)
from public;
revoke all on function
public.review_monthly_badge_candidate(uuid, boolean)
from public;
grant execute on function
public.calculate_monthly_badge_scores(date)
to authenticated;
grant execute on function
public.review_monthly_badge_candidate(uuid, boolean)
to authenticated;
