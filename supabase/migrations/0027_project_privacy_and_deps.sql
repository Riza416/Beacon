-- Beacon: private projects + request-to-request dependencies.

-- 1) Private projects ------------------------------------------------------
-- A project may be marked private: visible only to its owner and global admins
-- (the requests inside keep their own visibility rules independently).
alter table public.projects
  add column if not exists is_private boolean not null default false;

drop policy if exists projects_read_all on public.projects;
create policy projects_read_visible on public.projects
  for select to authenticated
  using (
    is_private = false
    or owner_id = auth.uid()
    or public.is_admin(auth.uid())
  );
-- (insert/update/delete policies from 0024 are unchanged: owner or admin.)

-- 2) Request dependencies --------------------------------------------------
-- "request_id depends on depends_on_id" (A is blocked by B). Used to sequence
-- requests within a project. Stored generally; the UI scopes it to a project.
create table if not exists public.request_dependencies (
  request_id uuid not null references public.requests(id) on delete cascade,
  depends_on_id uuid not null references public.requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, depends_on_id),
  check (request_id <> depends_on_id)
);
create index if not exists request_dependencies_depends_idx
  on public.request_dependencies(depends_on_id);

alter table public.request_dependencies enable row level security;

-- Read: only when you can see BOTH requests (never leak a link to a private
-- request you can't view). Reuses the 0025 audience test.
create policy rd_read on public.request_dependencies
  for select to authenticated
  using (
    public.can_view_request(request_id, auth.uid())
    and public.can_view_request(depends_on_id, auth.uid())
  );

-- Write: the dependent request's author, or an admin. The project-owner case
-- (owner links two requests they don't author) is authorized in the server
-- action and written with the service-role client.
create policy rd_author_write on public.request_dependencies
  for all to authenticated
  using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.requests r
      where r.id = request_id and r.author_id = auth.uid()
    )
  )
  with check (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.requests r
      where r.id = request_id and r.author_id = auth.uid()
    )
  );
