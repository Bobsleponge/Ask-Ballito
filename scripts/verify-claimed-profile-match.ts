/**
 * Verify claimed + completed + search-ingested profiles still drive discovery.
 *
 * Live checks (needs .env.local):
 *  1. Claimed businesses with profiles + search_ingested_at exist
 *  2. embedding_text includes owner services/keywords/menu signals
 *  3. Semantic search for a distinctive profile keyword returns that business
 *
 * Offline checks always run:
 *  - Enriched profile listing outranks a thin twin on the same ask
 *  - Dining filter keeps claimed restaurants (does not drop on profile alone)
 *
 * Run: npx tsx --env-file=.env.local --require ./scripts/shim-server-only.cjs scripts/verify-claimed-profile-match.ts
 */
import assert from "node:assert/strict";
import { buildEmbeddingText } from "../src/lib/business-embedding-text";
import {
  filterByVerticalHint,
  isDiningBusiness,
  matchesVerticalHint,
} from "../src/lib/business-vertical-filter";
import type { BusinessResult } from "../src/lib/schemas/business";
import { rankBusinesses } from "../src/services/ai/ranking.engine";
import { defaultCompositionRequest } from "../src/services/composition/types";
import {
  emptyConstraintModel,
  emptyEntityModel,
  type PlannerPlan,
} from "../src/services/planner/types";

function biz(
  id: string,
  name: string,
  opts: Partial<BusinessResult> = {},
): BusinessResult {
  return {
    id,
    name,
    category: opts.category ?? "Restaurant",
    description: opts.description ?? null,
    address: null,
    phone: opts.phone ?? null,
    website: opts.website ?? null,
    rating: opts.rating ?? 4.2,
    ratingCount: opts.ratingCount ?? 40,
    priceLevel: opts.priceLevel ?? 2,
    lat: null,
    lng: null,
    photos: opts.photos ?? [],
    similarity: opts.similarity ?? 0.55,
    score: opts.score,
    metadata: opts.metadata ?? { verticals: ["restaurants"] },
  };
}

function planForAsk(ask: string): PlannerPlan {
  return {
    version: "v2",
    intent: ask,
    goal: { primary: "find_restaurant", description: ask },
    workflow: "restaurants",
    confidence: 0.9,
    entities: {
      ...emptyEntityModel(),
      businessTypes: ["restaurant"],
      cuisines: ["seafood", "sushi"],
    },
    constraints: emptyConstraintModel(),
    missingInformation: [],
    needsClarification: false,
    clarificationQuestion: null,
    executionPlan: [
      {
        id: "s1",
        capability: "business_search",
        type: "business_search",
        query: ask,
        params: { verticalHint: "restaurants" },
        priority: 1,
        optional: false,
      },
    ],
    llmRequired: true,
    responseMode: "execute_and_explain",
    locationRef: null,
    composition: defaultCompositionRequest("grouped_sections"),
    diagnostics: {
      extractorConfidence: 0.9,
      rejectedWorkflows: [],
      rulesApplied: [],
      stickyEntitiesUsed: false,
    },
  };
}

