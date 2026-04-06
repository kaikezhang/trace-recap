-- =========================================================================
-- Projects
-- =========================================================================
create table public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Trip',
  location_count integer default 0,
  preview_locations text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  revision integer not null default 1
);

create index idx_projects_user_id on public.projects(user_id);
alter table public.projects enable row level security;

create policy "owner_crud" on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- Project Data (JSONB — CloudProjectData, no UI prefs, no inline photos)
-- =========================================================================
create table public.project_data (
  project_id uuid primary key references public.projects(id) on delete cascade,
  data jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz default now()
);

alter table public.project_data enable row level security;

create policy "owner_crud" on public.project_data for all
  using (exists (
    select 1 from public.projects
    where projects.id = project_data.project_id
    and projects.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.projects
    where projects.id = project_data.project_id
    and projects.user_id = auth.uid()
  ));

-- =========================================================================
-- Upsert RPC with compare-and-swap revision check
-- =========================================================================
create or replace function upsert_project_data(
  p_project_id uuid,
  p_data jsonb,
  p_base_revision integer,
  p_name text default null,
  p_location_count integer default 0,
  p_preview_locations text[] default '{}'
) returns json as $$
declare
  current_rev integer;
  new_rev integer;
begin
  select revision into current_rev
  from projects
  where id = p_project_id and user_id = auth.uid();

  if current_rev is not null and current_rev > p_base_revision then
    return json_build_object(
      'status', 'conflict',
      'server_revision', current_rev
    );
  end if;

  new_rev := coalesce(current_rev, 0) + 1;

  insert into projects (id, user_id, name, location_count, preview_locations, revision)
  values (p_project_id, auth.uid(), coalesce(p_name, 'My Trip'), p_location_count, p_preview_locations, new_rev)
  on conflict (id) do update set
    name = coalesce(p_name, projects.name),
    location_count = p_location_count,
    preview_locations = p_preview_locations,
    revision = new_rev,
    updated_at = now()
  where projects.user_id = auth.uid();

  insert into project_data (project_id, data, revision)
  values (p_project_id, p_data, new_rev)
  on conflict (project_id) do update set
    data = excluded.data,
    revision = new_rev,
    updated_at = now()
  where project_data.project_id in (
    select id from projects where user_id = auth.uid()
  );

  return json_build_object('status', 'ok', 'new_revision', new_rev);
end;
$$ language plpgsql security definer set search_path = public;
