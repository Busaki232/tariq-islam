-- V54 AI Voice Translation foundation.
-- Voice enrollment samples remain private.
-- Generated lecture audio may be played for approved lectures.

create table if not exists public.scholar_voice_profiles (
  id uuid primary key default gen_random_uuid(),

  scholar_id uuid not null unique
    references public.scholar_profiles(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  enrollment_language_code text not null default 'en',

  voice_sample_storage_path text,
  consent_recording_storage_path text,

  consent_text_version text not null default 'v1',
  consent_granted_at timestamptz,
  consent_revoked_at timestamptz,

  provider text,
  provider_voice_id text,

  status text not null default 'draft',
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scholar_voice_profiles_status_check
    check (
      status in (
        'draft',
        'pending_consent',
        'processing',
        'ready',
        'failed',
        'revoked'
      )
    ),

  constraint scholar_voice_profiles_consent_check
    check (
      consent_granted_at is null
      or consent_revoked_at is null
      or consent_revoked_at >= consent_granted_at
    )
);
create index if not exists
  scholar_voice_profiles_user_id_idx
on public.scholar_voice_profiles(user_id);
create index if not exists
  scholar_voice_profiles_status_idx
on public.scholar_voice_profiles(status);
create table if not exists
  public.scholar_lecture_audio_translations (
    id uuid primary key default gen_random_uuid(),

    lecture_id uuid not null
      references public.scholar_lectures(id)
      on delete cascade,

    caption_translation_id uuid
      references public.scholar_lecture_caption_translations(id)
      on delete set null,

    scholar_id uuid not null
      references public.scholar_profiles(id)
      on delete cascade,

    voice_profile_id uuid not null
      references public.scholar_voice_profiles(id)
      on delete restrict,

    requested_by uuid not null
      references auth.users(id)
      on delete cascade,

    language_code text not null,
    language_name text not null,

    status text not null default 'queued',

    storage_path text,
    duration_seconds numeric,
    segment_manifest jsonb not null default '[]'::jsonb,

    provider text,
    provider_model text,

    source_translation_updated_at timestamptz,
    generated_at timestamptz,
    error_message text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint scholar_lecture_audio_status_check
      check (
        status in (
          'queued',
          'processing',
          'ready',
          'failed',
          'cancelled'
        )
      ),

    constraint scholar_lecture_audio_duration_check
      check (
        duration_seconds is null
        or duration_seconds >= 0
      ),

    constraint scholar_lecture_audio_language_unique
      unique (lecture_id, language_code)
  );
create index if not exists
  scholar_lecture_audio_lecture_id_idx
on public.scholar_lecture_audio_translations(lecture_id);
create index if not exists
  scholar_lecture_audio_scholar_id_idx
on public.scholar_lecture_audio_translations(scholar_id);
create index if not exists
  scholar_lecture_audio_status_idx
on public.scholar_lecture_audio_translations(status);
create or replace function
  public.set_voice_translation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists
  scholar_voice_profiles_updated_at
on public.scholar_voice_profiles;
create trigger scholar_voice_profiles_updated_at
before update on public.scholar_voice_profiles
for each row
execute function
  public.set_voice_translation_updated_at();
drop trigger if exists
  scholar_lecture_audio_translations_updated_at
on public.scholar_lecture_audio_translations;
create trigger scholar_lecture_audio_translations_updated_at
before update on public.scholar_lecture_audio_translations
for each row
execute function
  public.set_voice_translation_updated_at();
alter table public.scholar_voice_profiles
  enable row level security;
alter table public.scholar_lecture_audio_translations
  enable row level security;
-- Scholars may view only their own private voice profile.
drop policy if exists
  "Scholars can view their voice profile"
on public.scholar_voice_profiles;
create policy
  "Scholars can view their voice profile"
on public.scholar_voice_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.scholar_profiles scholar
    where scholar.id =
      scholar_voice_profiles.scholar_id
      and scholar.user_id = auth.uid()
  )
);
-- Scholars may create only their own enrollment record.
drop policy if exists
  "Scholars can create their voice profile"
on public.scholar_voice_profiles;
create policy
  "Scholars can create their voice profile"
on public.scholar_voice_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.scholar_profiles scholar
    where scholar.id =
      scholar_voice_profiles.scholar_id
      and scholar.user_id = auth.uid()
      and scholar.verification_status = 'approved'
      and scholar.is_active = true
  )
);
-- Scholars may update or revoke only their own voice profile.
drop policy if exists
  "Scholars can update their voice profile"
on public.scholar_voice_profiles;
create policy
  "Scholars can update their voice profile"
on public.scholar_voice_profiles
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.scholar_profiles scholar
    where scholar.id =
      scholar_voice_profiles.scholar_id
      and scholar.user_id = auth.uid()
  )
);
-- Ready audio tracks are visible only when the lecture is approved.
drop policy if exists
  "Public can hear approved translated lecture audio"
on public.scholar_lecture_audio_translations;
create policy
  "Public can hear approved translated lecture audio"
on public.scholar_lecture_audio_translations
for select
using (
  status = 'ready'
  and exists (
    select 1
    from public.scholar_lectures lecture
    where lecture.id =
      scholar_lecture_audio_translations.lecture_id
      and lecture.status = 'approved'
  )
);
-- Scholars may inspect all audio jobs belonging to their lectures.
drop policy if exists
  "Scholars can view their translated lecture audio"
on public.scholar_lecture_audio_translations;
create policy
  "Scholars can view their translated lecture audio"
on public.scholar_lecture_audio_translations
for select
to authenticated
using (
  exists (
    select 1
    from public.scholar_profiles scholar
    where scholar.id =
      scholar_lecture_audio_translations.scholar_id
      and scholar.user_id = auth.uid()
  )
);
-- Private voice enrollment storage.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'scholar-voice-enrollment',
  'scholar-voice-enrollment',
  false,
  52428800,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Public generated audio for approved lectures.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'scholar-lecture-translated-audio',
  'scholar-lecture-translated-audio',
  true,
  209715200,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/webm',
    'audio/ogg'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
-- Scholars may manage files only inside their own user folder.
drop policy if exists
  "Scholars can upload their voice enrollment"
on storage.objects;
create policy
  "Scholars can upload their voice enrollment"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'scholar-voice-enrollment'
  and (storage.foldername(name))[1] =
    auth.uid()::text
);
drop policy if exists
  "Scholars can view their voice enrollment"
on storage.objects;
create policy
  "Scholars can view their voice enrollment"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'scholar-voice-enrollment'
  and (storage.foldername(name))[1] =
    auth.uid()::text
);
drop policy if exists
  "Scholars can update their voice enrollment"
on storage.objects;
create policy
  "Scholars can update their voice enrollment"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'scholar-voice-enrollment'
  and (storage.foldername(name))[1] =
    auth.uid()::text
)
with check (
  bucket_id = 'scholar-voice-enrollment'
  and (storage.foldername(name))[1] =
    auth.uid()::text
);
drop policy if exists
  "Scholars can delete their voice enrollment"
on storage.objects;
create policy
  "Scholars can delete their voice enrollment"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'scholar-voice-enrollment'
  and (storage.foldername(name))[1] =
    auth.uid()::text
);
