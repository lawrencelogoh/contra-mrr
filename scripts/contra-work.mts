/**
 * Shared logic for querying a Contra freelancer's gigs (portfolio projects)
 * through Contra's internal Relay persisted GraphQL API.
 *
 * Used by scripts/fetch-work.mts (human-readable listing), dump-work.mts
 * (raw JSON) and sync-contra.mts (DB upsert).
 */

const API_ENDPOINT =
  "https://contra.com/api/?operationName=PageUserProfileProjectsPaginationQuery";
const DOC_ID = "5447a11029b57c79070f9f60b30dd8ca";
const PAGE_SIZE = 100;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

const USER_PROFILE_PREFIX = "WyJVc2VyUHJvZmlsZSIs";

export function usernameFromUrl(url: string): string {
  const match = url.replace(/\/+$/, "").match(/contra\.com\/([^/?#]+)/);
  return match?.[1] ?? url.trim();
}

/** Resolve the user's `["UserProfile", <id>]` section id from their /work page. */
export async function fetchUserProfileSectionId(username: string): Promise<string> {
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

/** Raw portfolio project nodes for a user, paginated until the feed ends. */
export async function fetchPortfolioProjects(
  sectionId: string,
  delayMs = 2000,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
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
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return all;
}

export function parsePaidCost(paidToDate: string | null): { currency: string; amount: number } | null {
  if (!paidToDate) return null;
  const m = paidToDate.match(/^([A-Z]{3}):?([\d.]+)$/);
  if (!m) return null;
  return { currency: m[1], amount: parseFloat(m[2]) };
}

/** Map a raw project node to a gig record ready for the `gigs` table. */
export function toGigRecord(
  p: Record<string, unknown>,
): { project_analytics_id: number; title: string; amount: number | null } {
  const vp = p.verifiedPaidProject as
    | { paidProject?: { paidToDate?: string | null } | null }
    | null
    | undefined;
  const cost = parsePaidCost(vp?.paidProject?.paidToDate ?? null);
  return {
    project_analytics_id: p.analyticsId as number,
    title: (p.title as string) ?? "(untitled)",
    amount: cost?.amount ?? null,
  };
}
