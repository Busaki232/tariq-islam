create extension if not exists pgcrypto;

-- ============================================================
-- Scholar livestreams
-- ============================================================

create table if not exists public.scholar_livestreams (
  id uuid primary key default gen_random_uuid(),

  scholar_id uuid not null
    references public.scholar_profiles(id)
    on delete cascade,

  created_by uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null,
  description text,

  -- Daily room information only.
  -- Never store Daily API keys or meeting tokens here.
  daily_room_name text unique,
  daily_room_url text,

  source_language text not null default 'ar',

  translation_languages text[] not null
    default array['en']::text[],

  scheduled_for timestamptz,
  started_at timestamptz,
  ended_at timestamptz,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'upcoming',
        'live',
        'ended',
        'cancelled'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scholar_livestream_title_not_blank
    check (length(trim(title)) > 0),

  constraint scholar_livestream_source_language_not_blank
    check (length(trim(source_language)) > 0)
);

create index if not exists
  idx_scholar_livestreams_scholar_id
  on public.scholar_livestreams(scholar_id);

create index if not exists
  idx_scholar_livestreams_created_by
  on public.scholar_livestreams(created_by);

create index if not exists
  idx_scholar_livestreams_status
  on public.scholar_livestreams(status);

create index if not exists
  idx_scholar_livestreams_scheduled_for
  on public.scholar_livestreams(scheduled_for);

create index if not exists
  idx_scholar_livestreams_live
  on public.scholar_livestreams(scholar_id, status)
  where status = 'live';


-- ============================================================
-- Translation tracks
-- ============================================================

create table if not exists
  public.scholar_livestream_translation_tracks (
    id uuid primary key default gen_random_uuid(),

    livestream_id uuid not null
      references public.scholar_livestreams(id)
      on delete cascade,

    language_code text not null,
    language_name text not null,

    -- Daily custom track identifier.
    daily_track_name text,

    status text not null default 'pending'
      check (
        status in (
          'pending',
          'connecting',
          'live',
          'stopped',
          'failed'
        )
      ),

    error_message text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint scholar_translation_language_code_not_blank
      check (length(trim(language_code)) > 0),

    constraint scholar_translation_language_name_not_blank
      check (length(trim(language_name)) > 0),

    unique (livestream_id, language_code)
  );

create index if not exists
  idx_scholar_livestream_translation_tracks_livestream
  on public.scholar_livestream_translation_tracks(
    livestream_id
  );

create index if not exists
  idx_scholar_livestream_translation_tracks_status
  on public.scholar_livestream_translation_tracks(status);


-- ============================================================
-- updated_at triggers
-- ============================================================

drop trigger if exists
  update_scholar_livestreams_updated_at
  on public.scholar_livestreams;

create trigger update_scholar_livestreams_updated_at
before update on public.scholar_livestreams
for each row
execute function public.update_updated_at_column();


drop trigger if exists
  update_scholar_livestream_translation_tracks_updated_at
  on public.scholar_livestream_translation_tracks;

create trigger
  update_scholar_livestream_translation_tracks_updated_at
before update
on public.scholar_livestream_translation_tracks
for each row
execute function public.update_updated_at_column();


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.scholar_livestreams
  enable row level security;

alter table public.scholar_livestream_translation_tracks
  enable row level security;


-- Authenticated users can discover livestreams that are intended
-- for viewers. Owners and administrators may also see drafts.
drop policy if exists
  "Users can view scholar livestreams"
  on public.scholar_livestreams;

create policy "Users can view scholar livestreams"
on public.scholar_livestreams
for select
to authenticated
using (
  status in ('upcoming', 'live', 'ended')
  or created_by = auth.uid()
  or public.has_role(
    auth.uid(),
    'admin'::public.app_role
  )
  or public.has_role(
    auth.uid(),
    'moderator'::public.app_role
  )
);


-- Only the active, approved scholar who owns the profile may
-- create a livestream. Administrators may also create one.
drop policy if exists
  "Approved scholars can create livestreams"
  on public.scholar_livestreams;

