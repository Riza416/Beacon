-- ===========================================================================
-- Beacon — consolidated schema baseline (final state)
-- ===========================================================================
-- This single file reflects the END STATE of migrations 0001–0013 and is the
-- fastest way to stand up a FRESH environment (paste into the Supabase SQL
-- editor, or `psql -f`).
--
-- The numbered files in migrations/ remain the applied history for the live
-- project — do NOT run this against an existing Beacon database; it assumes
-- empty schema. Regenerate lib/database.types.ts after any change here:
--   SB_CONNECTION_STRING=... node scripts/gen-types.mjs > lib/database.types.ts
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Products can be owned by one or more teams (many-to-many, display-only).
create table public.product_owners (
  product_id uuid not null references public.products(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, team_id)
);
create index product_owners_team_idx on public.product_owners(team_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'user' check (role in ('admin', 'team_admin', 'user')),
  team_id uuid references public.teams(id) on delete set null,
  -- Per-member product permissions (team's own products). Team admins toggle
  -- these for members; team admins/global admins always can regardless.
  can_create_products boolean not null default false,
  can_edit_products boolean not null default false,
  can_delete_products boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_team_id_idx on public.profiles(team_id);

create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  color text not null default '#64748b',
  display_order integer not null default 0,
  is_default boolean not null default false,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index statuses_one_default
  on public.statuses ((is_default)) where is_default = true;

create table public.request_field_definitions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  -- Legacy single-type column, kept in sync with field_types[0].
  field_type text not null check (field_type in
    ('short_text','long_text','url','file','image','select','multi_select','checkbox')),
  -- Set of allowed input types; the form renders one sub-input per entry.
  field_types text[] not null default '{}',
  required_level text not null default 'optional'
    check (required_level in ('hard','soft','optional')),
  help_text text,
  options jsonb,
  display_order integer not null default 0,
  is_active boolean not null default true,
  -- NULL = shared catalog field (admin-managed). Set = a custom field owned by
  -- a workstream, only usable in that workstream's template.
  product_id uuid references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_field_definitions_field_types_check check (
    field_types <@ array[
      'short_text','long_text','url','file','image','select','multi_select','checkbox'
    ]::text[]
    and coalesce(array_length(field_types, 1), 0) >= 1
  )
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  status_id uuid references public.statuses(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  -- Author's personal ordering across all their requests.
  priority integer not null default 0,
  -- Requester rank: dense 0..N-1 within a (team_id, product_id) group.
  team_priority integer not null default 0,
  -- Workstream-owner rank: dense 0..N-1 within a product_id (all requests in
  -- the workstream), set by the workstream's owning team.
  workstream_priority integer not null default 0,
  state text not null default 'draft' check (state in ('draft','submitted')),
  submitted_at timestamptz,
  notion_url text,
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requests_author_idx on public.requests(author_id);
create index requests_state_idx on public.requests(state);
create index requests_status_idx on public.requests(status_id);
create index requests_team_priority_idx on public.requests (team_id, team_priority);
create index requests_workstream_priority_idx on public.requests (product_id, workstream_priority);
create index requests_product_id_idx on public.requests(product_id);
create index requests_deadline_idx on public.requests(deadline);

create table public.request_field_values (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  field_definition_id uuid not null references public.request_field_definitions(id) on delete restrict,
  -- Which allowed type of the field this row holds (a field may allow several).
  field_type text not null,
  value_text text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_field_values_unique unique (request_id, field_definition_id, field_type)
);
create index rfv_request_idx on public.request_field_values(request_id);

-- Per-workstream request template: which fields a workstream collects, at what
-- required level (overriding the field's catalog default), and in what order.
create table public.workstream_field_config (
  product_id uuid not null references public.products(id) on delete cascade,
  field_definition_id uuid not null references public.request_field_definitions(id) on delete cascade,
  required_level text not null default 'optional'
    check (required_level in ('hard','soft','optional')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, field_definition_id)
);
create index wfc_product_idx on public.workstream_field_config (product_id, display_order);

create table public.request_collaborators (
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table public.request_team_tags (
  request_id uuid not null references public.requests(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, team_id)
);

create table public.request_team_tag_views (
  request_id uuid not null references public.requests(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (request_id, team_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index comments_request_idx on public.comments(request_id);

-- ---------------------------------------------------------------------------
-- Functions + triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger trg_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_statuses_updated_at before update on public.statuses
  for each row execute function public.set_updated_at();
create trigger trg_rfd_updated_at before update on public.request_field_definitions
  for each row execute function public.set_updated_at();
create trigger trg_requests_updated_at before update on public.requests
  for each row execute function public.set_updated_at();
create trigger trg_rfv_updated_at before update on public.request_field_values
  for each row execute function public.set_updated_at();

-- Auto-create a profile on signup; the very first user becomes admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when is_first then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.teams                     enable row level security;
alter table public.products                  enable row level security;
alter table public.product_owners            enable row level security;
alter table public.profiles                  enable row level security;
alter table public.statuses                  enable row level security;
alter table public.request_field_definitions enable row level security;
alter table public.requests                  enable row level security;
alter table public.request_field_values      enable row level security;
alter table public.request_collaborators     enable row level security;
alter table public.request_team_tags         enable row level security;
alter table public.request_team_tag_views    enable row level security;
alter table public.comments                  enable row level security;

-- profiles
create policy profiles_read_all on public.profiles for select to authenticated using (true);
create policy profiles_self_update on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- teams / products / statuses / field definitions: everyone reads, admins write
create policy teams_read_all on public.teams for select to authenticated using (true);
create policy teams_admin_all on public.teams for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy products_read_all on public.products for select to authenticated using (true);
create policy products_admin_all on public.products for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy product_owners_read_all on public.product_owners for select to authenticated using (true);
create policy product_owners_admin_all on public.product_owners for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy statuses_read_all on public.statuses for select to authenticated using (true);
create policy statuses_admin_all on public.statuses for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy rfd_read_all on public.request_field_definitions for select to authenticated using (true);
create policy rfd_admin_all on public.request_field_definitions for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- requests: all read; author inserts own; author updates own (any state);
-- author deletes own drafts; admins do anything.
create policy requests_read_all on public.requests for select to authenticated using (true);
create policy requests_author_insert on public.requests for insert to authenticated
  with check (author_id = auth.uid());
create policy requests_author_update_own on public.requests for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy requests_author_delete_draft on public.requests for delete to authenticated
  using (author_id = auth.uid() and state = 'draft');
create policy requests_admin_all on public.requests for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- request_field_values: all read; author writes while draft; admins anything.
create policy rfv_read_all on public.request_field_values for select to authenticated using (true);
create policy rfv_author_write on public.request_field_values for all to authenticated
  using (exists (select 1 from public.requests r
    where r.id = request_field_values.request_id and r.author_id = auth.uid() and r.state = 'draft'))
  with check (exists (select 1 from public.requests r
    where r.id = request_field_values.request_id and r.author_id = auth.uid() and r.state = 'draft'));
create policy rfv_admin_all on public.request_field_values for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- workstream_field_config: all read (form needs it); admins mutate directly,
-- owning-team writes go through the service-role client after a server check.
alter table public.workstream_field_config enable row level security;
create policy wfc_read_all on public.workstream_field_config for select to authenticated using (true);
create policy wfc_admin_all on public.workstream_field_config for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- tag tables: all read; author or admin mutate.
create policy rc_read_all on public.request_collaborators for select to authenticated using (true);
create policy rc_author_write on public.request_collaborators for all to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and r.author_id = auth.uid()))
  with check (exists (select 1 from public.requests r where r.id = request_id and r.author_id = auth.uid()));
create policy rc_admin_all on public.request_collaborators for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy rtt_read_all on public.request_team_tags for select to authenticated using (true);
create policy rtt_author_write on public.request_team_tags for all to authenticated
  using (exists (select 1 from public.requests r where r.id = request_id and r.author_id = auth.uid()))
  with check (exists (select 1 from public.requests r where r.id = request_id and r.author_id = auth.uid()));
create policy rtt_admin_all on public.request_team_tags for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- per-user tag view records: only the owner (or admin) reads/writes.
create policy rttv_self_read on public.request_team_tag_views for select to authenticated using (user_id = auth.uid());
create policy rttv_self_write on public.request_team_tag_views for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rttv_admin on public.request_team_tag_views for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- comments: all read; any authenticated user inserts their own; author edits/deletes
-- own; admins anything.
create policy comments_read_all on public.comments for select to authenticated using (true);
create policy comments_authenticated_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid());
create policy comments_self_modify on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_self_delete on public.comments for delete to authenticated
  using (author_id = auth.uid());
create policy comments_admin_all on public.comments for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for request attachments
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', false)
on conflict (id) do nothing;

create policy "attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'request-attachments');
create policy "attachments upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments update own" on storage.objects for update to authenticated
  using (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachments delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'request-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Seed: default statuses
-- ---------------------------------------------------------------------------
insert into public.statuses (label, color, display_order, is_default, is_terminal)
values
  ('New',         '#3b82f6', 1, true,  false),
  ('In Review',   '#f59e0b', 2, false, false),
  ('In Progress', '#10b981', 3, false, false)
on conflict (label) do nothing;
