/**
 * Refresh knowledge cards locally (no cron auth).
 * Usage: tsx --env-file=.env.local --require ./scripts/shim-server-only.cjs scripts/refresh-knowledge-cards.ts [city]
 */
import { refreshAllKnowledgeCards } from "../src/services/knowledge/knowledge-cards.service";

async function main() {
  const citySlug = process.argv[2] || "ballito";
  console.log(`Refreshing knowledge cards for ${citySlug}...`);
  const result = await refreshAllKnowledgeCards(citySlug);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
