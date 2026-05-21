-- Beacon: row-level security policies
-- Default posture: deny all, then grant explicitly per role.

alter table public.teams                      enable row level security;
alter table public.profiles                   enable row level security;
alter table public.statuses                   enable row level security;
alter table public.request_field_definitions  enable row level security;
alter table public.requests                   enable row level security;
alter table public.request_field_values       enable row level security;
alter table public.request_collaborators      enable row level security;
alter table public.request_team_tags          enable row level security;
alter table public.comments                   enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: every authenticated user can read all profiles (team picker,
-- comment authorship). Only the user themself or an admin can update.
-- ---------------------------------------------------------------------------
create policy profiles_read_all
  on public.profiles for select
  to authenticated
  using (true);

create policy profiles_self_update
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

create policy profiles_admin_all
  on public.profiles for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- teams: everyone reads, only admins write
-- ---------------------------------------------------------------------------
create policy teams_read_all on public.teams for select to authenticated using (true);
create policy teams_admin_all on public.teams for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- statuses: everyone reads, only admins write
-- ---------------------------------------------------------------------------
create policy statuses_read_all on public.statuses for select to authenticated using (true);
create policy statuses_admin_all on public.statuses for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- request_field_definitions: everyone reads (form needs them),
-- only admins write
-- ---------------------------------------------------------------------------
create policy rfd_read_all on public.request_field_definitions for select to authenticated using (true);
create policy rfd_admin_all on public.request_field_definitions for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- requests: any authenticated user can read (visibility across teams).
-- Authors can write their own drafts. Admins can do anything.
-- Submitted requests are read-only for the author (admins can still edit).
-- ---------------------------------------------------------------------------
create policy requests_read_all on public.requests for select to authenticated using (true);

create policy requests_author_insert
  on public.requests for insert to authenticated
  with check (author_id = auth.uid());

create policy requests_author_update_draft
  on public.requests for update to authenticated
  using (author_id = auth.uid() and state = 'draft')
  with check (author_id = auth.uid());

create policy requests_author_delete_draft
  on public.requests for delete to authenticated
  using (author_id = auth.uid() and state = 'draft');

create policy requests_admin_all on public.requests for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- request_field_values: readable to all authenticated. Writable by request author
-- (while draft) and admins.
-- ---------------------------------------------------------------------------
create policy rfv_read_all on public.request_field_values for select to authenticated using (true);

create policy rfv_author_write on public.request_field_values for all to authenticated
  using (
    exists (
      select 1 from public.requests r
      where r.id = request_field_values.request_id
        and r.author_id = auth.uid()
        and r.state = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.requests r
      where r.id = request_field_values.request_id
        and r.author_id = auth.uid()
        and r.state = 'draft'
    )
  );

create policy rfv_admin_all on public.request_field_values for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- request_collaborators / request_team_tags: readable to all.
-- Author or admin can mutate.
-- ---------------------------------------------------------------------------
create policy rc_read_all on public.request_collaborators for select to authenticated using (true);
create policy rc_author_write on public.request_collaborators for all to authenticated
  using (
    exists (select 1 from public.requests r where r.id = request_id and r.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.requests r where r.id = request_id and r.author_id = auth.uid())
  );
create policy rc_admin_all on public.request_collaborators for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy rtt_read_all on public.request_team_tags for select to authenticated using (true);
create policy rtt_author_write on public.request_team_tags for all to authenticated
  using (
    exists (select 1 from public.requests r where r.id = request_id and r.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.requests r where r.id = request_id and r.author_id = auth.uid())
  );
create policy rtt_admin_all on public.request_team_tags for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- comments: readable to all authenticated. Insertable by anyone authenticated
-- (server-side checks tag/team membership). Authors can edit/delete their own;
-- admins can do anything.
-- ---------------------------------------------------------------------------
create policy comments_read_all on public.comments for select to authenticated using (true);

create policy comments_self_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid());

create policy comments_self_modify on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy comments_self_delete on public.comments for delete to authenticated
  using (author_id = auth.uid());

create policy comments_admin_all on public.comments for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
