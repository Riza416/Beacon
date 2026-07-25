// Centralized PostgREST select strings. The `requests` table has multiple FK
// paths to `teams` and `profiles` (via the tag junction tables), so every
// embed MUST name its foreign key explicitly or PostgREST throws PGRST201 at
// runtime. Defining the embeds here once — instead of re-typing them on each
// page — means a select can never silently ship without its FK hint.

/** Joined status + team + product + author for request list/card views. */
export const REQUEST_CARD_SELECT =
  "id, title, summary, state, priority, team_priority, workstream_priority, team_id, product_id, status_id, submitted_at, updated_at, notion_url, deadline, author_id, is_private, " +
  "status:statuses(id, label, color), " +
  "team:teams!requests_team_id_fkey(id, name), " +
  "product:products(id, name), " +
  "author:profiles!requests_author_id_fkey(full_name, email), " +
  "supporters:request_supporters(count)";

/** Full request row + joins for the detail page. */
export const REQUEST_DETAIL_SELECT =
  "*, " +
  "status:statuses(id, label, color), " +
  "product:products(id, name), " +
  "project:projects(id, name), " +
  "owner:profiles!requests_owner_id_fkey(id, full_name, email), " +
  "author:profiles!requests_author_id_fkey(full_name, email)";

/** Compact request row for the per-team listings on the team detail page. */
export const TEAM_REQUEST_SELECT =
  "id, title, state, team_priority, notion_url, updated_at, " +
  "status:statuses(id, label, color, is_terminal), " +
  "product:products(id, name), " +
  "author:profiles!requests_author_id_fkey(full_name, email)";

/** Comment + author, used on the request detail page. */
export const COMMENT_SELECT =
  "*, author:profiles!comments_author_id_fkey(full_name, email)";

/** Team row + member count (explicit FK so the count isn't ambiguous). */
export const TEAM_WITH_MEMBER_COUNT_SELECT =
  "*, members:profiles!profiles_team_id_fkey(count)";
