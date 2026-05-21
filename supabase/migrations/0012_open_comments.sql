-- Reopen comments to any authenticated user. We previously gated to
-- admin/author/tagged/same-team but the product decision is now that
-- everyone in the org can comment on any request they can see.

drop policy if exists comments_authorized_insert on public.comments;

create policy comments_authenticated_insert
  on public.comments for insert
  to authenticated
  with check (author_id = auth.uid());
