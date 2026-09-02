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

# Also fetch each freelancer's work and sync it into the gigs table
pnpm sync-contra --gigs
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

## Troubleshooting: "An unexpected error occurred"

The sync and work scripts talk to Contra's **internal Relay persisted-query API** at `https://contra.com/api/`. Instead of sending the full GraphQL query text, the client sends a `doc_id` — a server-registered hash that maps to the stored query. These hashes are hard-coded constants:

- `scripts/sync-contra.mts` → `DOC_ID` (the discover feed query)
- `scripts/contra-work.mts` → `DOC_ID` (the per-freelancer gigs / portfolio query)

When Contra ships a frontend rework they regenerate these persisted-query hashes, so the old `doc_id` stops resolving and the API returns the generic error:

```json
{"errors":[{"message":"An unexpected error occurred.", ...}}
```

The operation names, the section-ID parsing regexes, and the response JSON shapes all stay the same — **only the `doc_id` hashes go stale**.

### How to find the new `doc_id`

Contra's new frontend is built with Vite/Rolldown and serves its JS from `builds.contra.com/assets/assets/...`. Each Relay persisted query is embedded in a bundle chunk as a `params` object with an `id` field equal to the `doc_id`.

1. **Discover feed** (`sync-contra.mts`) — load one of the discover page's JS chunks and search for the operation name:
   ```sh
   curl -s "https://contra.com/discover?view=people&sort=most-earned" \
     -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36" \
   | grep -o 'builds\.contra\.com[^"]*\.js' \
   | sort -u > /tmp/chunks.txt

   # download each chunk, then:
   grep -o 'params:..{id:`[a-f0-9]\{32\}`.*name:`DiscoverSearchIndependentsSectionRefetchQuery`' /tmp/*.js
   ```

2. **Gigs / portfolio** (`contra-work.mts`) — apply the same process to a freelancer's work page (`https://contra.com/<username>/work`), searching for `PageUserProfileProjectsPaginationQuery`.

Look for the Relay `params` block of the form:

```js
params:{id:`<32-hex-hash>`,metadata:{},name:`<OperationName>`,operationKind:`query`,text:null}
```

The 32-hex `id` is the new `doc_id` to use. Update the corresponding `DOC_ID` constant in the script and re-run.

> Tip: verify a candidate before editing — the section ID printed by the script decode step, or a fresh one from the page HTML (`["UserProfile",<id>]` base64), can be POSTed to the API to confirm the hash returns `data` instead of `errors`.
