-- =========================================================================
-- Photo Storage bucket
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, '{image/jpeg,image/png,image/webp,image/gif}');

create policy "owner_upload" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner_read" on storage.objects for select
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner_delete" on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- Photo asset metadata
-- =========================================================================
create table public.photo_assets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  byte_size integer not null,
  width integer not null,
  height integer not null,
  created_at timestamptz default now()
);

alter table public.photo_assets enable row level security;
create policy "owner_crud" on public.photo_assets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- Project-to-photo reference tracking (mirrors IDB refCount)
-- =========================================================================
create table public.project_photo_refs (
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_id text not null references public.photo_assets(id),
  primary key (project_id, asset_id),
  created_at timestamptz default now()
);

alter table public.project_photo_refs enable row level security;
create policy "owner_crud" on public.project_photo_refs for all
  using (exists (
    select 1 from public.projects
    where projects.id = project_photo_refs.project_id
    and projects.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_photo_refs.project_id
      and projects.user_id = auth.uid()
    )
    and exists (
      select 1 from public.photo_assets
      where photo_assets.id = project_photo_refs.asset_id
      and photo_assets.user_id = auth.uid()
    )
  );

-- =========================================================================
-- Orphan photo cleanup trigger
-- =========================================================================
create or replace function cleanup_orphan_photo_metadata()
returns trigger as $$
begin
  delete from public.photo_assets
  where id = OLD.asset_id
  and not exists (
    select 1 from public.project_photo_refs
    where asset_id = OLD.asset_id
  );
  return OLD;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_photo_ref_deleted
  after delete on public.project_photo_refs
  for each row execute procedure cleanup_orphan_photo_metadata();

-- =========================================================================
-- RPCs for orphan asset detection (pre-delete queries)
-- =========================================================================

-- Returns assets that would become orphaned if this project is deleted
create or replace function get_orphan_assets_on_project_delete(p_project_id uuid)
returns table(id text, storage_path text) as $$
  select pa.id, pa.storage_path
  from photo_assets pa
  join project_photo_refs ppr on ppr.asset_id = pa.id
  where ppr.project_id = p_project_id
  and pa.user_id = auth.uid()
  and not exists (
    select 1 from project_photo_refs other
    where other.asset_id = pa.id
    and other.project_id != p_project_id
  );
$$ language sql security definer set search_path = public;

-- Returns assets that would become orphaned if these refs are removed
create or replace function get_orphan_assets_on_ref_delete(p_project_id uuid, p_asset_ids text[])
returns table(id text, storage_path text) as $$
  select pa.id, pa.storage_path
  from photo_assets pa
  where pa.id = any(p_asset_ids)
  and pa.user_id = auth.uid()
  and not exists (
    select 1 from project_photo_refs other
    where other.asset_id = pa.id
    and other.project_id != p_project_id
  );
$$ language sql security definer set search_path = public;
