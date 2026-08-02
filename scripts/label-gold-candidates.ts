/**
 * Dump top-10 search candidates for core (labelingTier=full) gold questions.
 * Human curators pick Top-1 / Top-3 IDs into evals/gold/labels/<id>.json
 *
 * Usage:
 *   EVAL_LIVE=1 npm run eval:label-candidates
 *   EVAL_LIVE=1 npm run eval:label-candidates -- --limit=20
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCity } from "../src/config/cities";
import { businessSearchService } from "../src/services/ai/business-search.service";
import {
  loadGoldDataset,
  coreQuestions,
} from "../src/services/eval/gold";

async function main() {
  if (process.env.EVAL_LIVE !== "1") {
    console.error("Set EVAL_LIVE=1 to dump live candidates from staging/local DB.");
    process.exit(1);
  }

  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  const dataset = loadGoldDataset();
  let core = coreQuestions(dataset);
  if (limit && limit > 0) core = core.slice(0, limit);

  const outDir = join(process.cwd(), "evals", "gold", "candidates");
  mkdirSync(outDir, { recursive: true });

  console.log(`Dumping candidates for ${core.length} core questions…`);

  let done = 0;
  for (const q of core) {
    const city = getCity(q.city);
    if (!city) {
      console.warn(`skip ${q.id}: unknown city`);
      continue;
    }

    const labelPath = join(
      process.cwd(),
      "evals",
      "gold",
      "labels",
      `${q.id}.json`,
    );
    if (existsSync(labelPath)) {
      const existing = JSON.parse(readFileSync(labelPath, "utf8")) as {
        expectTop1Ids?: string[];
      };
      if (existing.expectTop1Ids && existing.expectTop1Ids.length > 0) {
        console.log(`  skip ${q.id} (already labeled)`);
        continue;
      }
    }

    try {
      const results = await businessSearchService.search({
        query: q.query,
        citySlug: city.slug,
        limit: 10,
      });
      const payload = {
        questionId: q.id,
        query: q.query,
        city: q.city,
        expectVertical: q.expectVertical ?? null,
        dumpedAt: new Date().toISOString(),
        candidates: results.map((b, i) => ({
          rank: i + 1,
          id: b.id,
          name: b.name,
          category: b.category,
          rating: b.rating,
          similarity: b.similarity,
        })),
        /** Fill these, then run: npm run eval:apply-labels */
        draft: {
          expectTop1Ids: [] as string[],
          expectTop3Ids: [] as string[],
          notes: "",
        },
      };
      writeFileSync(
        join(outDir, `${q.id}.json`),
        JSON.stringify(payload, null, 2) + "\n",
      );
      done += 1;
      console.log(`  ok  ${q.id} (${results.length} candidates)`);
    } catch (err) {
      console.error(
        `  FAIL ${q.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`\nWrote ${done} candidate dumps → evals/gold/candidates/`);
  console.log(
    "Curate Top-1/Top-3 into evals/gold/labels/<id>.json then run npm run eval:apply-labels",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
