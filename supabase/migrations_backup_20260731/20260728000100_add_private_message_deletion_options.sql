alter table public.messages
add column if not exists deleted_for uuid[]
not null default '{}'::uuid[];

create or replace function public.delete_private_message_for_me(
  p_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.messages
  set deleted_for = array_append(
    coalesce(deleted_for, '{}'::uuid[]),
    current_user_id
  )
  where id = p_message_id
    and group_id is null
    and (
      sender_id = current_user_id
      or recipient_id = current_user_id
    )
    and not (
      current_user_id = any(
        coalesce(deleted_for, '{}'::uuid[])
      )
    );

  if not found then
    raise exception 'Message not found or unavailable';
  end if;
end;
$$;

create or replace function public.delete_private_message_for_everyone(
  p_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.messages
  set is_deleted = true
  where id = p_message_id
    and group_id is null
    and sender_id = current_user_id
    and is_deleted = false;

  if not found then
    raise exception
      'Only the sender can delete this message for everyone';
  end if;
end;
$$;

revoke all on function
public.delete_private_message_for_me(uuid)
from public;

revoke all on function
public.delete_private_message_for_everyone(uuid)
from public;

grant execute on function
public.delete_private_message_for_me(uuid)
to authenticated;

grant execute on function
public.delete_private_message_for_everyone(uuid)
to authenticated;