let failed = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  ${label}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${label}`);
    console.error(e);
  }
}

// --- Offline: embedding text includes owner profile ---
check("buildEmbeddingText includes owner services/keywords/menu", () => {
  const text = buildEmbeddingText({
    name: "Polipetto",
    category: "Seafood Restaurant",
    description: "Beach seafood",
    ownerServices: ["fresh sushi", "calamari"],
    ownerKeywords: ["seafood specials", "omakase"],
    menuItems: [{ name: "Dragon roll", category: "Sushi" }],
    ownerAttributes: { seaView: true, reservations: true },
    metadata: { verticals: ["restaurants"] },
  });
  assert.match(text, /fresh sushi/i);
  assert.match(text, /seafood specials|omakase/i);
  assert.match(text, /Dragon roll/i);
  assert.match(text, /sea view|reservations/i);
});

// --- Offline: enriched claimed profile beats thin twin ---
check("enriched profile outranks thin twin for specialty ask", () => {
  const ask = "best seafood sushi restaurant Ballito";
  const claimed = biz("claimed", "Polipetto Seafood", {
    similarity: 0.58,
    rating: 4.5,
    ratingCount: 100,
    metadata: {
      verticals: ["restaurants"],
      services: ["fresh sushi", "seafood platter", "omakase"],
      keywords: ["sushi bar", "seafood specials", "Compensation Beach"],
      attributes: { seaView: true, reservations: true },
      qualityScore: 72,
      searchIngested: true,
      claimed: true,
    },
  });
  const thin = biz("thin", "Generic Beach Grill", {
    similarity: 0.62,
    rating: 4.6,
    ratingCount: 800,
    metadata: {
      verticals: ["restaurants"],
      qualityScore: 40,
    },
  });

  const ranked = rankBusinesses([thin, claimed], planForAsk(ask), {
    verticalHint: "restaurants",
    preferVariety: false,
    minKeep: 0,
    limit: 5,
  });

  assert.equal(ranked[0]?.id, "claimed", `got ${ranked.map((b) => `${b.id}:${b.score}`).join(", ")}`);
});

// --- Offline: dining filter keeps claimed restaurants ---
check("restaurants filter keeps claimed dining listings", () => {
  const claimed = biz("c1", "Owner Claimed Bistro", {
    category: "Restaurant",
    metadata: {
      verticals: ["restaurants"],
      services: ["wood-fired pizza"],
      keywords: ["date night"],
      portalClaimed: true,
      searchIngested: true,
      ownerProfileComplete: true,
    },
  });
  assert.equal(isDiningBusiness(claimed), true);
  assert.equal(matchesVerticalHint(claimed, "restaurants"), true);
  const filtered = filterByVerticalHint([claimed], "restaurants");
  assert.equal(filtered.length, 1);
});

check("claimed+complete+ingested beats twin with same similarity", () => {
  const ask = "fine dining Ballito";
  const twin = biz("plain", "45 on Eat Street Twin", {
    similarity: 0.7,
    rating: 4.6,
    ratingCount: 1200,
    metadata: { verticals: ["restaurants"], qualityScore: 70 },
  });
  const claimed = biz("portal", "45 on Eat Street", {
    similarity: 0.7,
    rating: 4.6,
    ratingCount: 1200,
    metadata: {
      verticals: ["restaurants"],
      qualityScore: 70,
      portalClaimed: true,
      searchIngested: true,
      ownerProfileComplete: true,
      services: ["fine dining", "tasting menu"],
      keywords: ["45 on eat street", "lifestyle centre"],
    },
  });
  const ranked = rankBusinesses([twin, claimed], planForAsk(ask), {
    verticalHint: "restaurants",
    preferVariety: false,
    minKeep: 0,
    limit: 5,
  });
  assert.equal(ranked[0]?.id, "portal");
  assert.ok((ranked[0]?.score ?? 0) > (ranked[1]?.score ?? 0));
});

type LiveRow = {
  id: string;
  name: string;
  category: string | null;
  city_slug: string;
  embedding_text: string | null;
  search_ingested_at: string | null;
};

async function liveVerify(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("skip live (no Supabase env)");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: members, error: memErr } = await admin
    .from("business_members")
    .select("business_id")
    .eq("status", "active")
    .eq("role", "owner");
  if (memErr) throw new Error(memErr.message);

  const claimedIds = [
    ...new Set((members ?? []).map((m) => m.business_id as string)),
  ];
  if (claimedIds.length === 0) {
    console.log("\nlive: no claimed owner memberships — skip live probes");
    return;
  }

  const { data: businesses, error: bizErr } = await admin
    .from("businesses")
    .select(
      "id, name, category, city_slug, embedding_text, search_ingested_at",
    )
    .in("id", claimedIds);
  if (bizErr) throw new Error(bizErr.message);

  const { data: profiles, error: profErr } = await admin
    .from("business_profiles")
    .select(
      "business_id, tagline, description, services, keywords, phone, website",
    )
    .in("business_id", claimedIds);
  if (profErr) throw new Error(profErr.message);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.business_id as string, p]),
  );
  const rows = (businesses ?? []) as LiveRow[];
  const ingested = rows.filter((r) => Boolean(r.search_ingested_at));
  const withProfile = rows.filter((r) => profileById.has(r.id));
  const complete = rows.filter((r) => {
    const p = profileById.get(r.id);
    if (!p) return false;
    const services = Array.isArray(p.services) ? p.services : [];
    const keywords = Array.isArray(p.keywords) ? p.keywords : [];
    const hasCopy =
      Boolean(p.tagline?.trim()) || Boolean(p.description?.trim());
    const hasContact =
      Boolean(p.phone?.trim()) || Boolean(p.website?.trim());
    return (
      (services.length > 0 || keywords.length > 0) &&
      (hasCopy || hasContact)
    );
  });

  console.log(`\nlive: ${claimedIds.length} claimed owner membership(s)`);
  console.log(`live: ${withProfile.length} with business_profiles row`);
  console.log(`live: ${ingested.length} search-ingested`);
  console.log(
    `live: ${complete.length} look profile-complete (services/keywords + copy/contact)`,
  );

  if (ingested.length === 0 || complete.length === 0) {
    console.warn(
      "WARN live coverage gap: claimed listings exist but none are both profile-complete and search-ingested.",
    );
    for (const r of rows) {
      const p = profileById.get(r.id);
      console.warn(
        `  - ${r.name}: profile=${Boolean(p)} ingested=${Boolean(r.search_ingested_at)}`,
      );
    }
    console.warn(
      "  Complete the Business Portal listing, then run Admin → Search Ingest so embeddings include owner offerings.",
    );
    return;
  }

  check("ingested claimed profiles have embedding_text with owner signals", () => {
    let matched = 0;
    for (const r of ingested) {
      const p = profileById.get(r.id);
      if (!p) continue;
      const signals = [
        ...(Array.isArray(p.services) ? p.services : []),
        ...(Array.isArray(p.keywords) ? p.keywords : []),
        p.tagline,
        p.description,
      ]
        .filter(
          (s): s is string => typeof s === "string" && s.trim().length >= 4,
        )
        .map((s) => s.trim().toLowerCase());
      if (signals.length === 0) continue;
      const emb = (r.embedding_text ?? "").toLowerCase();
      const hit = signals.some((s) =>
        emb.includes(s.slice(0, Math.min(24, s.length))),
      );
      if (hit) matched += 1;
    }
    assert.ok(
      matched > 0,
      "No ingested claimed profile signals found in embedding_text — refresh embeddings",
    );
    console.log(
      `    (${matched} ingested listings embed owner profile signals)`,
    );
  });

  const probes = complete
    .filter((r) => Boolean(r.search_ingested_at) && r.embedding_text)
    .slice(0, 3);

  if (probes.length === 0) {
    console.log("skip live search probes (no complete+ingested rows)");
    return;
  }

  const { businessSearchService } = await import(
    "../src/services/ai/business-search.service"
  );

  for (const r of probes) {
    const p = profileById.get(r.id)!;
    const keyword =
      (Array.isArray(p.keywords) && p.keywords[0]) ||
      (Array.isArray(p.services) && p.services[0]) ||
      r.name;
    const query = `${keyword} ${r.city_slug}`.trim();
    try {
      const results = await businessSearchService.search({
        citySlug: r.city_slug,
        query,
        limit: 20,
        similarityThreshold: 0.12,
      });
      const hit = results.find((b) => b.id === r.id);
      const enriched = hit?.metadata;
      const hasOwnerChips =
        enriched &&
        ((Array.isArray(enriched.services) && enriched.services.length > 0) ||
          (Array.isArray(enriched.keywords) && enriched.keywords.length > 0));
      const portalFlagsOk =
        enriched?.portalClaimed === true &&
        enriched?.searchIngested === true &&
        enriched?.ownerProfileComplete === true;

      if (!hit) {
        failed += 1;
        console.error(
          `FAIL live search recalls ${r.name} — not in top ${results.length} for "${query}"`,
        );
        console.error(
          `    top: ${results
            .slice(0, 5)
            .map((b) => `${b.name}(${(b.similarity ?? 0).toFixed(3)})`)
            .join(", ")}`,
        );
      } else {
        console.log(
          `ok  live search recalls ${r.name} @#${results.indexOf(hit) + 1} sim=${(hit.similarity ?? 0).toFixed(3)} ownerChips=${Boolean(hasOwnerChips)} portalFlags=${Boolean(portalFlagsOk)}`,
        );
        if (!hasOwnerChips) {
          failed += 1;
          console.error(
            `FAIL enrichBusinessResults did not attach services/keywords for ${r.name}`,
          );
        }
        if (!portalFlagsOk) {
          failed += 1;
          console.error(
            `FAIL enrich missing portalClaimed/searchIngested/ownerProfileComplete for ${r.name}`,
          );
        }
      }
    } catch (e) {
      failed += 1;
      console.error(`FAIL live search for ${r.name}`);
      console.error(e);
    }
  }
}

async function main() {
  await liveVerify();

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nClaimed profile match verification passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
