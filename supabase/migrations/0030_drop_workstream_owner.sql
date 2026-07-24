-- Beacon: ownership moved from the workstream to the request (see 0029). The
-- workstream-level owner column is no longer referenced anywhere in the app.
alter table public.products
  drop column if exists owner_id;
