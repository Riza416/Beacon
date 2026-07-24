-- Beacon: move the designated owner from the workstream to the request.
--
-- A request can name one owner (a DRI / point of contact). Constrained in the
-- server action to a member of the request's owning team(s). The workstream-
-- level owner (products.owner_id, added in 0028) is removed in 0030 once its
-- code references are gone.

alter table public.requests
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

create index if not exists requests_owner_idx on public.requests(owner_id);
