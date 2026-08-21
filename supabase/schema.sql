-- Freelancer profiles table for contra-mrr.
-- Matches data/freelancers.csv columns (snake_cased by scripts/import-csv.mjs).

create table if not exists freelancers (
  id uuid primary key default gen_random_uuid(),
  link text not null,
  display_username text not null unique,
  platform_earnings_badge text,
  profile_image_url text,
  hired_count integer not null default 0 check (hired_count >= 0),
  first_name text not null,
  last_name text not null,
  title text,
  created_at timestamptz not null default now()
);

-- Public read-only: the page displays this directory publicly;
-- writes go through the service role key only.
alter table freelancers enable row level security;

drop policy if exists "public read freelancers" on freelancers;
create policy "public read freelancers"
  on freelancers
  for select
  using (true);
