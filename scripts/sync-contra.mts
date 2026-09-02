#!/usr/bin/env tsx
/**
 * Scrape Contra.com freelancer feeds and upsert new profiles into Supabase.
 *
 * Usage:
 *   pnpm sync-contra                     # scrape discover feed, upsert new users (default limit 5000)
 *   pnpm sync-contra --limit 100         # stop after 100 profiles from the API
 *   pnpm sync-contra --dry-run           # show what would change, don't write
 *   pnpm sync-contra --clear             # clear the database before syncing
 *   pnpm sync-contra --url <custom-url>  # scrape a specific Contra page feed
 *   pnpm sync-contra --delay 3000        # ms between API calls (default 2000)
 *   pnpm sync-contra --gigs              # also fetch each freelancer's work and sync into the gigs table
 */

import { createClient } from "@supabase/supabase-js";
import chalk from "chalk";
import {
  fetchUserProfileSectionId,
  fetchPortfolioProjects,
  toGigRecord,
} from "./contra-work.mts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_URL = "https://contra.com/discover?view=people&sort=most-earned";
const API_ENDPOINT = "https://contra.com/api/?operationName=DiscoverSearchIndependentsSectionRefetchQuery";
const DOC_ID = "ee9a23ff9c08ffe6d90d4501ebbb94b1";
const PAGE_SIZE = 24;
const UPSERT_BATCH = 50;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

