-- Beacon: per-team Slack incoming-webhook for workstream-owner alerts.
--
-- A workstream's new/updated-request alerts post to the owning team's Slack
-- channel. The webhook URL is a CREDENTIAL (anyone holding it can post to the
-- channel), so it lives in its own table — NOT on the world-readable teams
-- table — with RLS that lets only admins read/write directly. Team admins
-- manage their own team's webhook through the service-role client after a
-- server-side check (requireTeamManager); the alert sender reads it the same
-- way. Regular members can never read it.

create table if not exists public.team_slack_webhooks (
  team_id uuid primary key references public.teams(id) on delete cascade,
  webhook_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_slack_webhooks enable row level security;

-- Only global admins get a direct RLS grant. No select policy for regular
-- authenticated users, so the secret is never exposed through the API.
create policy team_slack_webhooks_admin_all on public.team_slack_webhooks
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
