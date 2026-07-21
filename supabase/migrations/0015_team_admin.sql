-- Beacon: team admins.
--
-- A team_admin is scoped to their own profiles.team_id. They can invite/manage
-- their team's members and reorder their team's request priorities. They can
-- also create/edit their team's products, but ONLY if a global admin has
-- granted their team that capability (teams.can_manage_products).
--
-- All team-admin powers are enforced in server actions (the security boundary)
-- via the service-role client after an explicit authorization check, so no
-- broad RLS grants are added here.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'team_admin', 'user'));

-- Per-team grant: may this team's admin create/edit products?
alter table public.teams
  add column if not exists can_manage_products boolean not null default false;
