/**
 * Offline Knowledge Pipeline runner.
 * Usage: npm run pipeline:run -- ballito
 */
import { runKnowledgePipeline } from "../src/services/knowledge-pipeline";

async function main() {
  const citySlug = process.argv[2] || "ballito";
  const allowLlm = process.argv.includes("--llm");
  const dryRun = process.argv.includes("--dry-run");
  const result = await runKnowledgePipeline({
    citySlug,
    allowLlm,
    dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
  const failed = result.stages.some((s) => !s.ok);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
