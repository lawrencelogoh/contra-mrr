-- Freelancer profiles table for contra-mrr.
-- Matches data/discover__sort-most-earned_earners.csv columns
-- (snake_cased by scripts/import-csv.mjs).

create table if not exists freelancers (
  id uuid primary key default gen_random_uuid(),
  link text not null,
  display_username text not null unique,
  platform_earnings_badge text,
  profile_image_url text,
  hired_count integer not null default 0 check (hired_count >= 0),
  rating real check (rating is null or rating between 0 and 5),
  first_name text not null,
  last_name text,
  title text,
  location text,
  minimum_hourly_rate integer,
  is_currently_available boolean,
  follower_count integer,
  feed_position integer,
  created_at timestamptz not null default now()
);

-- Upgrade path for tables created before the discover export columns existed.
alter table freelancers add column if not exists location text;
alter table freelancers add column if not exists minimum_hourly_rate integer;
alter table freelancers add column if not exists is_currently_available boolean;
alter table freelancers add column if not exists follower_count integer;
alter table freelancers add column if not exists feed_position integer;
alter table freelancers alter column last_name drop not null;

-- Public read-only: the page displays this directory publicly;
-- writes go through the service role key only.
alter table freelancers enable row level security;

drop policy if exists "public read freelancers" on freelancers;
create policy "public read freelancers"
  on freelancers
  for select
  using (true);
