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

# Scrape a specific Contra page
pnpm sync-contra --url https://contra.com/discover?view=people&sort=newest

# Adjust delay between API calls (ms, default 2000)
pnpm sync-contra --delay 3000
```
