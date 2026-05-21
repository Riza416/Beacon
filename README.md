# Beacon

Internal platform where cross-functional teams (Compliance, Finance, Ops, etc.) submit product requests to the product team.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn-style UI · Supabase (Auth + Postgres + Storage + RLS) · Vercel

---

## Quick start

```bash
# 1. Install deps
npm install

# 2. Set env vars
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL

# 3. Apply DB schema to your Supabase project
# Option A — via Supabase CLI (recommended):
supabase link --project-ref <your-ref>
supabase db push

# Option B — via Supabase Studio:
# Paste each file in supabase/migrations/ into the SQL editor in order.

# 4. Run
npm run dev
```

Sign in with a magic link. The **first user to sign up becomes admin**; everyone else defaults to `user`.

---

## Architecture

```
app/
  (app)/                # auth-gated routes share a layout that calls requireProfile()
    page.tsx            # dashboard
    admin/              # admin-only — layout calls requireAdmin()
      teams/
      requirements/     # field builder
      statuses/
    requests/
      new/              # creates a draft and redirects to /edit
      [id]/
        edit/           # dynamic form, save draft, submit
        page.tsx        # read-only detail + admin controls
      mine/             # user's own requests
  auth/
    callback/route.ts   # magic-link exchange
    signout/route.ts
  login/page.tsx

components/
  ui/                   # shadcn-style primitives (Button, Input, Card, Dialog, ...)
  nav.tsx
  request-form.tsx      # dynamic form rendered from configured fields

lib/
  supabase/
    server.ts           # createServerClient for server components / actions
    client.ts           # createBrowserClient for client components
    middleware.ts       # session refresh + redirect-to-login
    admin.ts            # service-role client, server-only, RLS-bypassing
  auth.ts               # getCurrentProfile, requireProfile, requireAdmin
  actions/utils.ts      # authedAction / adminAction helpers
  types.ts
  utils.ts              # cn() + formatDate()

middleware.ts           # wraps every non-public route in session refresh

supabase/
  migrations/
    0001_init.sql       # schema + auto-profile trigger + is_admin() helper
    0002_rls.sql        # row-level security policies
    0003_seed.sql       # default statuses
    0004_storage.sql    # request-attachments bucket + policies
```

## Roles & permissions

- **First user** to sign up is automatically promoted to `admin`. Subsequent users default to `user`.
- Admins can configure teams, statuses, and field requirements; can edit/delete any request; can update any status and paste Notion URLs.
- Users can create requests, save drafts, prioritize their own requests, and submit. They cannot edit submitted requests (admins can).
- RLS enforces these rules at the database layer. The middleware + `requireAdmin()` enforce them at the app layer too.

## Data model

| Table                       | Purpose                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| `profiles`                  | 1:1 with `auth.users`; carries role + team_id                             |
| `teams`                     | Functional teams (Compliance, Finance, Ops, ...)                          |
| `statuses`                  | Configurable workflow statuses (label, color, is_default, is_terminal)    |
| `request_field_definitions` | Configurable field schema for the request form                            |
| `requests`                  | Submitted requests (state: draft / submitted)                             |
| `request_field_values`      | Values for the configured fields, one row per (request, field_definition) |
| `request_collaborators`     | Users tagged for feedback on a request                                    |
| `request_team_tags`         | Teams tagged for feedback on a request                                    |
| `comments`                  | Comment thread per request                                                |

## Notes for the POC

- **Drag-and-drop reordering** is replaced with up/down arrow buttons in v1.
- **Collaboration / tagging / @mentions** are scaffolded in the schema but not wired into the UI yet.
- **Notifications** are not implemented (no in-app badge, no email).
- **Audit trail** for status changes is not implemented (just `updated_at`).
- **Empty states** and **loading skeletons** are minimal.

## Deploying to Vercel

1. Connect the repo to Vercel.
2. Set the same env vars in the Vercel project settings.
3. Set `NEXT_PUBLIC_SITE_URL` to the Vercel URL (or your custom domain).
4. In Supabase Auth → URL Configuration, add the Vercel URL to "Redirect URLs."
5. **Authentication is required by default** — Beacon redirects unauthenticated visitors to `/login`. Do not disable this.
