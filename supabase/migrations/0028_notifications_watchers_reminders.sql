-- Beacon: close-the-loop notifications, watchers, decline reasons, reminders,
-- and a designated (human) workstream owner.

-- 1) Slack DM target + designated workstream owner --------------------------
alter table public.profiles
  add column if not exists slack_user_id text;

-- A workstream may name a single person as its point of contact. Constrained
-- to a member of an owning team in the server action, not at the DB level.
alter table public.products
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

-- 2) Request bookkeeping -----------------------------------------------------
alter table public.requests
  add column if not exists decline_reason text,
  -- Set the first time the owning team moves the request off its default
  -- status. Null = still awaiting a response.
  add column if not exists acknowledged_at timestamptz,
  -- Bookkeeping so the daily reminder job doesn't re-send.
  add column if not exists unack_reminder_at timestamptz,
  add column if not exists deadline_reminder_at timestamptz;

-- 3) Watchers ---------------------------------------------------------------
create table if not exists public.request_watchers (
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists request_watchers_user_idx
  on public.request_watchers(user_id);

alter table public.request_watchers enable row level security;

-- 4) Watching a request grants visibility on it (like being a collaborator),
-- so a watcher on a private request can actually see what they're notified
-- about. Rebuild the audience function to include watchers.
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

-- Read: anyone who can see the request.
create policy rw_read on public.request_watchers
  for select to authenticated
  using (public.can_view_request(request_id, auth.uid()));

-- A user may watch/unwatch THEMSELVES on any request they can currently see.
create policy rw_self on public.request_watchers
  for all to authenticated
  using (
    user_id = auth.uid()
    and public.can_view_request(request_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    and public.can_view_request(request_id, auth.uid())
  );

-- The request's author (or an admin) may add/remove any watcher.
create policy rw_author on public.request_watchers
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
