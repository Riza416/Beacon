-- Beacon: products can be owned by one or more teams.
-- Junction table; many-to-many between products and teams. Display-only —
-- ownership doesn't restrict who can request against a product.

create table if not exists public.product_owners (
  product_id uuid not null references public.products(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, team_id)
);

create index if not exists product_owners_team_idx on public.product_owners(team_id);

alter table public.product_owners enable row level security;

-- Everyone authenticated can read ownership (shown on the products page +
-- request detail). Only admins mutate.
create policy product_owners_read_all on public.product_owners
  for select to authenticated using (true);
create policy product_owners_admin_all on public.product_owners
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
