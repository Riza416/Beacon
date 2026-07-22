-- Beacon: a companies catalog that teams can belong to.
--
-- Global-admin-managed list (like statuses / workstreams). A team optionally
-- belongs to one company, chosen when the team is created or edited.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies enable row level security;

-- Everyone authenticated can read (the team form + list need it); only admins
-- mutate the catalog.
create policy companies_read_all on public.companies
  for select to authenticated using (true);
create policy companies_admin_all on public.companies
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- A team optionally belongs to one company. Deleting a company just clears the
-- link (the team stays).
alter table public.teams
  add column if not exists company_id uuid references public.companies(id) on delete set null;
create index if not exists teams_company_idx on public.teams(company_id);
