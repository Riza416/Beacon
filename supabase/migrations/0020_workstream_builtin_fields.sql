-- Beacon: per-workstream visibility of the built-in request fields.
--
-- The request form has a few fields that aren't in request_field_definitions —
-- they're structural: Title, Summary, Workstream, Deadline, Dependent teams.
-- Title/Summary/Workstream are mandatory scaffolding, but Deadline and
-- Dependent teams should be part of each workstream's template: on by default,
-- and removable by the workstream owner.
--
-- Two booleans on products carry that choice. Default true so every existing
-- workstream keeps showing them until an owner turns one off.

alter table public.products
  add column if not exists show_deadline boolean not null default true,
  add column if not exists show_dependent_teams boolean not null default true;
