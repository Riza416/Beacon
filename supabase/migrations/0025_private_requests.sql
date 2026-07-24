-- Beacon: private requests.
--
-- By default every authenticated user can read every request (the app's open
-- cross-team model). A request may instead be marked PRIVATE, in which case it
-- — and its field values, comments, and tags — are visible only to:
--   * the author,
--   * global admins,
--   * users explicitly granted access (request_visibility_grants),
--   * users directly tagged as collaborators (request_collaborators),
--   * members of the team(s) that OWN the request's workstream (product_owners),
--   * members of any team tagged as a dependency (request_team_tags).
--
-- The audience test lives in one SECURITY DEFINER function so it can be reused
-- across the requests table and its child tables without RLS recursion (the
-- function runs as owner and bypasses RLS on the tables it inspects).

alter table public.requests
  add column if not exists is_private boolean not null default false;

-- Per-user visibility grants ("add visibility to different members by user").
create table if not exists public.request_visibility_grants (
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists rvg_user_idx on public.request_visibility_grants(user_id);

alter table public.request_visibility_grants enable row level security;

-- ---------------------------------------------------------------------------
-- Audience test. SECURITY DEFINER + fixed search_path: runs as the function
-- owner and bypasses RLS on the tables it reads, so the requests SELECT policy
-- can call it without a policy-evaluation loop.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_request(req_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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

revoke all on function public.can_view_request(uuid, uuid) from public;
grant execute on function public.can_view_request(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Swap the open read policies for audience-scoped ones. Writes are unchanged:
-- authors still update their own requests (which covers toggling is_private),
-- and admins retain full control.
-- ---------------------------------------------------------------------------
drop policy if exists requests_read_all on public.requests;
create policy requests_read_visible on public.requests
  for select to authenticated
  using (public.can_view_request(id, auth.uid()));

drop policy if exists rfv_read_all on public.request_field_values;
create policy rfv_read_visible on public.request_field_values
  for select to authenticated
  using (public.can_view_request(request_id, auth.uid()));

drop policy if exists comments_read_all on public.comments;
create policy comments_read_visible on public.comments
  for select to authenticated
  using (public.can_view_request(request_id, auth.uid()));

drop policy if exists rtt_read_all on public.request_team_tags;
create policy rtt_read_visible on public.request_team_tags
  for select to authenticated
  using (public.can_view_request(request_id, auth.uid()));

drop policy if exists rc_read_all on public.request_collaborators;
create policy rc_read_visible on public.request_collaborators
  for select to authenticated
  using (public.can_view_request(request_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- request_visibility_grants policies.
--   read:  the grantee (to know they have access), the request's author, admins.
--   write: the request's author, or an admin.
-- ---------------------------------------------------------------------------
create policy rvg_read on public.request_visibility_grants
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (
      select 1 from public.requests r
      where r.id = request_id and r.author_id = auth.uid()
    )
  );

create policy rvg_author_write on public.request_visibility_grants
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
