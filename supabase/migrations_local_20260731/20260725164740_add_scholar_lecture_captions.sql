-- Add original timed captions to scholar lectures.
alter table public.scholar_lectures
  add column if not exists captions_enabled boolean not null default false,
  add column if not exists captions_language text,
  add column if not exists captions_text text,
  add column if not exists captions_segments jsonb;

-- Store cached AI translations for each lecture and language.
create table if not exists public.scholar_lecture_caption_translations (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null
    references public.scholar_lectures(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  language_code text not null,
  language_name text not null,
  translated_text text not null,
  translated_segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scholar_lecture_caption_translations_language_unique
    unique (lecture_id, language_code)
);

create index if not exists
  scholar_lecture_caption_translations_lecture_id_idx
on public.scholar_lecture_caption_translations(lecture_id);

create index if not exists
  scholar_lecture_caption_translations_user_id_idx
on public.scholar_lecture_caption_translations(user_id);

alter table public.scholar_lecture_caption_translations
  enable row level security;

-- Anyone may read translations for approved lectures.
drop policy if exists
  "Public can view approved scholar lecture translations"
on public.scholar_lecture_caption_translations;

create policy
  "Public can view approved scholar lecture translations"
on public.scholar_lecture_caption_translations
for select
using (
  exists (
    select 1
    from public.scholar_lectures lecture
    where lecture.id =
      scholar_lecture_caption_translations.lecture_id
      and lecture.status = 'approved'
  )
);

-- The approved scholar who owns the lecture may read all translations,
-- including translations for drafts and pending lectures.
drop policy if exists
  "Scholars can view their lecture translations"
on public.scholar_lecture_caption_translations;

create policy
  "Scholars can view their lecture translations"
on public.scholar_lecture_caption_translations
for select
to authenticated
using (
  exists (
    select 1
    from public.scholar_lectures lecture
    join public.scholar_profiles scholar
      on scholar.id = lecture.scholar_id
    where lecture.id =
      scholar_lecture_caption_translations.lecture_id
      and scholar.user_id = auth.uid()
  )
);

-- Scholars may create translations only for their own lectures.
drop policy if exists
  "Scholars can create their lecture translations"
on public.scholar_lecture_caption_translations;

create policy
  "Scholars can create their lecture translations"
on public.scholar_lecture_caption_translations
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.scholar_lectures lecture
    join public.scholar_profiles scholar
      on scholar.id = lecture.scholar_id
    where lecture.id =
      scholar_lecture_caption_translations.lecture_id
      and scholar.user_id = auth.uid()
      and scholar.verification_status = 'approved'
      and scholar.is_active = true
  )
);

-- Scholars may update translations belonging to their lectures.
drop policy if exists
  "Scholars can update their lecture translations"
on public.scholar_lecture_caption_translations;

create policy
  "Scholars can update their lecture translations"
on public.scholar_lecture_caption_translations
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.scholar_lectures lecture
    join public.scholar_profiles scholar
      on scholar.id = lecture.scholar_id
    where lecture.id =
      scholar_lecture_caption_translations.lecture_id
      and scholar.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.scholar_lectures lecture
    join public.scholar_profiles scholar
      on scholar.id = lecture.scholar_id
    where lecture.id =
      scholar_lecture_caption_translations.lecture_id
      and scholar.user_id = auth.uid()
  )
);

-- Scholars may delete translations belonging to their lectures.
drop policy if exists
  "Scholars can delete their lecture translations"
on public.scholar_lecture_caption_translations;

create policy
  "Scholars can delete their lecture translations"
on public.scholar_lecture_caption_translations
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.scholar_lectures lecture
    join public.scholar_profiles scholar
      on scholar.id = lecture.scholar_id
    where lecture.id =
      scholar_lecture_caption_translations.lecture_id
      and scholar.user_id = auth.uid()
  )
);
