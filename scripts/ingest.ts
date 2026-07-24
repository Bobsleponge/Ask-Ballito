/**
 * Ingest businesses from Google Places.
 *
 * Merge budgeted local-service verticals (no wipe):
 *   npm run ingest -- ballito --merge --confirm-paid
 *
 * Merge a single vertical (no wipe):
 *   npm run ingest -- ballito --merge --vertical=fabrication --confirm-paid
 *
 * Merge several verticals (comma-separated, no wipe):
 *   npm run ingest -- ballito --merge --vertical=electronics,tyres,surf-shops --confirm-paid
 *
 * Full replace (wipes city google_places rows — avoid unless intentional):
 *   npm run ingest -- ballito --replace --confirm-paid
 *
 * Requires --confirm-paid because Places Text Search + OpenAI embeddings are billable.
 */
import { getCity } from "@/config/cities";
import {
  VERTICALS,
  TOP_PER_VERTICAL,
  MAX_CITY_BUSINESSES,
  LOCAL_SERVICE_BUSINESS_BUDGET,
  localServiceBudgetUsed,
  localServiceVerticals,
  getVertical,
  topForVertical,
} from "@/config/verticals";
import { ingestForCity, mergeIngestForCity } from "@/services/ingestion/ingest";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const confirmPaid = args.includes("--confirm-paid");
  const merge = args.includes("--merge");
  const replace = args.includes("--replace");
  const verticalArg = args.find((a) => a.startsWith("--vertical="));
  const verticalSlug = verticalArg?.slice("--vertical=".length)?.trim();
  const slug = args.find((a) => !a.startsWith("--")) ?? "ballito";

  if (!confirmPaid) {
    console.error(
      [
        "Refusing to run ingest: Google Places + OpenAI embeddings are billable.",
        "",
        "Merge only the budgeted local-service verticals (no wipe):",
        `  npm run ingest -- ${slug} --merge --confirm-paid`,
        "",
        "Merge one vertical (no wipe):",
        `  npm run ingest -- ${slug} --merge --vertical=fabrication --confirm-paid`,
        "",
        "Full replace (wipes existing google_places for the city):",
        `  npm run ingest -- ${slug} --replace --confirm-paid`,
      ].join("\n"),
    );
    process.exit(1);
  }

  if (merge === replace) {
    console.error("Specify exactly one of --merge or --replace.");
    process.exit(1);
  }

  const city = getCity(slug);
  if (!city) {
    console.error(`Unknown city slug: "${slug}".`);
    process.exit(1);
  }

  if (replace) {
    console.log(
      `REPLACE ingest across ${VERTICALS.length} verticals for ${city.name} (wipes existing google_places)...`,
    );
    const result = await ingestForCity({
      city,
      verticals: VERTICALS,
      topPerVertical: TOP_PER_VERTICAL,
      maxBusinesses: MAX_CITY_BUSINESSES,
    });
    console.log("Done:", result);
    for (const [vert, count] of Object.entries(result.byVertical)) {
      console.log(`  ${vert}: ${count}`);
    }
    return;
  }

  let verticals;
  if (verticalSlug) {
    const slugs = verticalSlug
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    verticals = [];
    for (const s of slugs) {
      const v = getVertical(s);
      if (!v) {
        console.error(`Unknown vertical: "${s}".`);
        process.exit(1);
      }
      verticals.push(v);
    }
  } else {
    verticals = localServiceVerticals();
  }

  const budget = localServiceBudgetUsed();
  console.log(
    `MERGE ingest for ${city.name}: ${verticals.length} vertical(s) (local-service budget ${budget}/${LOCAL_SERVICE_BUSINESS_BUDGET}, no wipe)...`,
  );
  for (const v of verticals) {
    console.log(`  ${v.slug}: top ${topForVertical(v)}`);
  }

  const result = await mergeIngestForCity({
    city,
    verticals,
    topPerVertical: TOP_PER_VERTICAL,
    maxBusinesses: MAX_CITY_BUSINESSES,
  });

  console.log("Done:", result);
  for (const [vert, count] of Object.entries(result.byVertical)) {
    console.log(`  ${vert}: ${count}`);
  }
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
