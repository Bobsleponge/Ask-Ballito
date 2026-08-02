/**
 * Offline retrieval/grounding eval smoke (no live OpenAI — fixture assertions).
 * Full live eval can be added later with EVAL_LIVE=1.
 *
 * Usage: npm run eval:smoke
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findUngroundedPhones } from "../src/lib/chat/ungrounded-phones";
import { resolveDemoLoginEnabled } from "../src/lib/auth/demo-login-policy";
import { estimateCostUsd } from "../src/config/ai-pricing";

let passed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`FAIL  ${name}`);
    throw err;
  }
}

console.log("Eval smoke checks\n");

const fixturesPath = join(process.cwd(), "evals", "queries.json");
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8")) as Array<{
  id: string;
  query: string;
  city: string;
  expectVertical?: string;
}>;

check("eval fixtures load (≥100 queries)", () => {
  assert.ok(Array.isArray(fixtures) && fixtures.length >= 100);
  for (const f of fixtures) {
    assert.ok(f.id && f.query && f.city);
  }
});

check("estimateCostUsd prices gpt-4.1-mini", () => {
  const cost = estimateCostUsd({
    model: "gpt-4.1-mini",
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
  });
  assert.ok(cost !== null && cost > 0);
});

check("grounding flags phone not in businesses", () => {
  const violations = findUngroundedPhones({
    narration: "Call them on 082 555 0199 for bookings.",
    businessPhones: ["031 555 0100"],
  });
  assert.ok(violations.length >= 1);
});

check("grounding allows matching phone digits", () => {
  const violations = findUngroundedPhones({
    narration: "Phone 0315550100",
    businessPhones: ["+27 31 555 0100"],
  });
  assert.equal(violations.length, 0);
});

check("demo production policy still locked", () => {
  assert.equal(
    resolveDemoLoginEnabled({
      nodeEnv: "production",
      enableDemoLogin: "true",
      demoLoginPassword: undefined,
    }),
    false,
  );
});

check("reply-accuracy fixture present", () => {
  const replyPath = join(process.cwd(), "evals", "reply-accuracy.json");
  const doc = JSON.parse(readFileSync(replyPath, "utf8")) as {
    cases: unknown[];
  };
  assert.ok(Array.isArray(doc.cases) && doc.cases.length >= 4);
});

check("routing fixtures present (≥200)", () => {
  const routingPath = join(process.cwd(), "evals", "routing.json");
  const routing = JSON.parse(readFileSync(routingPath, "utf8")) as unknown[];
  assert.ok(Array.isArray(routing) && routing.length >= 200);
});

console.log(`\n${passed} checks passed.`);
console.log("Also run: npm run verify:replies && npm run eval:routing");
