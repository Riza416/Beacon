-- Beacon: team-level priority on requests
-- A separate ranking from `priority` (which is the author's own ordering).
-- Lower number = higher priority.

alter table public.requests
  add column if not exists team_priority integer not null default 0;

create index if not exists requests_team_priority_idx
  on public.requests (team_id, team_priority);
