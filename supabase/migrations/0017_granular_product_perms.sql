-- Beacon: split the single per-member product grant into three independent
-- capabilities so team admins can hand out create / edit / delete separately.

alter table public.profiles
  add column if not exists can_create_products boolean not null default false,
  add column if not exists can_edit_products   boolean not null default false,
  add column if not exists can_delete_products boolean not null default false;

-- Backfill: anyone who had the combined grant gets all three.
update public.profiles set
  can_create_products = true,
  can_edit_products   = true,
  can_delete_products = true
where can_manage_products = true;

alter table public.profiles drop column if exists can_manage_products;
