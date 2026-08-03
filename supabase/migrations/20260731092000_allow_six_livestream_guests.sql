drop index if exists
  public.idx_one_approved_guest_per_livestream;

create or replace function
  public.enforce_six_livestream_guests()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  approved_guest_count integer;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  select count(*)
  into approved_guest_count
  from public.scholar_livestream_join_requests request
  where request.livestream_id = new.livestream_id
    and request.status = 'approved'
    and request.id <> new.id;

  if approved_guest_count >= 6 then
    raise exception
      'This livestream already has the maximum of six approved guests.';
  end if;

  return new;
end;
$$;

drop trigger if exists
  enforce_six_livestream_guests_trigger
  on public.scholar_livestream_join_requests;

create trigger
  enforce_six_livestream_guests_trigger
before insert or update of status
on public.scholar_livestream_join_requests
for each row
execute function
  public.enforce_six_livestream_guests();
