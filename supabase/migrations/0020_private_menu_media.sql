-- Private storage for sensitive portal uploads (menu imports / claim docs).
-- Public bucket `business-media` remains for logos, heroes, gallery, specials.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-media-private',
  'business-media-private',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No anon/authenticated policies — service role only (signed URLs via admin client).
drop policy if exists "business_media_private_no_public_read" on storage.objects;
