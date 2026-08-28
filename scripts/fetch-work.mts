#!/usr/bin/env tsx
/**
 * Fetch the gigs / portfolio projects (work) for a specific Contra freelancer.
 *
 * Usage:
 *   pnpm fetch-work --url https://contra.com/mark_vassilevskiy/work
 *   pnpm fetch-work --url https://contra.com/mark_vassilevskiy
 *   pnpm fetch-work mark_vassilevskiy
 */

import chalk from "chalk";
import {
  usernameFromUrl,
  fetchUserProfileSectionId,
  fetchPortfolioProjects,
  parsePaidCost,
} from "./contra-work.mts";

interface Gig {
  title: string;
  publishedAt: string | null;
  slug: string | null;
  cost: { currency: string; amount: number } | null;
  client: string | null;
}

function toGig(p: Record<string, unknown>): Gig {
  const vp = (p.verifiedPaidProject as
    | { paidProject?: { paidToDate?: string | null; client?: { userProfile?: { firstName?: string | null; lastName?: string | null } | null } | null } | null }
    | null
    | undefined) ?? null;
  const paid = vp?.paidProject ?? null;
  const clientUp = paid?.client?.userProfile ?? null;
  return {
    title: (p.title as string) ?? "(untitled)",
    publishedAt: (p.publishedAt as string | null) ?? null,
    slug: (p.slug as string | null) ?? null,
    cost: parsePaidCost(paid?.paidToDate ?? null),
    client: clientUp
      ? [clientUp.firstName, clientUp.lastName].filter(Boolean).join(" ").trim()
      : null,
  };
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

  console.log(chalk.bold.cyan(`\n  ${username}'s work\n  ${chalk.dim("─".repeat(24))}`));

  fetchUserProfileSectionId(username)
    .then(async (sectionId) => {
      console.log(`  ${chalk.dim("section id:")} ${sectionId}`);
      const projects = await fetchPortfolioProjects(sectionId, delay);
      const gigs = projects.map(toGig);

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
