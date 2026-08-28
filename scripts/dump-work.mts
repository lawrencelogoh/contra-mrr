#!/usr/bin/env tsx
/**
 * Dump the raw gigs / portfolio projects JSON for a specific Contra freelancer.
 *
 * Usage:
 *   pnpm dump-work mark_vassilevskiy                    # print JSON to stdout
 *   pnpm dump-work mark_vassilevskiy --out mark.json    # write to a file
 *   pnpm dump-work --url https://contra.com/.../work    # from a profile/work URL
 *
 * Note: piping pnpm output redirects the package-manager banner too, so prefer
 * `--out <file>`, or run `npx tsx scripts/dump-work.mts <user> > file.json`.
 */

import { writeFileSync } from "node:fs";
import chalk from "chalk";

const API_ENDPOINT =
  "https://contra.com/api/?operationName=PageUserProfileProjectsPaginationQuery";
const DOC_ID = "5447a11029b57c79070f9f60b30dd8ca";
const PAGE_SIZE = 100;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

const USER_PROFILE_PREFIX = "WyJVc2VyUHJvZmlsZSIs";

function usernameFromUrl(url: string): string {
  const match = url.replace(/\/+$/, "").match(/contra\.com\/([^/?#]+)/);
  return match?.[1] ?? url.trim();
}

async function fetchSectionId(username: string): Promise<string> {
  const url = `https://contra.com/${username}/work`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to load work page: ${res.status} ${res.statusText}`);

  const html = await res.text();
  const i = html.indexOf("userProfileByUsername(");
  if (i === -1) throw new Error("Could not find user profile in page HTML");

  const j = html.indexOf(USER_PROFILE_PREFIX, i);
  if (j === -1) throw new Error("Could not find user section id in page HTML");

  let k = j;
  while (k < html.length && /[A-Za-z0-9+/=]/.test(html[k])) k++;
  return html.slice(j, k);
}

async function fetchAllGigs(sectionId: string): Promise<unknown[]> {
  const all: unknown[] = [];
  const seen = new Set<string>();
  let after: string | null = null;

  while (true) {
    const resp = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://contra.com",
        Referer: `https://contra.com/${sectionId}`,
        "X-Contra-Client-Url": "https://contra.com",
        "User-Agent": UA,
      },
      body: JSON.stringify({
        doc_id: DOC_ID,
        operationName: "PageUserProfileProjectsPaginationQuery",
        variables: { id: sectionId, first: PAGE_SIZE, after: after ?? null },
      }),
    });

    if (!resp.ok) throw new Error(`API error: ${resp.status} ${resp.statusText}`);

    const doc = await resp.json();
    const node = doc?.data?.node;
    const projects = node?.paginatedPortfolioProjects;
    if (!projects) throw new Error(`Unexpected API response: ${JSON.stringify(doc).slice(0, 300)}`);

    for (const edge of projects.edges ?? []) {
      const p = edge?.node;
      if (!p?.id || seen.has(p.id)) continue;
      seen.add(p.id);
      all.push(p);
    }

    if (!projects.pageInfo?.hasNextPage) break;
    after = projects.pageInfo.endCursor;
  }

  return all;
}

function main() {
  const args = process.argv.slice(2);
  let url = args[0] ?? "";
  let out: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) url = args[++i];
    else if (args[i] === "--out" && args[i + 1]) out = args[++i];
  }

  if (!url) {
    console.error(chalk.yellow("Usage:") + " pnpm dump-work <username-or-url> [--out <file>]");
    process.exit(1);
  }

  const username = usernameFromUrl(url);

  fetchSectionId(username)
    .then(async (sectionId) => {
      const gigs = await fetchAllGigs(sectionId);
      const output = {
        username,
        sectionId,
        fetchedAt: new Date().toISOString(),
        gigs,
      };
      const json = JSON.stringify(output, null, 2) + "\n";
      if (out) {
        writeFileSync(out, json);
        console.error(chalk.green(`✓ Wrote ${gigs.length} gigs to ${out}`));
      } else {
        process.stdout.write(json);
      }
    })
    .catch((err) => {
      console.error(`\n${chalk.red("✕")} ${err.message}\n`);
      process.exit(1);
    });
}

main();
