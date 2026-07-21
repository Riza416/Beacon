-- Beacon: a second priority dimension.
--
-- team_priority (existing): the REQUESTING team's rank of a request within its
--   (team, workstream) group.
-- workstream_priority (new): the OWNING team's rank of a request across ALL
--   requests in that workstream (product). Dense 0..N-1 per product_id.
--
-- The requesting team edits team_priority; the workstream's owning team edits
-- workstream_priority. Enforced in server actions.

alter table public.requests
  add column if not exists workstream_priority integer not null default 0;

create index if not exists requests_workstream_priority_idx
  on public.requests (product_id, workstream_priority);

-- Backfill a dense sequence per workstream (only for requests that have one),
-- seeded from the current requester ordering.
update public.requests r
set workstream_priority = sub.rn
from (
  select id,
         (row_number() over (
            partition by product_id
            order by team_priority asc, updated_at desc
          )) - 1 as rn
  from public.requests
  where product_id is not null
) sub
where r.id = sub.id and r.product_id is not null;
