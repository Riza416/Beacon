-- Beacon: per-workstream request templates.
--
-- Until now the request form rendered every active field in one global
-- catalog. This makes the set of fields — and each field's required level —
-- configurable PER WORKSTREAM by that workstream's owner.
--
-- Two changes:
--   1) request_field_definitions gains a nullable product_id.
--        NULL      = shared catalog field (admin-managed under /admin/requirements).
--        <product> = a custom field created by a workstream owner; only usable
--                    in that workstream's template.
--   2) workstream_field_config is the template itself: for a workstream, which
--      fields are included, at what required level (overriding the field's
--      catalog default), and in what order.
--
-- Resolution (used by both the request form and submit-time validation) reads
-- workstream_field_config for the request's product_id. A request with no
-- workstream shows only the built-in fields (title/summary/deadline).

-- 1) Custom-field ownership on the field catalog.
alter table public.request_field_definitions
  add column if not exists product_id uuid references public.products(id) on delete cascade;

create index if not exists rfd_product_idx
  on public.request_field_definitions (product_id);

-- 2) The per-workstream template.
create table if not exists public.workstream_field_config (
  product_id uuid not null references public.products(id) on delete cascade,
  field_definition_id uuid not null references public.request_field_definitions(id) on delete cascade,
  required_level text not null default 'optional'
    check (required_level in ('hard','soft','optional')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, field_definition_id)
);

create index if not exists wfc_product_idx
  on public.workstream_field_config (product_id, display_order);

alter table public.workstream_field_config enable row level security;

-- Everyone authenticated reads a template (the request form needs it). Writes
-- go through the service-role client AFTER an ownership/permission check in the
-- server action, so only admins get a direct RLS write grant here.
create policy wfc_read_all on public.workstream_field_config
  for select to authenticated using (true);
create policy wfc_admin_all on public.workstream_field_config
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 3) Backfill: seed every existing workstream's template with all currently
-- active catalog fields, keeping their level + order. This keeps the request
-- form identical for existing workstreams until an owner customizes it.
insert into public.workstream_field_config
  (product_id, field_definition_id, required_level, display_order)
select p.id, d.id, d.required_level, d.display_order
from public.products p
cross join public.request_field_definitions d
where d.is_active = true
  and d.product_id is null
on conflict (product_id, field_definition_id) do nothing;