const SECTION_RE =
  /WyJEaXNjb3ZlclNlYXJjaEluZGVwZW5kZW50c1NlY3Rpb24i[A-Za-z0-9+/=]+/;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--dry-run") flags["dry-run"] = true;
    else if (a === "--clear") flags["clear"] = true;
    else if (a === "--gigs") flags["gigs"] = true;
    else if (a === "--limit" && args[i + 1]) flags["limit"] = args[++i];
    else if (a === "--delay" && args[i + 1]) flags["delay"] = args[++i];
    else if (a === "--url" && args[i + 1]) flags["url"] = args[++i];
  }

  return {
    url: (typeof flags["url"] === "string" ? flags["url"] : null) ?? DEFAULT_URL,
    limit: typeof flags["limit"] === "string" ? parseInt(flags["limit"], 10) : 5000,
    delay: typeof flags["delay"] === "string" ? parseInt(flags["delay"], 10) : 2000,
    dryRun: flags["dry-run"] === true,
    clear: flags["clear"] === true,
    gigs: flags["gigs"] === true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ts() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function log(icon: string, msg: string) {
  console.log(`${chalk.gray(ts())} ${icon}  ${msg}`);
}

// ---------------------------------------------------------------------------
// Contra GraphQL scraper
// ---------------------------------------------------------------------------

interface ContraProfile {
  id: string;
  displayUsername: string | null;
  platformEarningsBadge: string | null;
  profileImageUrl: string | null;
  hiredCount: number | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  location: string | null;
  followerCount: number | null;
  workPreferences: { minimumHourlyRate: number | null; isCurrentlyAvailable: boolean | null } | null;
  visibleUserReviewSummary: { averageScore: number | null } | null;
}

interface FetchResult {
  profiles: ContraProfile[];
  pages: number;
  title: string;
}

async function fetchSectionId(url: string): Promise<{ sectionId: string; title: string; cookie: string }> {
  log(chalk.blue("⟳"), `Loading ${chalk.underline(url)}`);

  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to load page: ${res.status} ${res.statusText}`);

  const html = await res.text();
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch?.[1]?.trim() ?? "unknown";

  const match = html.match(SECTION_RE);
  if (!match) throw new Error("Could not find feed section id in page HTML — layout may have changed or has no feed.");

  const sectionId = match[0];
  const cookies = res.headers.getSetCookie()?.join("; ") ?? "";

  log(chalk.green("✓"), `Page loaded: ${chalk.bold(title)}`);
  return { sectionId, title, cookie: cookies };
}

async function fetchFeed(
  url: string,
  limit: number,
  delayMs: number,
): Promise<FetchResult> {
  const { sectionId, title, cookie } = await fetchSectionId(url);

  log(chalk.blue("⟳"), `Section ID decoded: ${chalk.dim(atob(sectionId))}`);

  const profiles: ContraProfile[] = [];
  const seenIds = new Set<string>();
  let after: string | null = null;
  let page = 0;

  console.log();
  log(chalk.cyan("▸"), `Fetching feed pages (max ${limit === Infinity ? "∞" : limit} profiles)...\n`);

  while (profiles.length < limit) {
    const variables: Record<string, unknown> = {
      first: PAGE_SIZE,
      isStudioContext: false,
      id: sectionId,
    };
    if (after) variables.after = after;

    const resp = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://contra.com",
        Referer: url,
        "X-Contra-Client-Url": url,
        "User-Agent": UA,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({
        doc_id: DOC_ID,
        operationName: "DiscoverSearchIndependentsSectionRefetchQuery",
        variables,
      }),
    });

    if (!resp.ok) throw new Error(`API error on page ${page + 1}: ${resp.status}`);

    const doc = await resp.json();
    const node = doc?.data?.node;
    if (!node) throw new Error(`Unexpected API response on page ${page + 1}: ${JSON.stringify(doc).slice(0, 400)}`);

    const results = node.results;
    const edges: Array<{ node: { userProfile: ContraProfile } }> = results.edges;
    const pageInfo = results.pageInfo;

    page++;
    let newOnPage = 0;

    for (const edge of edges) {
      const up = edge.node.userProfile;
      if (!up?.displayUsername || seenIds.has(up.id)) continue;
      seenIds.add(up.id);
      profiles.push(up);
      newOnPage++;

      const name = [up.firstName, up.lastName].filter(Boolean).join(" ") || chalk.dim("—");
      const title = up.title || chalk.dim("—");
      const earnings = up.platformEarningsBadge || chalk.dim("—");
      const location = up.location || chalk.dim("—");

      console.log(
        `  ${chalk.green("+")}  ${chalk.bold(up.displayUsername)}  ${chalk.dim(name)}  ${chalk.cyan(title)}  ${chalk.yellow(earnings)}  ${chalk.dim(location)}`,
      );

      if (profiles.length >= limit) break;
    }

    const total = chalk.bold(String(profiles.length));
    const pageCount = chalk.dim(`page ${page}`);
    const badge = newOnPage > 0 ? chalk.green(`+${newOnPage} new`) : chalk.dim("+0 new");
    const cursor = pageInfo.hasNextPage ? chalk.dim(`cursor: ${pageInfo.endCursor.slice(0, 12)}…`) : chalk.yellow("end of feed");

    console.log(
      `${chalk.gray(ts())}  │  ${pageCount}  │  ${badge}  │  total ${total}  │  ${cursor}`,
    );

    if (!pageInfo.hasNextPage) {
      break;
    }

    after = pageInfo.endCursor;
    if (profiles.length < limit) await sleep(delayMs);
  }

  console.log("\n");
  log(chalk.green("✓"), `Feed complete: ${chalk.bold(String(profiles.length))} profiles from ${chalk.bold(String(page))} pages`);

  return { profiles, pages: page, title };
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

interface DbProfile {
  link: string;
  display_username: string;
  platform_earnings_badge: string | null;
  hired_count: number;
  first_name: string;
  last_name: string | null;
  title: string | null;
  location: string | null;
  minimum_hourly_rate: number | null;
  is_currently_available: boolean | null;
  follower_count: number | null;
  profile_image_url: string | null;
  rating: number | null;
  feed_position: number | null;
}

function toDbProfile(p: ContraProfile, position: number): DbProfile {
  const wp = p.workPreferences;
  const rev = p.visibleUserReviewSummary;
  return {
    link: `https://contra.com/${p.displayUsername}`,
    display_username: p.displayUsername!,
    platform_earnings_badge: p.platformEarningsBadge || null,
    hired_count: p.hiredCount ?? 0,
    first_name: p.firstName || "",
    last_name: p.lastName || null,
    title: p.title || null,
    location: p.location || null,
    minimum_hourly_rate: wp?.minimumHourlyRate ?? null,
    is_currently_available: wp?.isCurrentlyAvailable ?? null,
    follower_count: p.followerCount ?? null,
    profile_image_url: p.profileImageUrl || null,
    rating: rev?.averageScore ?? null,
    feed_position: position,
  };
}

