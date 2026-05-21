-- Beacon: add 'multi_select' to request_field_definitions.field_type

alter table public.request_field_definitions
  drop constraint if exists request_field_definitions_field_type_check;

alter table public.request_field_definitions
  add constraint request_field_definitions_field_type_check
  check (field_type in (
    'short_text','long_text','url','file','image','select','multi_select','checkbox'
  ));
