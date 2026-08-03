alter table public.scholar_livestreams
add column if not exists last_heartbeat_at timestamptz;

create index if not exists scholar_livestreams_live_heartbeat_idx
on public.scholar_livestreams (status, last_heartbeat_at)
where status = 'live';
