-- Beacon: @mentions inside comments.
--
-- A commenter can tag people directly in a comment. Each mention is recorded
-- here (for reliable highlighting + an audit trail). The act of mentioning also
-- adds the person as a request collaborator (handled in the addComment action),
-- which reuses the existing "Tagged — awaiting your reply" inbox + notification
-- bell, so nothing new is needed for the in-app surface.

create table if not exists public.comment_mentions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists comment_mentions_user_idx
  on public.comment_mentions(user_id);

alter table public.comment_mentions enable row level security;

-- Read: anyone who can see the parent comment's request (reuses the private-
-- request audience test from 0025).
create policy cm_read on public.comment_mentions
  for select to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = comment_id
        and public.can_view_request(c.request_id, auth.uid())
    )
  );

-- Insert: only the author of the comment being annotated (or an admin).
create policy cm_author_insert on public.comment_mentions
  for insert to authenticated
  with check (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.comments c
      where c.id = comment_id and c.author_id = auth.uid()
    )
  );

create policy cm_admin_all on public.comment_mentions
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
