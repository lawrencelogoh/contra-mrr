import { getSupabaseServerClient } from "@/lib/supabase";
import FreelancersTable, { type Freelancer } from "./freelancers-table";

export const revalidate = 60;

async function getFreelancers(): Promise<Freelancer[]> {
  const supabase = getSupabaseServerClient();
  const PAGE_SIZE = 1000;

  // Aggregate gig earnings (sum of amount) per freelancer. PostgREST blocks
  // SQL aggregate functions here, and the gigs table is small, so load the
  // amounts and total them in JS.
  const gigTotals = new Map<string, number>();
  {
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("gigs")
        .select("freelancer_id, amount")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(`Failed to load gigs: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (row.amount != null) {
          gigTotals.set(row.freelancer_id, (gigTotals.get(row.freelancer_id) ?? 0) + row.amount);
        }
      }
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  const freelancers: Freelancer[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from("freelancers")
      .select(
        "id, link, display_username, platform_earnings_badge, hired_count, first_name, last_name, title, rating"
      )
      .order("feed_position", { nullsFirst: false })
      .order("display_username", { ascending: true })
      .range(freelancers.length, freelancers.length + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to load freelancers: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    freelancers.push(
      ...data.map((row) => ({
        link: row.link,
        displayUsername: row.display_username,
        platformEarningsBadge: row.platform_earnings_badge,
        hiredCount: row.hired_count,
        firstName: row.first_name,
        lastName: row.last_name,
        title: row.title,
        rating: row.rating,
        gigEarnings: gigTotals.get((row as { id: string }).id) ?? null,
      }))
    );

    if (data.length < PAGE_SIZE) break;
  }

  return freelancers;
}

export default async function Home() {
  const freelancers = await getFreelancers();
  return <FreelancersTable freelancers={freelancers} />;
}
