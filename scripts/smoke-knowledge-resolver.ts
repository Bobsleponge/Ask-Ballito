/**
 * Offline-ish smoke for the Knowledge Resolver plugins.
 * Uses TS FAQ/emergency fallbacks; weather may hit Open-Meteo.
 *
 * Run: npm run smoke:knowledge-resolver
 */
import assert from "node:assert/strict";
import { CITIES } from "../src/config/cities";
import { intelligenceFlags } from "../src/config/intelligence-flags";
import { classifyQuery } from "../src/services/classifier/classify";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type ConversationContext,
} from "../src/services/planner/types";
import { resolveKnowledge } from "../src/services/knowledge-resolver";

const city = CITIES.find((c) => c.slug === "ballito");
assert.ok(city, "ballito city missing");

function context(): ConversationContext {
  return {
    city: city!,
    history: [],
    stickyEntities: emptyEntityModel(),
    stickyConstraints: emptyConstraintModel(),
  };
}

async function resolve(message: string) {
  const classification = classifyQuery({
    message,
    citySlug: city!.slug,
  });
  return resolveKnowledge({
    message,
    city: city!,
    classification,
    context: context(),
    excludeBusinessIds: new Set(),
    retry: false,
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  async function check(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
      passed += 1;
    } catch (err) {
      failed += 1;
      console.error(`FAIL  ${name}`);
      console.error(err instanceof Error ? err.message : err);
    }
  }

  console.log("Knowledge Resolver smoke\n");

  await check("KNOWLEDGE_RESOLVER defaults off (zero regression)", async () => {
    assert.equal(intelligenceFlags.knowledgeResolver(), false);
  });

  await check("FAQ → FACT answered", async () => {
    const r = await resolve("what is ask ballito");
    assert.equal(r.answered, true);
    assert.equal(r.type, "FACT");
    assert.equal(r.pluginId, "faq");
    assert.ok(r.text && /Ask Ballito/i.test(r.text), r.text);
  });

  await check("Emergency contacts → FACT", async () => {
    const r = await resolve("emergency contacts Ballito");
    assert.equal(r.answered, true);
    assert.equal(r.type, "FACT");
    assert.equal(r.pluginId, "emergency");
    assert.ok(r.text && /10111/.test(r.text), r.text);
  });

  await check("True safety emergency → FACT", async () => {
    const r = await resolve("someone is having a heart attack call ambulance");
    assert.equal(r.answered, true);
    assert.equal(r.pluginId, "emergency");
  });

  await check("Emergency plumber does NOT resolve as emergency contacts", async () => {
    const r = await resolve("emergency plumber for a burst pipe");
    assert.notEqual(r.pluginId, "emergency");
    assert.equal(r.answered, false);
    assert.equal(r.type, "SEARCH");
  });

  await check("Weather fact → LIVE_DATA (or SEARCH if weather unavailable)", async () => {
    const r = await resolve("what's the weather in Ballito today");
    if (r.answered) {
      assert.equal(r.type, "LIVE_DATA");
      assert.equal(r.pluginId, "weather");
      assert.ok(r.text && /Ballito/i.test(r.text), r.text);
    } else {
      assert.equal(r.type, "SEARCH");
      console.log("    (weather provider unavailable — accepted SEARCH fallback)");
    }
  });

  await check("Restaurant search → SEARCH (not answered)", async () => {
    const r = await resolve("best sushi restaurant in Ballito");
    assert.equal(r.answered, false);
    assert.equal(r.type, "SEARCH");
    assert.equal(r.nextStage, "search");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
