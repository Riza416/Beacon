-- Beacon: per-user view records so tag notifications can be marked as read.
--
-- For user tags we can add a column directly: each row is already user-scoped.
-- For team tags one row covers many users, so we need a separate per-user
-- view table.

-- Track when each tagged user has acknowledged the tag
alter table public.request_collaborators
  add column if not exists viewed_at timestamptz;

-- For team tags we need a per-user view record because a tag goes to many people.
create table if not exists public.request_team_tag_views (
  request_id uuid not null references public.requests(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (request_id, team_id, user_id)
);

alter table public.request_team_tag_views enable row level security;
create policy rttv_self_read on public.request_team_tag_views for select to authenticated using (user_id = auth.uid());
create policy rttv_self_write on public.request_team_tag_views for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rttv_admin on public.request_team_tag_views for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
