/**
 * Enrich businesses with Place Details (+ reviews for service verticals)
 * and LLM-extracted services/keywords, then re-embed.
 *
 * Usage:
 *   npm run enrich -- ballito
 *   npm run enrich -- ballito --force
 *   npm run enrich -- ballito --vertical=beauticians --limit=10
 */
import { enrichBusinessService } from "@/services/enrichment/enrich-business.service";

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let force = false;
  let vertical: string | undefined;
  let limit: number | undefined;

  for (const arg of argv) {
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg.startsWith("--vertical=")) {
      vertical = arg.slice("--vertical=".length).trim() || undefined;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
      continue;
    }
    if (arg.startsWith("-")) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
    positional.push(arg);
  }

  return {
    citySlug: positional[0] ?? "ballito",
    force,
    vertical,
    limit,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(
    `Enriching ${opts.citySlug}` +
      (opts.vertical ? ` (vertical=${opts.vertical})` : "") +
      (opts.limit != null ? ` limit=${opts.limit}` : "") +
      (opts.force ? " force=true" : "") +
      "...",
  );

  const result = await enrichBusinessService.enrichCity(opts);
  console.log("Done:", result);
}

main().catch((err) => {
  console.error("Enrichment failed:", err);
  process.exit(1);
});
