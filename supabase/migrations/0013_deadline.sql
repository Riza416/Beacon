-- Optional deadline (day-level) on requests.
alter table public.requests
  add column if not exists deadline date;

create index if not exists requests_deadline_idx on public.requests(deadline);
