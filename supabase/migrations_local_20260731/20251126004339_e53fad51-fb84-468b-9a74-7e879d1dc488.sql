create table public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  caller_id uuid not null,
  callee_id uuid not null,
  room_url text not null,
  status text not null default 'ringing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calls_conversation_id_idx on public.calls (conversation_id);
create index calls_callee_id_status_idx on public.calls (callee_id, status);

alter table public.calls enable row level security;

create policy "Users see their own calls"
on public.calls
for select
using (
  auth.uid() = caller_id
  or auth.uid() = callee_id
);

create policy "Users insert their own outgoing calls"
on public.calls
for insert
with check (auth.uid() = caller_id);