# contra-mrr

A Next.js website for viewing Contra freelancer data.

## Setup

Create a `.env.local` file in the project root with the following variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Install dependencies:

```sh
pnpm install
```

## Development

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Sync Script

There is also a script to scrape Contra.com freelancer profiles and sync them to the database. Profiles that already exist (matched by `display_username`) are updated with any new data. New profiles are inserted.

```sh
# Sync the default discover feed (limit 5000)
pnpm sync-contra

# Set a custom limit
pnpm sync-contra --limit 100

# Preview changes without writing to the database
pnpm sync-contra --dry-run

# Clear the database before syncing
pnpm sync-contra --clear

# Scrape a specific Contra page
pnpm sync-contra --url https://contra.com/discover?view=people&sort=newest

# Adjust delay between API calls (ms, default 2000)
pnpm sync-contra --delay 3000
```

## Work Scripts

Per-freelancer scripts that query Contra's internal GraphQL API for a user's gigs / portfolio projects.

```sh
# Print a freelancer's gigs (title, date, client, and cost when present)
pnpm fetch-work mark_vassilevskiy
pnpm fetch-work --url https://contra.com/mark_vassilevskiy/work

# Dump the raw gig JSON (e.g. for analysis)
pnpm dump-work mark_vassilevskiy
pnpm dump-work mark_vassilevskiy --out mark.json   # writes a clean file
pnpm dump-work --url https://contra.com/mark_vassilevskiy/work

# Note: piping `pnpm dump-work ... > file.json` also captures the pnpm
# banner, so prefer `--out <file>` or run via `npx tsx scripts/dump-work.mts`.
```
