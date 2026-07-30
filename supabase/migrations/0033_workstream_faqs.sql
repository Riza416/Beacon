-- Beacon: per-workstream FAQs.
--
-- Each workstream gets a homepage (/workstreams/[id]) where its owning team can
-- publish guidance for the teams that file requests into it: what belongs here,
-- how to phrase an ask, where the docs/repos live, lead times, and so on.
--
-- Answers are stored as lightweight markdown TEXT and rendered by an explicit
-- element-building renderer in the app (links, lists, bold, code) — never as raw
-- HTML — so a workstream owner can format freely without opening an XSS hole.

/**
 * May `uid` manage `pid`'s workstream settings? Global admins always; otherwise
 * a member of an owning team who can edit workstreams (team admin, or granted
 * can_edit_products). Mirrors canEditProducts + team ownership in the app.
 */
create or replace function public.can_manage_workstream(pid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(uid) or exists (
    select 1
    from public.profiles p
    join public.product_owners po on po.team_id = p.team_id
    where p.id = uid
      and po.product_id = pid
      and (p.role = 'team_admin' or p.can_edit_products = true)
  );
$$;
revoke all on function public.can_manage_workstream(uuid, uuid) from public;
grant execute on function public.can_manage_workstream(uuid, uuid) to authenticated;

create table if not exists public.workstream_faqs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  question text not null,
  answer text not null default '',
  display_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workstream_faqs_product_idx
  on public.workstream_faqs(product_id, display_order);

alter table public.workstream_faqs enable row level security;

-- Read: any approved user (FAQs are guidance meant to be discoverable).
create policy wfaq_read on public.workstream_faqs
  for select to authenticated
  using (public.is_approved(auth.uid()));

-- Write: whoever manages the workstream.
create policy wfaq_manage on public.workstream_faqs
  for all to authenticated
  using (public.can_manage_workstream(product_id, auth.uid()))
  with check (public.can_manage_workstream(product_id, auth.uid()));
