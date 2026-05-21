-- Add field_types array on field definitions, backfill from existing field_type
alter table public.request_field_definitions
  add column if not exists field_types text[] not null default '{}';
update public.request_field_definitions
  set field_types = array[field_type]
  where coalesce(array_length(field_types, 1), 0) = 0;

alter table public.request_field_definitions
  drop constraint if exists request_field_definitions_field_types_check;
alter table public.request_field_definitions
  add constraint request_field_definitions_field_types_check
  check (
    field_types <@ array[
      'short_text','long_text','url','file','image','select','multi_select','checkbox'
    ]::text[]
    and coalesce(array_length(field_types, 1), 0) >= 1
  );

-- Per-type value storage: each (request, field_def) can have multiple values,
-- one per type the admin enabled
alter table public.request_field_values
  add column if not exists field_type text;
update public.request_field_values v
  set field_type = d.field_type
  from public.request_field_definitions d
  where v.field_definition_id = d.id and v.field_type is null;
alter table public.request_field_values
  alter column field_type set not null;

alter table public.request_field_values
  drop constraint if exists request_field_values_request_id_field_definition_id_key;
alter table public.request_field_values
  add constraint request_field_values_unique
  unique (request_id, field_definition_id, field_type);
