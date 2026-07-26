-- Beacon: new accounts require GLOBAL-ADMIN approval before they can see
-- anything. Sign-up stays self-serve (the account exists and can log in), but
-- until approved_at is stamped the account is locked out at the RLS layer —
-- not just in the UI — so a stranger who finds the URL can't read requests,
-- teams, or profiles through the REST API either.

alter table public.profiles
  add column if not exists approved_at timestamptz;

-- Everyone who already has an account predates approval — grandfather them in.
update public.profiles set approved_at = now() where approved_at is null;

create or replace function public.is_approved(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and (p.approved_at is not null or p.role = 'admin')
  );
$$;
revoke all on function public.is_approved(uuid) from public;
grant execute on function public.is_approved(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Requests + all child tables delegate to can_view_request — one change gates
-- them all (field values, comments, tags, watchers, supporters, events,
-- mentions, dependencies, visibility grants).
-- ---------------------------------------------------------------------------
create or replace function public.can_view_request(req_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved(uid) and exists (
    select 1
    from public.requests r
    where r.id = req_id
      and (
        r.is_private = false
        or public.is_admin(uid)
        or r.author_id = uid
        or exists (
          select 1 from public.request_visibility_grants g
          where g.request_id = r.id and g.user_id = uid
        )
        or exists (
          select 1 from public.request_collaborators c
          where c.request_id = r.id and c.user_id = uid
        )
        or exists (
          select 1 from public.request_watchers w
          where w.request_id = r.id and w.user_id = uid
        )
        or (
          r.product_id is not null and exists (
            select 1
            from public.product_owners po
            join public.profiles p on p.team_id = po.team_id
            where po.product_id = r.product_id and p.id = uid
          )
        )
        or exists (
          select 1
          from public.request_team_tags tt
          join public.profiles p on p.team_id = tt.team_id
          where tt.request_id = r.id and p.id = uid
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- The remaining open-read tables get the approval gate directly.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_approved on public.profiles
  for select to authenticated
  -- You may always read YOURSELF (the pending screen needs it); everyone else
  -- only once approved.
  using (auth.uid() = id or public.is_approved(auth.uid()));

drop policy if exists teams_read_all on public.teams;
create policy teams_read_approved on public.teams
  for select to authenticated using (public.is_approved(auth.uid()));

drop policy if exists statuses_read_all on public.statuses;
create policy statuses_read_approved on public.statuses
  for select to authenticated using (public.is_approved(auth.uid()));

drop policy if exists rfd_read_all on public.request_field_definitions;
create policy rfd_read_approved on public.request_field_definitions
  for select to authenticated using (public.is_approved(auth.uid()));

drop policy if exists companies_read_all on public.companies;
create policy companies_read_approved on public.companies
  for select to authenticated using (public.is_approved(auth.uid()));

drop policy if exists products_read_all on public.products;
create policy products_read_approved on public.products
  for select to authenticated using (public.is_approved(auth.uid()));

drop policy if exists product_owners_read_all on public.product_owners;
create policy product_owners_read_approved on public.product_owners
  for select to authenticated using (public.is_approved(auth.uid()));

drop policy if exists wfc_read_all on public.workstream_field_config;
create policy wfc_read_approved on public.workstream_field_config
  for select to authenticated using (public.is_approved(auth.uid()));

drop policy if exists projects_read_visible on public.projects;
create policy projects_read_visible on public.projects
  for select to authenticated
  using (
    public.is_approved(auth.uid())
    and (
      is_private = false
      or owner_id = auth.uid()
      or public.is_admin(auth.uid())
    )
  );

-- Attachment downloads.
drop policy if exists "attachments read" on storage.objects;
create policy "attachments read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and public.is_approved(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- The two write surfaces an unapproved account could reach directly.
-- ---------------------------------------------------------------------------
drop policy if exists requests_author_insert on public.requests;
create policy requests_author_insert
  on public.requests for insert to authenticated
  with check (author_id = auth.uid() and public.is_approved(auth.uid()));

drop policy if exists comments_self_insert on public.comments;
create policy comments_self_insert
  on public.comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_approved(auth.uid()));
