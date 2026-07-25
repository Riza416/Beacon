-- Beacon: demand signal (+1 supporters) and an append-only request event log.

-- 1) Supporters ("+1 / we need this too") ------------------------------------
create table if not exists public.request_supporters (
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists request_supporters_user_idx
  on public.request_supporters(user_id);

alter table public.request_supporters enable row level security;

-- Read: anyone who can see the request (private-request audience respected).
create policy rs_read on public.request_supporters
  for select to authenticated
  using (public.can_view_request(request_id, auth.uid()));

-- A user may add/remove ONLY their own +1, and only on requests they can see.
create policy rs_self on public.request_supporters
  for all to authenticated
  using (
    user_id = auth.uid()
    and public.can_view_request(request_id, auth.uid())
  )
  with check (
    user_id = auth.uid()
    and public.can_view_request(request_id, auth.uid())
  );

-- 2) Event log ---------------------------------------------------------------
-- Append-only lifecycle history: submissions, status changes (incl. declines),
-- owner changes. Written exclusively via the service-role client from server
-- actions (no authenticated INSERT policy on purpose), read by anyone who can
-- see the request. Powers the request activity timeline and honest analytics.
create table if not exists public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('submitted', 'status_changed', 'owner_changed')),
  from_status_id uuid references public.statuses(id) on delete set null,
  to_status_id uuid references public.statuses(id) on delete set null,
  -- Free-text detail: the decline reason on a terminal status change, or the
  -- owner's display name on an owner change.
  note text,
  created_at timestamptz not null default now()
);
create index if not exists request_events_request_idx
  on public.request_events(request_id, created_at);

alter table public.request_events enable row level security;

create policy re_read on public.request_events
  for select to authenticated
  using (public.can_view_request(request_id, auth.uid()));
