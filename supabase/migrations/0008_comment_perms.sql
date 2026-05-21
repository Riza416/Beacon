-- Beacon: tighten comment insert permissions per ticket 9 spec
-- Previously: any authenticated user could insert their own comment on any request.
-- Now: must be admin, or author of the request, or tagged on the request
-- (collaborator or via team tag), or on the same team as the author.

drop policy if exists comments_self_insert on public.comments;

create policy comments_authorized_insert
  on public.comments for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.is_admin(auth.uid())
      or exists (
        select 1
        from public.requests r
        where r.id = request_id
          and (
            r.author_id = auth.uid()
            or exists (
              select 1 from public.request_collaborators rc
              where rc.request_id = r.id and rc.user_id = auth.uid()
            )
            or exists (
              select 1
              from public.request_team_tags rtt
              join public.profiles me on me.id = auth.uid()
              where rtt.request_id = r.id and rtt.team_id = me.team_id
            )
            or exists (
              select 1
              from public.profiles me, public.profiles author
              where me.id = auth.uid()
                and author.id = r.author_id
                and me.team_id is not null
                and me.team_id = author.team_id
            )
          )
      )
    )
  );
