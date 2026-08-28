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
import {
  usernameFromUrl,
  fetchUserProfileSectionId,
  fetchPortfolioProjects,
} from "./contra-work.mts";

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

  fetchUserProfileSectionId(username)
    .then(async (sectionId) => {
      const gigs = await fetchPortfolioProjects(sectionId, 0);
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
