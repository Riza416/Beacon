-- Beacon: projects — a personal way to group requests across teams.
--
-- A user creates a project, then files multiple requests (to different teams /
-- workstreams) under it. Projects are readable by everyone (consistent with
-- requests_read_all — cross-team visibility), but only the creator or a global
-- admin may edit or delete one.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_idx on public.projects(owner_id);

alter table public.projects enable row level security;

-- Read: any authenticated user (a request's project label is visible wherever
-- the request is, mirroring the app's open cross-team read model).
create policy projects_read_all on public.projects
  for select to authenticated using (true);

-- Insert: you may only create projects you own.
create policy projects_owner_insert on public.projects
  for insert to authenticated
  with check (owner_id = auth.uid());

-- Update / delete: the owner, or a global admin.
create policy projects_owner_update on public.projects
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_admin(auth.uid()));

create policy projects_owner_delete on public.projects
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin(auth.uid()));

-- Link requests to at most one project. Deleting a project just unlinks its
-- requests (they stay). Authors already have update rights on their own
-- requests in any state (see 0010_author_edit_any_state), so attaching /
-- detaching goes through the normal request-update path.
alter table public.requests
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists requests_project_idx on public.requests(project_id);
