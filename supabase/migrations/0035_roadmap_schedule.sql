-- Beacon: planned delivery dates, so requests can be laid out on a roadmap.
--
-- `deadline` already exists but it is the REQUESTER's "needed by" date, typed
-- into the request form. The owning team's plan is a different thing, so it
-- gets its own pair of columns rather than overloading deadline:
--
--   start_date  .. target_date   the owning team's planned span (the bar)
--   deadline                     what the requester asked for (the marker)
--
-- Keeping them apart is the whole point of the roadmap view: you can see at a
-- glance where a plan overruns what was asked for.
--
-- Both are plain dates (no time zone). Only the owning team / a global admin
-- writes them — enforced in the server action, which runs the privileged write
-- after the check (same model as setRequestOwner).

alter table public.requests
  add column if not exists start_date date,
  add column if not exists target_date date;

-- The roadmap reads "everything scheduled", so index the span's start.
create index if not exists requests_schedule_idx
  on public.requests(start_date, target_date);

-- Schedule changes belong in the same activity log as status and owner moves,
-- so the request page tells one continuous story.
alter table public.request_events
  drop constraint if exists request_events_kind_check;

alter table public.request_events
  add constraint request_events_kind_check
  check (kind in ('submitted', 'status_changed', 'owner_changed', 'scheduled'));
