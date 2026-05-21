-- Beacon: storage bucket for request attachments

insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', false)
on conflict (id) do nothing;

-- Anyone authenticated can read attachments (request visibility is open across the org)
create policy "attachments read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'request-attachments');

-- Authenticated users can upload to a path prefixed with their own uid
create policy "attachments upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "attachments update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "attachments delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
