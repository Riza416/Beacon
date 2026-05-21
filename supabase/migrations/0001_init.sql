-- Beacon initial schema
-- Roles, teams, requests, configurable fields and statuses, collaboration, comments.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_team_id_idx on public.profiles(team_id);

-- ---------------------------------------------------------------------------
-- statuses
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- request_field_definitions
-- ---------------------------------------------------------------------------
create table public.request_field_definitions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  field_type text not null check (field_type in
    ('short_text','long_text','url','file','image','select','checkbox')),
  required_level text not null default 'optional'
    check (required_level in ('hard','soft','optional')),
  help_text text,
  options jsonb,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- requests
-- ---------------------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  status_id uuid references public.statuses(id) on delete set null,
  priority integer not null default 0,
  state text not null default 'draft' check (state in ('draft','submitted')),
  submitted_at timestamptz,
  notion_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_author_idx on public.requests(author_id);
create index requests_state_idx on public.requests(state);
create index requests_status_idx on public.requests(status_id);

-- ---------------------------------------------------------------------------
-- request_field_values
-- ---------------------------------------------------------------------------
create table public.request_field_values (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  field_definition_id uuid not null references public.request_field_definitions(id) on delete restrict,
  value_text text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, field_definition_id)
);

create index rfv_request_idx on public.request_field_values(request_id);

-- ---------------------------------------------------------------------------
-- request_collaborators (user tagged for feedback)
-- ---------------------------------------------------------------------------
create table public.request_collaborators (
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

-- ---------------------------------------------------------------------------
-- request_team_tags (team tagged for feedback)
-- ---------------------------------------------------------------------------
create table public.request_team_tags (
  request_id uuid not null references public.requests(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, team_id)
);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index comments_request_idx on public.comments(request_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_teams_updated_at before update on public.teams
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

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup. First user becomes admin.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
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

-- ---------------------------------------------------------------------------
-- Helper: is_admin(uid)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;
