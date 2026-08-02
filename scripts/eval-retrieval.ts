/**
 * Offline retrieval fixture gate + gold dataset pointer.
 * Live Top-1/Top-3: EVAL_LIVE=1 npm run eval:platform
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fixtures = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "queries.json"), "utf8"),
) as Array<{ id: string; query: string; city: string; expectVertical?: string }>;

assert.ok(fixtures.length >= 100, `expected ≥100 fixtures, got ${fixtures.length}`);
const ids = new Set(fixtures.map((f) => f.id));
assert.equal(ids.size, fixtures.length, "fixture ids must be unique");
for (const f of fixtures) {
  assert.ok(f.query.trim().length >= 3, `short query: ${f.id}`);
  assert.ok(f.city, `missing city: ${f.id}`);
}

console.log(`ok  retrieval fixtures (${fixtures.length})`);

const goldPath = join(process.cwd(), "evals", "gold", "questions.json");
const gold = JSON.parse(readFileSync(goldPath, "utf8")) as {
  questions: unknown[];
};
assert.ok(
  Array.isArray(gold.questions) && gold.questions.length >= 500,
  `gold dataset expected ≥500, got ${gold.questions?.length}`,
);
console.log(`ok  gold dataset (${gold.questions.length})`);

if (process.env.EVAL_LIVE === "1") {
  console.log(
    "EVAL_LIVE=1 — use npm run eval:platform for live Top-1/Top-3 + AI metrics.",
  );
}