function profilesEqual(a: DbProfile, b: DbProfile): boolean {
  const keys = [
    "platform_earnings_badge",
    "hired_count",
    "first_name",
    "last_name",
    "title",
    "location",
    "minimum_hourly_rate",
    "is_currently_available",
    "follower_count",
    "profile_image_url",
    "rating",
    "feed_position",
  ] as const;
  for (const k of keys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Gig sync
// ---------------------------------------------------------------------------

interface GigSyncResult {
  newGigs: number;
  gigErrors: number;
}

async function syncGigs(
  supabase: any,
  profiles: ContraProfile[],
  idByUsername: Map<string, string>,
  delayMs: number,
  dryRun: boolean,
): Promise<GigSyncResult> {
  console.log();
  log(chalk.cyan("▸"), "Fetching work (gigs) for each freelancer...\n");

  const upserts: Array<{ freelancer_id: string; project_analytics_id: number; title: string; amount: number | null }> = [];
  let gigErrors = 0;

  for (const profile of profiles) {
    const username = profile.displayUsername;
    if (!username) continue;

    const freelancerId = idByUsername.get(username);
    if (!freelancerId) {
      gigErrors++;
      log(chalk.yellow("!"), `${chalk.bold(username)} — no freelancer id, skipping`);
      continue;
    }

    try {
      const sectionId = await fetchUserProfileSectionId(username);
      const projects = await fetchPortfolioProjects(sectionId, delayMs);
      for (const p of projects) {
        upserts.push({ freelancer_id: freelancerId, ...toGigRecord(p) });
      }
      log(
        chalk.green("+"),
        `${chalk.bold(username)}  ${chalk.dim(String(projects.length))} gigs (${chalk.green(String(upserts.length))} total)`,
      );
      await sleep(delayMs);
    } catch (err) {
      gigErrors++;
      log(chalk.red("✕"), `${chalk.bold(username)} — ${(err as Error).message}`);
    }
  }

  if (dryRun || upserts.length === 0) {
    if (dryRun) log(chalk.magenta("!"), "Dry run — no gigs written to database.");
    else log(chalk.yellow("!"), "No gigs fetched.");
    return { newGigs: dryRun ? upserts.length : 0, gigErrors };
  }

  console.log();
  log(chalk.blue("⟳"), `Upserting ${chalk.bold(String(upserts.length))} gigs into database...`);

  let written = 0;
  for (let i = 0; i < upserts.length; i += UPSERT_BATCH) {
    const batch = upserts.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from("gigs")
      .upsert(batch as any[], { onConflict: "project_analytics_id" });
    if (error) {
      log(chalk.red("✕"), `Gig batch error: ${error.message}`);
      gigErrors += batch.length;
    } else {
      written += batch.length;
    }
  }

  log(chalk.green("✓"), `Gigs upserted: ${chalk.bold(String(written))}`);
  return { newGigs: written, gigErrors };
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

interface SyncResult {
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  totalInDb: number;
  feedTitle: string;
  pages: number;
  elapsed: number;
  newGigs: number;
  gigErrors: number;
}

async function sync(url: string, limit: number, delayMs: number, dryRun: boolean, clear: boolean, withGigs: boolean): Promise<SyncResult> {
  const t0 = Date.now();

  // 1. Fetch from Contra
  const { profiles, pages, title } = await fetchFeed(url, limit, delayMs);

  if (profiles.length === 0) {
    log(chalk.yellow("!"), "No profiles found in feed.");
    return { newCount: 0, updatedCount: 0, unchangedCount: 0, skippedCount: 0, totalInDb: 0, feedTitle: title, pages, elapsed: (Date.now() - t0) / 1000, newGigs: 0, gigErrors: 0 };
  }

  // 2. Load existing usernames from DB
  console.log();
  log(chalk.blue("⟳"), "Loading existing profiles from database...");

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (clear) {
    if (dryRun) {
      log(chalk.magenta("!"), "Dry run — would clear freelancers table.");
    } else {
      log(chalk.red("⟳"), "Clearing freelancers table...");
      const { error } = await supabase.from("freelancers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw new Error(`Failed to clear table: ${error.message}`);
      log(chalk.green("✓"), "Freelancers table cleared.");
    }
  }

  const existingMap = new Map<string, Record<string, unknown>>();
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("freelancers")
      .select("*")
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Database read error: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) existingMap.set(row.display_username, row);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  log(chalk.green("✓"), `Database has ${chalk.bold(String(existingMap.size))} existing profiles`);

  // 3. Classify
  console.log();
  log(chalk.cyan("▸"), "Classifying profiles...\n");

  const toInsert: DbProfile[] = [];
  const toUpdate: Array<{ existing: DbProfile; fresh: DbProfile }> = [];
  let unchanged = 0;
  let skipped = 0;

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    if (!p.displayUsername) {
      skipped++;
      continue;
    }

    const db = toDbProfile(p, i);
    const existing = existingMap.get(p.displayUsername);

    if (!existing) {
      toInsert.push(db);
    } else if (!profilesEqual(existing as unknown as DbProfile, db)) {
      toUpdate.push({ existing: existing as unknown as DbProfile, fresh: db });
    } else {
      unchanged++;
    }
  }

  const newUsers = chalk.bold.green(String(toInsert.length));
  const updatedUsers = chalk.bold.yellow(String(toUpdate.length));
  const unchangedUsers = chalk.dim(String(unchanged));
  const skippedUsers = skipped > 0 ? chalk.red(String(skipped)) : chalk.dim("0");

  log(chalk.green("+"), `New profiles:     ${newUsers}`);
  log(chalk.yellow("↻"), `Updated profiles: ${updatedUsers}`);
  log(chalk.dim("–"), `Unchanged:        ${unchangedUsers}`);
  if (skipped > 0) log(chalk.red("✕"), `Skipped (no username): ${skippedUsers}`);

  // 4. Upsert
  if (dryRun) {
    log(chalk.magenta("итель"), "\n  Dry run — no changes written to database.");
    return {
      newCount: toInsert.length,
      updatedCount: toUpdate.length,
      unchangedCount: unchanged,
      skippedCount: skipped,
      totalInDb: existingMap.size,
      feedTitle: title,
      pages,
      elapsed: (Date.now() - t0) / 1000,
      newGigs: 0,
      gigErrors: 0,
    };
  }

  const all = [...toInsert, ...toUpdate.map((u) => u.fresh)];
  const idByUsername = new Map<string, string>();
  for (const [username, row] of existingMap) {
    if (typeof row.id === "string") idByUsername.set(username, row.id);
  }

  if (all.length > 0) {
    console.log();
    log(chalk.blue("⟳"), `Upserting ${chalk.bold(String(all.length))} profiles into database...\n`);

    let written = 0;
    for (let i = 0; i < all.length; i += UPSERT_BATCH) {
      const batch = all.slice(i, i + UPSERT_BATCH);
      const { data, error } = await supabase
        .from("freelancers")
        .upsert(batch, { onConflict: "display_username" })
        .select("id, display_username");

      if (error) {
        log(chalk.red("✕"), `Batch error: ${error.message}`);
      } else {
        written += batch.length;
        for (const row of data ?? []) {
          if (row.id && row.display_username) idByUsername.set(row.display_username, row.id);
        }
        const pct = Math.round((written / all.length) * 100);
        const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
        process.stdout.write(
          `\r${chalk.gray(ts())}  ${chalk.cyan(bar)}  ${chalk.bold(String(written))}/${chalk.bold(String(all.length))}  ${chalk.dim(`${pct}%`)}`,
        );
      }
    }
    console.log("\n");
    log(chalk.green("✓"), `Database updated: ${chalk.bold(String(written))} profiles upserted`);
  } else {
    log(chalk.green("✓"), "All profiles already up to date — nothing to write.");
  }

  let newGigs = 0;
  let gigErrors = 0;
  if (withGigs) {
    const gigResult = await syncGigs(supabase, profiles, idByUsername, delayMs, dryRun);
    newGigs = gigResult.newGigs;
    gigErrors = gigResult.gigErrors;
  }

  const totalInDb = existingMap.size + toInsert.length;
  return {
    newCount: toInsert.length,
    updatedCount: toUpdate.length,
    unchangedCount: unchanged,
    skippedCount: skipped,
    totalInDb,
    feedTitle: title,
    pages,
    elapsed: (Date.now() - t0) / 1000,
    newGigs,
    gigErrors,
  };
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log();
  console.log(chalk.bold.cyan("  Contra → Supabase sync"));
  console.log(chalk.dim("  ─".repeat(24)));

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log(chalk.red("✕"), "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    log(chalk.dim("i"), "Run with: pnpm sync-contra");
    process.exit(1);
  }

  if (opts.dryRun) {
    log(chalk.magenta("!"), chalk.bold("DRY RUN") + " — no changes will be written\n");
  }

  const result = await sync(opts.url, opts.limit, opts.delay, opts.dryRun, opts.clear, opts.gigs);

  console.log();
  console.log(chalk.bold.cyan("  Summary"));
  console.log(chalk.dim("  ─".repeat(24)));
  console.log(`  Feed:        ${chalk.bold(result.feedTitle)}`);
  console.log(`  Pages:       ${result.pages}`);
  console.log(`  New:         ${chalk.green.bold(String(result.newCount))}`);
  console.log(`  Updated:     ${chalk.yellow.bold(String(result.updatedCount))}`);
  console.log(`  Unchanged:   ${chalk.dim(String(result.unchangedCount))}`);
  if (result.skippedCount > 0) console.log(`  Skipped:     ${chalk.red.bold(String(result.skippedCount))}`);
  console.log(`  Total in DB: ${chalk.bold(String(result.totalInDb))}`);
  if (opts.gigs) {
    console.log(`  Gigs:        ${chalk.green.bold(String(result.newGigs))}`);
    if (result.gigErrors > 0) console.log(`  Gig errors:  ${chalk.red.bold(String(result.gigErrors))}`);
  }
  console.log(`  Time:        ${chalk.bold(result.elapsed.toFixed(1) + "s")}`);
  console.log();
}

main().catch((err) => {
  console.error(`\n${chalk.red("✕")} Fatal error: ${err.message}`);
  process.exit(1);
});
