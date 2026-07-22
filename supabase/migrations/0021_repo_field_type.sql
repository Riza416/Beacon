-- Beacon: a "repo" field type + a per-workstream repo link.
--
-- A repo field is configured by the workstream OWNER (one repo URL per
-- workstream, stored on workstream_field_config.repo_url) and shown to authors
-- with "Request access" / "Branch off" links. It is NOT an author-filled value.

-- Allow 'repo' in both field-type constraints on request_field_definitions.
alter table public.request_field_definitions
  drop constraint if exists request_field_definitions_field_type_check;
alter table public.request_field_definitions
  add constraint request_field_definitions_field_type_check
  check (field_type in
    ('short_text','long_text','url','file','image','select','multi_select','checkbox','repo'));

alter table public.request_field_definitions
  drop constraint if exists request_field_definitions_field_types_check;
alter table public.request_field_definitions
  add constraint request_field_definitions_field_types_check check (
    field_types <@ array[
      'short_text','long_text','url','file','image','select','multi_select','checkbox','repo'
    ]::text[]
    and coalesce(array_length(field_types, 1), 0) >= 1
  );

-- The owner-configured repo URL for a repo field within a workstream.
alter table public.workstream_field_config
  add column if not exists repo_url text;
