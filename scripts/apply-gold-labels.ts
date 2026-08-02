/**
 * Apply curated labels from evals/gold/labels/*.json into questions.json.
 *
 * Label file shape:
 * {
 *   "questionId": "biz-best-breakfast",
 *   "expectTop1Ids": ["uuid"],
 *   "expectTop3Ids": ["uuid", "uuid", "uuid"],
 *   "notes": "optional"
 * }
 *
 * Usage: npm run eval:apply-labels
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import {
  loadGoldDataset,
  applyLabelsToDataset,
  type AppliedLabel,
} from "../src/services/eval/gold";

function main() {
  const labelsDir = join(process.cwd(), "evals", "gold", "labels");
  mkdirSync(labelsDir, { recursive: true });

  if (!existsSync(labelsDir)) {
    console.log("No labels directory.");
    return;
  }

  const files = readdirSync(labelsDir).filter((f) => f.endsWith(".json"));
  const labels: AppliedLabel[] = [];

  for (const file of files) {
    const raw = JSON.parse(
      readFileSync(join(labelsDir, file), "utf8"),
    ) as Partial<AppliedLabel> & { draft?: AppliedLabel };
    const questionId =
      raw.questionId ?? file.replace(/\.json$/, "");
    const expectTop1Ids =
      raw.expectTop1Ids ?? raw.draft?.expectTop1Ids ?? [];
    const expectTop3Ids =
      raw.expectTop3Ids ?? raw.draft?.expectTop3Ids ?? expectTop1Ids;
    if (!Array.isArray(expectTop1Ids) || expectTop1Ids.length === 0) {
      console.log(`  skip ${file} (empty Top-1)`);
      continue;
    }
    labels.push({
      questionId,
      expectTop1Ids,
      expectTop3Ids:
        expectTop3Ids.length > 0 ? expectTop3Ids : expectTop1Ids,
      notes: raw.notes,
    });
  }

  const dataset = loadGoldDataset();
  const updated = applyLabelsToDataset(dataset, labels);
  const out = join(process.cwd(), "evals", "gold", "questions.json");
  writeFileSync(out, JSON.stringify(updated, null, 2) + "\n");

  const labeled = updated.questions.filter(
    (q) =>
      q.labelingTier === "full" &&
      Array.isArray(q.expectTop1Ids) &&
      q.expectTop1Ids.length > 0,
  ).length;

  console.log(`Applied ${labels.length} label files.`);
  console.log(`Questions with entity Top-1 gold: ${labeled}`);
  console.log(`Wrote ${out}`);
}

main();
