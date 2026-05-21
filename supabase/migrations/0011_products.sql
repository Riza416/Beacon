-- Beacon: Products are the admin-configured catalog the author picks from
-- when creating a request (e.g. "Mobile app", "API platform").

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy products_read_all on public.products
  for select to authenticated using (true);

create policy products_admin_all on public.products
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create trigger trg_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- requests.product_id — optional (null = no product chosen)
alter table public.requests
  add column if not exists product_id uuid references public.products(id) on delete set null;

create index if not exists requests_product_id_idx on public.requests(product_id);
