-- Beacon: a "prd" (product requirements document) field type.
--
-- Behaves like long text in storage — the value lives in
-- request_field_values.value_text — but the request form pairs it with an
-- expandable "how to write a PRD" guide and a starter outline, so a requester
-- filling one in for the first time has the structure to hand.
--
-- request_field_values.field_type has no CHECK constraint, so only the two
-- constraints on request_field_definitions need widening.

alter table public.request_field_definitions
  drop constraint if exists request_field_definitions_field_type_check;
alter table public.request_field_definitions
  add constraint request_field_definitions_field_type_check
  check (field_type in
    ('short_text','long_text','url','file','image','select','multi_select','checkbox','repo','prd'));

alter table public.request_field_definitions
  drop constraint if exists request_field_definitions_field_types_check;
alter table public.request_field_definitions
  add constraint request_field_definitions_field_types_check check (
    field_types <@ array[
      'short_text','long_text','url','file','image','select','multi_select','checkbox','repo','prd'
    ]::text[]
    and coalesce(array_length(field_types, 1), 0) >= 1
  );
