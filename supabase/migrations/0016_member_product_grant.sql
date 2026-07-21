-- Beacon: product-management is now a per-member grant controlled by team
-- admins, not a per-team grant controlled by global admins.
--
-- - Global admins: manage all products.
-- - Team admins: always manage their own team's products, and can grant this
--   capability to individual members of their team.
-- - Members with the grant: manage their team's products.

alter table public.profiles
  add column if not exists can_manage_products boolean not null default false;

-- Replaced by the per-member grant above.
alter table public.teams
  drop column if exists can_manage_products;
