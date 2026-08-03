create table if not exists public.scholar_livestream_join_requests (
  id uuid primary key default gen_random_uuid(),

  livestream_id uuid not null
    references public.scholar_livestreams(id)
    on delete cascade,

  requester_id uuid not null
    references auth.users(id)
    on delete cascade,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'declined',
        'cancelled',
        'removed'
      )
    ),

  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references auth.users(id),
  approved_at timestamptz,
  removed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (livestream_id, requester_id)
);

create index if not exists
  idx_scholar_livestream_join_requests_livestream
  on public.scholar_livestream_join_requests(livestream_id);

create index if not exists
  idx_scholar_livestream_join_requests_requester
  on public.scholar_livestream_join_requests(requester_id);

create index if not exists
  idx_scholar_livestream_join_requests_status
  on public.scholar_livestream_join_requests(status);

-- First version: only one approved guest may be live at a time.
create unique index if not exists
  idx_one_approved_guest_per_livestream
  on public.scholar_livestream_join_requests(livestream_id)
  where status = 'approved';

drop trigger if exists
  update_scholar_livestream_join_requests_updated_at
  on public.scholar_livestream_join_requests;

create trigger
  update_scholar_livestream_join_requests_updated_at
before update
on public.scholar_livestream_join_requests
for each row
execute function public.update_updated_at_column();

alter table public.scholar_livestream_join_requests
  enable row level security;

-- A viewer can read their own request.
-- The scholar owner can read all requests for their livestream.
drop policy if exists
  "Users can view livestream join requests"
  on public.scholar_livestream_join_requests;

create policy "Users can view livestream join requests"
on public.scholar_livestream_join_requests
for select
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.scholar_livestreams livestream
    join public.scholar_profiles scholar
      on scholar.id = livestream.scholar_id
    where livestream.id = livestream_id
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

-- A viewer may request to join only an active live broadcast.
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
  )
);

-- A viewer may cancel their own pending request.
drop policy if exists
  "Users can cancel their join request"
  on public.scholar_livestream_join_requests;

create policy "Users can cancel their join request"
on public.scholar_livestream_join_requests
for update
to authenticated
using (
  requester_id = auth.uid()
  and status = 'pending'
)
with check (
  requester_id = auth.uid()
  and status = 'cancelled'
);

-- Scholar owners approve, decline, or remove guests.
drop policy if exists
  "Scholar owners can manage join requests"
  on public.scholar_livestream_join_requests;

create policy "Scholar owners can manage join requests"
on public.scholar_livestream_join_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.scholar_livestreams livestream
    join public.scholar_profiles scholar
      on scholar.id = livestream.scholar_id
    where livestream.id = livestream_id
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
    from public.scholar_livestreams livestream
    join public.scholar_profiles scholar
      on scholar.id = livestream.scholar_id
    where livestream.id = livestream_id
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

-- Allow realtime request updates.
do $$
begin
  alter publication supabase_realtime
    add table public.scholar_livestream_join_requests;
exception
  when duplicate_object then null;
end
$$;
