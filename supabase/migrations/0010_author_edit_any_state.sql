-- Allow the request author to update their own requests regardless of state.
-- Previously they could only edit drafts; once submitted, the row was
-- effectively frozen except to admins. The product decision is now that
-- authors can keep editing their own submissions in-place.

drop policy if exists requests_author_update_draft on public.requests;

create policy requests_author_update_own
  on public.requests for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
