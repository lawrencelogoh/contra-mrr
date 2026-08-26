import { getSupabaseServerClient } from "@/lib/supabase";
import FreelancersTable, { type Freelancer } from "./freelancers-table";

export const revalidate = 60;

async function getFreelancers(): Promise<Freelancer[]> {
  const supabase = getSupabaseServerClient();
  const PAGE_SIZE = 1000;

  const freelancers: Freelancer[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from("freelancers")
      .select(
        "link, display_username, platform_earnings_badge, hired_count, first_name, last_name, title, rating"
      )
      .order("feed_position", { nullsFirst: false })
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
