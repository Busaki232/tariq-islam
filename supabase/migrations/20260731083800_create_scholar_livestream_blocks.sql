create table if not exists public.scholar_livestream_blocks (
  id uuid primary key default gen_random_uuid(),

  scholar_id uuid not null
    references public.scholar_profiles(id)
    on delete cascade,

  blocked_user_id uuid not null
    references auth.users(id)
    on delete cascade,

  blocked_by uuid not null
    references auth.users(id),

  reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (scholar_id, blocked_user_id),

  check (blocked_user_id <> blocked_by)
);

create index if not exists
  idx_scholar_livestream_blocks_scholar
  on public.scholar_livestream_blocks(scholar_id);

create index if not exists
  idx_scholar_livestream_blocks_user
  on public.scholar_livestream_blocks(blocked_user_id);

drop trigger if exists
  update_scholar_livestream_blocks_updated_at
  on public.scholar_livestream_blocks;

create trigger
  update_scholar_livestream_blocks_updated_at
before update
on public.scholar_livestream_blocks
for each row
execute function public.update_updated_at_column();

alter table public.scholar_livestream_blocks
  enable row level security;


-- Scholars can see viewers they blocked.
-- Blocked viewers may read their own block so the app can
-- accurately disable guest requests.
drop policy if exists
  "Users can view scholar livestream blocks"
  on public.scholar_livestream_blocks;

create policy "Users can view scholar livestream blocks"
on public.scholar_livestream_blocks
for select
to authenticated
using (
  blocked_user_id = auth.uid()
  or exists (
    select 1
    from public.scholar_profiles scholar
    where scholar.id = scholar_id
      and scholar.user_id = auth.uid()
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


-- Only the verified scholar owner, an admin, or a moderator
-- can block viewers.
drop policy if exists
  "Scholar owners can block livestream viewers"
  on public.scholar_livestream_blocks;

create policy "Scholar owners can block livestream viewers"
on public.scholar_livestream_blocks
for insert
to authenticated
with check (
  blocked_by = auth.uid()
  and (
    exists (
      select 1
      from public.scholar_profiles scholar
      where scholar.id = scholar_id
        and scholar.user_id = auth.uid()
        and scholar.verification_status = 'approved'
        and scholar.is_active = true
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
);


-- Scholars can optionally update the block reason.
drop policy if exists
  "Scholar owners can update livestream blocks"
  on public.scholar_livestream_blocks;

create policy "Scholar owners can update livestream blocks"
on public.scholar_livestream_blocks
for update
to authenticated
using (
  exists (
    select 1
    from public.scholar_profiles scholar
    where scholar.id = scholar_id
      and scholar.user_id = auth.uid()
      and scholar.verification_status = 'approved'
      and scholar.is_active = true
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
  exists (
    select 1
    from public.scholar_profiles scholar
    where scholar.id = scholar_id
      and scholar.user_id = auth.uid()
      and scholar.verification_status = 'approved'
      and scholar.is_active = true
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


-- Removing a block allows the viewer to request guest access again.
drop policy if exists
  "Scholar owners can unblock livestream viewers"
  on public.scholar_livestream_blocks;

create policy "Scholar owners can unblock livestream viewers"
on public.scholar_livestream_blocks
for delete
to authenticated
using (
  exists (
    select 1
    from public.scholar_profiles scholar
    where scholar.id = scholar_id
      and scholar.user_id = auth.uid()
      and scholar.verification_status = 'approved'
      and scholar.is_active = true
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


-- Replace the join-request insert policy so blocked viewers
-- cannot request guest access.
drop policy if exists
  "Users can request to join live"
  on public.scholar_livestream_join_requests;

create policy "Users can request to join live"
on public.scholar_livestream_join_requests
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and exists (
    select 1
    from public.scholar_livestreams livestream
    where livestream.id = livestream_id
      and livestream.status = 'live'
      and livestream.created_by <> auth.uid()
      and not exists (
        select 1
        from public.scholar_livestream_blocks block
        where block.scholar_id = livestream.scholar_id
          and block.blocked_user_id = auth.uid()
      )
  )
);


-- Immediately remove pending or approved guest access when
-- a viewer is blocked.
create or replace function
  public.remove_blocked_livestream_guest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.scholar_livestream_join_requests request
  set
    status = 'removed',
    responded_at = now(),
    responded_by = new.blocked_by,
    removed_at = now(),
    updated_at = now()
  from public.scholar_livestreams livestream
  where request.livestream_id = livestream.id
    and livestream.scholar_id = new.scholar_id
    and request.requester_id = new.blocked_user_id
    and request.status in ('pending', 'approved');

  return new;
end;
$$;

drop trigger if exists
  remove_blocked_livestream_guest_trigger
  on public.scholar_livestream_blocks;

create trigger
  remove_blocked_livestream_guest_trigger
after insert
on public.scholar_livestream_blocks
for each row
execute function
  public.remove_blocked_livestream_guest();


-- Allow the app to receive block changes in realtime.
do $$
begin
  alter publication supabase_realtime
    add table public.scholar_livestream_blocks;
exception
  when duplicate_object then null;
end
$$;
