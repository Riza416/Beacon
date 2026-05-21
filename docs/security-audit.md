# Beacon RLS audit

Snapshot of row-level security policies per table, sourced from the migrations in
`supabase/migrations/`. Quotes refer to policy names exactly as declared.

All policies target the `authenticated` role unless noted. `is_admin(auth.uid())`
is a SECURITY DEFINER helper that returns `true` for profiles where `role = 'admin'`.

| Table | Public read? | Who can insert? | Who can update? | Who can delete? | Policy file(s) |
|---|---|---|---|---|---|
| `teams` | Any authenticated user (`teams_read_all`) | Admins only (`teams_admin_all`) | Admins only (`teams_admin_all`) | Admins only (`teams_admin_all`) | `0002_rls.sql` |
| `profiles` | Any authenticated user (`profiles_read_all`) | Admins only (`profiles_admin_all`) — new rows arrive via the `auth.users` trigger in `0001_init.sql`; runtime inserts are admin-only | Self where `auth.uid() = id` and role unchanged (`profiles_self_update`); admins on any row (`profiles_admin_all`) | Admins only (`profiles_admin_all`) | `0002_rls.sql` |
| `statuses` | Any authenticated user (`statuses_read_all`) | Admins only (`statuses_admin_all`) | Admins only (`statuses_admin_all`) | Admins only (`statuses_admin_all`) | `0002_rls.sql` |
| `request_field_definitions` | Any authenticated user (`rfd_read_all`) | Admins only (`rfd_admin_all`) | Admins only (`rfd_admin_all`) | Admins only (`rfd_admin_all`) | `0002_rls.sql` |
| `requests` | Any authenticated user (`requests_read_all`) | Self as `author_id` (`requests_author_insert`); admins (`requests_admin_all`) | Author while `state = 'draft'` (`requests_author_update_draft`); admins on any row (`requests_admin_all`) | Author while `state = 'draft'` (`requests_author_delete_draft`); admins (`requests_admin_all`) | `0002_rls.sql` |
| `request_field_values` | Any authenticated user (`rfv_read_all`) | Request author while parent request is `draft` (`rfv_author_write`); admins (`rfv_admin_all`) | Request author while parent request is `draft` (`rfv_author_write`); admins (`rfv_admin_all`) | Request author while parent request is `draft` (`rfv_author_write`); admins (`rfv_admin_all`) | `0002_rls.sql` |
| `request_collaborators` | Any authenticated user (`rc_read_all`) | Author of the parent request (`rc_author_write`); admins (`rc_admin_all`) | Author of the parent request (`rc_author_write`); admins (`rc_admin_all`) | Author of the parent request (`rc_author_write`); admins (`rc_admin_all`) | `0002_rls.sql` |
| `request_team_tags` | Any authenticated user (`rtt_read_all`) | Author of the parent request (`rtt_author_write`); admins (`rtt_admin_all`) | Author of the parent request (`rtt_author_write`); admins (`rtt_admin_all`) | Author of the parent request (`rtt_author_write`); admins (`rtt_admin_all`) | `0002_rls.sql` |
| `comments` | Any authenticated user (`comments_read_all`) | Self as `author_id` AND (admin OR request author OR tagged collaborator OR member of a tagged team OR member of the request author's team) (`comments_authorized_insert`); admins (`comments_admin_all`) | Self where `author_id = auth.uid()` (`comments_self_modify`); admins (`comments_admin_all`) | Self where `author_id = auth.uid()` (`comments_self_delete`); admins (`comments_admin_all`) | `0002_rls.sql`, `0008_comment_perms.sql` |
| `request_team_tag_views` | Self where `user_id = auth.uid()` (`rttv_self_read`); admins (`rttv_admin`) — no general read | Self where `user_id = auth.uid()` (`rttv_self_write`); admins (`rttv_admin`) | Self where `user_id = auth.uid()` (`rttv_self_write`); admins (`rttv_admin`) | Self where `user_id = auth.uid()` (`rttv_self_write`); admins (`rttv_admin`) | `0009_tag_views.sql` |

## Notes

- "Public read?" means readable by any authenticated user. Beacon does not expose
  any of these tables to the `anon` role; nothing is internet-public.
- `comments_authorized_insert` (introduced in `0008_comment_perms.sql`) replaces
  the previous `comments_self_insert` policy, which was dropped in the same
  migration.
- `request_field_values`, `request_collaborators`, and `request_team_tags` use
  `policy ... for all`, so the same predicate gates insert, update, and delete.
- `request_team_tag_views` is the only table without an "all authenticated read"
  policy: per-user view records are scoped to the viewing user (or admin).
