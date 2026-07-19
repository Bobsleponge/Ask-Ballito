/**
 * Removes fake/seeded test businesses (provider = "seed") from the database.
 * Live data comes only from Google Places ingest + enrichment.
 *
 * Usage:
 *   npm run clear:seed
 *   npm run clear:seed -- ballito
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const citySlug = process.argv[2];

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase.from("businesses").delete({ count: "exact" }).eq("provider", "seed");
  if (citySlug) {
    query = query.eq("city_slug", citySlug);
  }

  const { error, count } = await query;
  if (error) throw new Error(error.message);

  const scope = citySlug ? ` for ${citySlug}` : "";
  console.log(`Removed ${count ?? 0} fake/seeded businesses${scope}.`);
}

main().catch((err) => {
  console.error("Clear seed failed:", err?.message ?? err);
  process.exit(1);
});
