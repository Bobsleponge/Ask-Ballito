/**
 * Ingest the top businesses per industry vertical from Google Places.
 *
 * Usage:
 *   npm run ingest -- ballito
 *   npm run ingest -- cape-town
 */
import { getCity } from "@/config/cities";
import {
  VERTICALS,
  TOP_PER_VERTICAL,
  MAX_CITY_BUSINESSES,
} from "@/config/verticals";
import { ingestForCity } from "@/services/ingestion/ingest";

async function main() {
  const slug = process.argv[2] ?? "ballito";
  const city = getCity(slug);

  if (!city) {
    console.error(`Unknown city slug: "${slug}".`);
    process.exit(1);
  }

  console.log(
    `Ingesting top ${TOP_PER_VERTICAL}/vertical across ${VERTICALS.length} verticals for ${city.name} (max ${MAX_CITY_BUSINESSES})...`,
  );

  const result = await ingestForCity({
    city,
    verticals: VERTICALS,
    topPerVertical: TOP_PER_VERTICAL,
    maxBusinesses: MAX_CITY_BUSINESSES,
  });

  console.log("Done:", result);
  for (const [slug, count] of Object.entries(result.byVertical)) {
    console.log(`  ${slug}: ${count}`);
  }
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
