/**
 * Offline gold dataset gate for CI.
 * Usage: npm run eval:gold
 */
import assert from "node:assert/strict";
import { loadGoldDataset, coreQuestions } from "../src/services/eval/gold";
import { isGoldQuestion } from "../src/services/eval/types";

console.log("Gold dataset eval\n");

const dataset = loadGoldDataset();

assert.ok(dataset.questions.length >= 500, `expected ≥500, got ${dataset.questions.length}`);
const ids = new Set(dataset.questions.map((q) => q.id));
assert.equal(ids.size, dataset.questions.length, "duplicate gold ids");

for (const q of dataset.questions) {
  assert.ok(isGoldQuestion(q), `invalid ${q.id}`);
  assert.ok(q.query.trim().length >= 3, `short query ${q.id}`);
}

const core = coreQuestions(dataset);
assert.ok(core.length >= 150, `expected ≥150 core, got ${core.length}`);

const intents = new Set(dataset.questions.map((q) => q.intent));
for (const required of [
  "BUSINESS_SEARCH",
  "DISCOVERY",
  "EMERGENCY",
  "NAVIGATION",
  "EVENT_SEARCH",
  "ACCOMMODATION",
  "CONVERSATION",
  "PLANNING",
  "COMPARISON",
  "LIVE_INFORMATION",
]) {
  assert.ok(intents.has(required as never), `missing intent family ${required}`);
}

const labeled = core.filter(
  (q) => Array.isArray(q.expectTop1Ids) && q.expectTop1Ids.length > 0,
).length;

console.log(`  ok  gold questions (${dataset.questions.length})`);
console.log(`  ok  core tier (${core.length}), entity-labeled (${labeled})`);
console.log(`  ok  intent families (${intents.size})`);
console.log("\nGold dataset gate passed.");
