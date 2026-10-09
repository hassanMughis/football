-- PREVIEW ONLY: lists app-managed image files that are not referenced anywhere.
-- Do not DELETE directly from storage.objects. That removes only metadata and
-- leaves the physical file orphaned. The app deletes these through Storage API.

with referenced_images as (
  select regexp_replace(image_url, '^.*/player-images/', '') as object_name
  from public.players
  where image_url is not null and image_url <> ''

  union

  select regexp_replace(image_url, '^.*/player-images/', '') as object_name
  from public.cricket_players
  where image_url is not null and image_url <> ''
),
json_references as (
  select coalesce(app_state::text, '') as document
  from public.squad_settings

  union all

  select coalesce(snapshot::text, '') as document
  from public.match_history
)
select
  objects.name,
  objects.created_at,
  objects.updated_at,
  coalesce((objects.metadata ->> 'size')::bigint, 0) as size_bytes
from storage.objects as objects
where objects.bucket_id = 'player-images'
  and objects.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$'
  and not exists (
    select 1
    from referenced_images
    where referenced_images.object_name = objects.name
  )
  and not exists (
    select 1
    from json_references
    where json_references.document like '%' || objects.name || '%'
  )
order by objects.created_at asc;
