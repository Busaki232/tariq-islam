create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon_key text not null,
  color_scheme text not null default 'green',
  category text not null default 'achievement'
    check (
      category in (
        'achievement',
        'monthly',
        'special'
      )
    ),
  criteria jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id) on delete cascade,
  badge_id uuid not null
    references public.badges(id) on delete cascade,
  award_key text not null default 'permanent',
  reason text,
  awarded_by uuid
    references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  expires_at timestamptz,
  is_featured boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, badge_id, award_key)
);

create index if not exists
user_badges_user_id_idx
on public.user_badges(user_id);

create index if not exists
user_badges_badge_id_idx
on public.user_badges(badge_id);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists
"Everyone can view active badges"
on public.badges;

create policy
"Everyone can view active badges"
on public.badges
for select
using (
  is_active = true
  or public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'moderator')
);

drop policy if exists
"Admins can manage badges"
on public.badges;

create policy
"Admins can manage badges"
on public.badges
for all
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'moderator')
)
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'moderator')
);

drop policy if exists
"Everyone can view awarded badges"
on public.user_badges;

create policy
"Everyone can view awarded badges"
on public.user_badges
for select
using (true);

drop policy if exists
"Admins can award badges"
on public.user_badges;

create policy
"Admins can award badges"
on public.user_badges
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'moderator')
);

drop policy if exists
"Admins can update awarded badges"
on public.user_badges;

create policy
"Admins can update awarded badges"
on public.user_badges
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'moderator')
)
with check (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'moderator')
);

drop policy if exists
"Admins can remove awarded badges"
on public.user_badges;

create policy
"Admins can remove awarded badges"
on public.user_badges
for delete
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or public.has_role(auth.uid(), 'moderator')
);

insert into public.badges (
  slug,
  name,
  description,
  icon_key,
  color_scheme,
  category,
  criteria,
  sort_order
)
values
  (
    'tariq-founder',
    'Tariq Founder',
    'Founder and creator of the Tariq Islam platform.',
    'founder',
    'gold-blue',
    'special',
    '{"manual_only": true}'::jsonb,
    1
  ),
  (
    'early-member',
    'Early Member',
    'Joined Tariq Islam during its early community launch.',
    'sparkles',
    'emerald',
    'special',
    '{"manual_or_launch_period": true}'::jsonb,
    10
  ),
  (
    'consistent-member',
    'Consistent Member',
    'Active on at least 10 different days during a month.',
    'calendar-check',
    'green',
    'achievement',
    '{"distinct_active_days": 10}'::jsonb,
    20
  ),
  (
    'thirty-day-member',
    '30-Day Member',
    'Active on at least 30 different days across the platform.',
    'flame',
    'amber',
    'achievement',
    '{"lifetime_active_days": 30}'::jsonb,
    30
  ),
  (
    'knowledge-seeker',
    'Knowledge Seeker',
    'Consistently engages with educational Islamic content.',
    'book-open',
    'blue',
    'achievement',
    '{"educational_score": 50}'::jsonb,
    40
  ),
  (
    'community-builder',
    'Community Builder',
    'Makes positive and helpful community contributions.',
    'users',
    'purple',
    'achievement',
    '{"community_score": 50}'::jsonb,
    50
  ),
  (
    'mosque-supporter',
    'Mosque Supporter',
    'Regularly follows and supports mosque activities.',
    'building',
    'teal',
    'achievement',
    '{"mosque_score": 30}'::jsonb,
    60
  ),
  (
    'positive-voice',
    'Positive Voice',
    'Recognized for constructive and appreciated participation.',
    'heart',
    'rose',
    'achievement',
    '{"positive_feedback_score": 30}'::jsonb,
    70
  ),
  (
    'member-of-the-month',
    'Member of the Month',
    'Selected for balanced and meaningful monthly participation.',
    'trophy',
    'gold',
    'monthly',
    '{"monthly_winner": true}'::jsonb,
    80
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon_key = excluded.icon_key,
  color_scheme = excluded.color_scheme,
  category = excluded.category,
  criteria = excluded.criteria,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.award_user_badge(
  p_user_id uuid,
  p_badge_slug text,
  p_reason text default null,
  p_award_key text default 'permanent'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_badge_id uuid;
  awarded_badge_id uuid;
begin
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
  ) then
    raise exception 'Administrator access required';
  end if;

  select id
  into selected_badge_id
  from public.badges
  where slug = p_badge_slug
    and is_active = true;

  if selected_badge_id is null then
    raise exception 'Badge not found';
  end if;

  insert into public.user_badges (
    user_id,
    badge_id,
    award_key,
    reason,
    awarded_by
  )
  values (
    p_user_id,
    selected_badge_id,
    coalesce(nullif(trim(p_award_key), ''), 'permanent'),
    nullif(trim(p_reason), ''),
    auth.uid()
  )
  on conflict (user_id, badge_id, award_key)
  do update set
    reason = excluded.reason,
    awarded_by = excluded.awarded_by,
    awarded_at = now(),
    expires_at = null,
    is_featured = true
  returning id into awarded_badge_id;

  return awarded_badge_id;
end;
$$;

create or replace function public.revoke_user_badge(
  p_user_id uuid,
  p_badge_slug text,
  p_award_key text default 'permanent'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'moderator')
  ) then
    raise exception 'Administrator access required';
  end if;

  delete from public.user_badges
  where user_id = p_user_id
    and badge_id = (
      select id
      from public.badges
      where slug = p_badge_slug
    )
    and award_key =
      coalesce(nullif(trim(p_award_key), ''), 'permanent');
end;
$$;

revoke all on function
public.award_user_badge(uuid, text, text, text)
from public;

revoke all on function
public.revoke_user_badge(uuid, text, text)
from public;

grant execute on function
public.award_user_badge(uuid, text, text, text)
to authenticated;

grant execute on function
public.revoke_user_badge(uuid, text, text)
to authenticated;
