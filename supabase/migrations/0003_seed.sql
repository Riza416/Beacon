-- Beacon: seed defaults (idempotent)

insert into public.statuses (label, color, display_order, is_default, is_terminal)
values
  ('New',         '#3b82f6', 1, true,  false),
  ('In Review',   '#f59e0b', 2, false, false),
  ('In Progress', '#10b981', 3, false, false)
on conflict (label) do nothing;
