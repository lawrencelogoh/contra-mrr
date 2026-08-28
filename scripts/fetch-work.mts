#!/usr/bin/env tsx
/**
 * Fetch the gigs / portfolio projects (work) for a specific Contra freelancer.
 *
 * Usage:
 *   pnpm fetch-work --url https://contra.com/mark_vassilevskiy/work
 *   pnpm fetch-work --url https://contra.com/mark_vassilevskiy
 *   pnpm fetch-work mark_vassilevskiy
 *
 * The user's /work page runs a Relay persisted query against Contra's internal
 * GraphQL API (POST /api/?operationName=...). We reuse that exact call:
 *   - resolve the user's UserProfile section id from the page HTML
 *   - paginate their portfolio projects (gigs)
 *   - print title, date, and cost when a paid project exists
 */

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

interface PaidProject {
  paidToDate: string | null;
  client?: { userProfile?: { firstName?: string | null; lastName?: string | null } | null } | null;
}

interface Gig {
  title: string;
  publishedAt: string | null;
  slug: string | null;
  cost: { currency: string; amount: number } | null;
  client: string | null;
}

function parseCost(paidToDate: string | null): { currency: string; amount: number } | null {
  if (!paidToDate) return null;
  const m = paidToDate.match(/^([A-Z]{3}):?([\d.]+)$/);
  if (!m) return null;
  return { currency: m[1], amount: parseFloat(m[2]) };
}

async function fetchGigs(sectionId: string, delayMs: number): Promise<Gig[]> {
  const gigs: Gig[] = [];
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

      const vp = p.verifiedPaidProject;
      const paid: PaidProject | null = vp?.paidProject ?? null;
      const clientUp = paid?.client?.userProfile ?? null;
      gigs.push({
        title: p.title ?? "(untitled)",
        publishedAt: p.publishedAt ?? null,
        slug: p.slug ?? null,
        cost: parseCost(paid?.paidToDate ?? null),
        client: clientUp
          ? [clientUp.firstName, clientUp.lastName].filter(Boolean).join(" ").trim()
          : null,
      });
    }

    if (!projects.pageInfo?.hasNextPage) break;
    after = projects.pageInfo.endCursor;
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return gigs;
}

function main() {
  const args = process.argv.slice(2);
  let url = args[0] ?? "";
  let delay = 2000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) url = args[++i];
    else if (args[i] === "--delay" && args[i + 1]) delay = parseInt(args[++i], 10);
  }

  if (!url) {
    console.log(chalk.yellow("Usage:") + " pnpm fetch-work <username-or-url> [--delay ms]");
    process.exit(1);
  }

  const username = usernameFromUrl(url);
  if (!url.includes("contra.com")) url = `https://contra.com/${username}`;

  console.log(chalk.bold.cyan(`\n  ${username}'s work\n  ${chalk.dim("─".repeat(24))}`));

  fetchSectionId(username)
    .then(async (sectionId) => {
      console.log(`  ${chalk.dim("section id:")} ${sectionId}`);
      const gigs = await fetchGigs(sectionId, delay);

      console.log();
      if (gigs.length === 0) {
        console.log(chalk.yellow("  No gigs found."));
      } else {
        for (const g of gigs) {
          const cost = g.cost ? chalk.green(`${g.cost.currency} ${g.cost.amount}`) : chalk.dim("—");
          const client = g.client ? chalk.dim(`for ${g.client}`) : "";
          const date = g.publishedAt ? chalk.dim(g.publishedAt.slice(0, 10)) : "";
          console.log(`  ${chalk.cyan("•")}  ${chalk.bold(g.title)}  ${cost}  ${client}  ${date}`);
        }
      }

      const withCost = gigs.filter((g) => g.cost).length;
      console.log(`\n  ${chalk.bold(String(gigs.length))} gigs, ${chalk.green(String(withCost))} with a cost\n`);
    })
    .catch((err) => {
      console.error(`\n${chalk.red("✕")} ${err.message}\n`);
      process.exit(1);
    });
}

main();
