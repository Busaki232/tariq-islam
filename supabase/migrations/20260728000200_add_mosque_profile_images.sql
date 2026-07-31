insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'mosque-images',
  'mosque-images',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists
"Public can view mosque images"
on storage.objects;
create policy
"Public can view mosque images"
on storage.objects
for select
using (bucket_id = 'mosque-images');
drop policy if exists
"Mosque managers can upload mosque images"
on storage.objects;
create policy
"Mosque managers can upload mosque images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'mosque-images'
  and exists (
    select 1
    from public.mosques mosque
    where mosque.id::text =
      (storage.foldername(name))[1]
      and (
        mosque.claimed_by = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'moderator')
      )
  )
);
drop policy if exists
"Mosque managers can update mosque images"
on storage.objects;
create policy
"Mosque managers can update mosque images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'mosque-images'
  and exists (
    select 1
    from public.mosques mosque
    where mosque.id::text =
      (storage.foldername(name))[1]
      and (
        mosque.claimed_by = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'moderator')
      )
  )
)
with check (
  bucket_id = 'mosque-images'
  and exists (
    select 1
    from public.mosques mosque
    where mosque.id::text =
      (storage.foldername(name))[1]
      and (
        mosque.claimed_by = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'moderator')
      )
  )
);
drop policy if exists
"Mosque managers can delete mosque images"
on storage.objects;
create policy
"Mosque managers can delete mosque images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'mosque-images'
  and exists (
    select 1
    from public.mosques mosque
    where mosque.id::text =
      (storage.foldername(name))[1]
      and (
        mosque.claimed_by = auth.uid()
        or public.has_role(auth.uid(), 'admin')
        or public.has_role(auth.uid(), 'moderator')
      )
  )
);