create policy "Approved scholars can create livestreams"
on public.scholar_livestreams
for insert
to authenticated
with check (
  (
    created_by = auth.uid()
    and exists (
      select 1
      from public.scholar_profiles scholar
      where scholar.id = scholar_id
        and scholar.user_id = auth.uid()
        and scholar.verification_status = 'approved'
        and scholar.is_active = true
    )
  )
  or public.has_role(
    auth.uid(),
    'admin'::public.app_role
  )
);


drop policy if exists
  "Scholar owners can update livestreams"
  on public.scholar_livestreams;

create policy "Scholar owners can update livestreams"
on public.scholar_livestreams
for update
to authenticated
using (
  (
    created_by = auth.uid()
    and exists (
      select 1
      from public.scholar_profiles scholar
      where scholar.id =
        scholar_livestreams.scholar_id
        and scholar.user_id = auth.uid()
        and scholar.verification_status = 'approved'
        and scholar.is_active = true
    )
  )
  or public.has_role(
    auth.uid(),
    'admin'::public.app_role
  )
  or public.has_role(
    auth.uid(),
    'moderator'::public.app_role
  )
)
with check (
  (
    created_by = auth.uid()
    and exists (
      select 1
      from public.scholar_profiles scholar
      where scholar.id =
        scholar_livestreams.scholar_id
        and scholar.user_id = auth.uid()
        and scholar.verification_status = 'approved'
        and scholar.is_active = true
    )
  )
  or public.has_role(
    auth.uid(),
    'admin'::public.app_role
  )
  or public.has_role(
    auth.uid(),
    'moderator'::public.app_role
  )
);


drop policy if exists
  "Scholar owners can delete livestreams"
  on public.scholar_livestreams;

create policy "Scholar owners can delete livestreams"
on public.scholar_livestreams
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.has_role(
    auth.uid(),
    'admin'::public.app_role
  )
);


-- Translation tracks are visible whenever their parent
-- livestream is visible.
drop policy if exists
  "Users can view livestream translation tracks"
  on public.scholar_livestream_translation_tracks;

create policy "Users can view livestream translation tracks"
on public.scholar_livestream_translation_tracks
for select
to authenticated
using (
  exists (
    select 1
    from public.scholar_livestreams livestream
    where livestream.id = livestream_id
      and (
        livestream.status in (
          'upcoming',
          'live',
          'ended'
        )
        or livestream.created_by = auth.uid()
        or public.has_role(
          auth.uid(),
          'admin'::public.app_role
        )
        or public.has_role(
          auth.uid(),
          'moderator'::public.app_role
        )
      )
  )
);


drop policy if exists
  "Scholar owners can create translation tracks"
  on public.scholar_livestream_translation_tracks;

create policy
  "Scholar owners can create translation tracks"
on public.scholar_livestream_translation_tracks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.scholar_livestreams livestream
    where livestream.id = livestream_id
      and (
        livestream.created_by = auth.uid()
        or public.has_role(
          auth.uid(),
          'admin'::public.app_role
        )
      )
  )
);


drop policy if exists
  "Scholar owners can update translation tracks"
  on public.scholar_livestream_translation_tracks;

create policy
  "Scholar owners can update translation tracks"
on public.scholar_livestream_translation_tracks
for update
to authenticated
using (
  exists (
    select 1
    from public.scholar_livestreams livestream
    where livestream.id = livestream_id
      and (
        livestream.created_by = auth.uid()
        or public.has_role(
          auth.uid(),
          'admin'::public.app_role
        )
        or public.has_role(
          auth.uid(),
          'moderator'::public.app_role
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.scholar_livestreams livestream
    where livestream.id = livestream_id
      and (
        livestream.created_by = auth.uid()
        or public.has_role(
          auth.uid(),
          'admin'::public.app_role
        )
        or public.has_role(
          auth.uid(),
          'moderator'::public.app_role
        )
      )
  )
);


drop policy if exists
  "Scholar owners can delete translation tracks"
  on public.scholar_livestream_translation_tracks;

create policy
  "Scholar owners can delete translation tracks"
on public.scholar_livestream_translation_tracks
for delete
to authenticated
using (
  exists (
    select 1
    from public.scholar_livestreams livestream
    where livestream.id = livestream_id
      and (
        livestream.created_by = auth.uid()
        or public.has_role(
          auth.uid(),
          'admin'::public.app_role
        )
      )
  )
);
