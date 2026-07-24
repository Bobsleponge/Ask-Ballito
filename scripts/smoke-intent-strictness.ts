/**
 * Offline smoke: exact-intent strictness (no OpenAI / DB).
 * Ensures obscure service asks do not get padded with neighbouring industries.
 *
 * Run: npx tsx scripts/smoke-intent-strictness.ts
 */
import assert from "node:assert/strict";
import {
  assertVerticalPoliciesComplete,
  allowlistForHint,
  isExactVerticalHint,
  policyForHint,
  allowsUntaggedForHint,
} from "../src/config/vertical-policy";
import {
  filterByVerticalHint,
  matchesVerticalHint,
} from "../src/lib/business-vertical-filter";
import {
  detectTradeKind,
  filterToTradeKind,
  matchesTradeKind,
} from "../src/services/planner/trade-query";
import {
  isHumanMedicalAsk,
  isTradeOrAfterHoursServiceAsk,
} from "../src/services/planner/emergency-guard";
import { resolveHealthcareVerticalHint } from "../src/services/planner/healthcare-vertical";
import type { BusinessResult } from "../src/lib/schemas/business";

function biz(
  id: string,
  name: string,
  opts: {
    category?: string;
    description?: string;
    verticals?: string[];
  } = {},
): BusinessResult {
  return {
    id,
    name,
    category: opts.category ?? null,
    description: opts.description ?? null,
    address: null,
    phone: null,
    website: null,
    rating: 4.8,
    ratingCount: 20,
    priceLevel: null,
    lat: null,
    lng: null,
    photos: [],
    metadata: {
      ...(opts.verticals ? { verticals: opts.verticals } : {}),
    },
  };
}

const pool: BusinessResult[] = [
  biz("auto1", "Ballito Auto Fix Centre", {
    category: "Car repair and maintenance service",
    description: "full service control arm repair",
    verticals: ["automotive"],
  }),
  biz("paint1", "Prestige Auto Ballito (Panel & Paint)", {
    category: "Car repair and maintenance service",
    description: "car dent repair panel beating paint matching",
    verticals: ["automotive", "fabrication"],
  }),
  biz("fab1", "R & R Engineering", {
    category: "Metal fabricator",
    description: "custom steel fabrication and welding",
    verticals: ["fabrication"],
  }),
  biz("fab2", "Imvubu Steel (Pty) Ltd", {
    category: "Steel fabricator",
    description: "trailer fabrication and boilermaker work",
    verticals: ["fabrication"],
  }),
  biz("plumb1", "North Coast Plumbers", {
    category: "Plumber",
    description: "geyser and plumbing repairs",
    verticals: ["plumbers"],
  }),
  biz("elec1", "Obey Electricals & Solar", {
    category: "Electrician",
    description: "electrical installations",
    verticals: ["electricians"],
  }),
  biz("pool1", "Blue Wave Pool Care", {
    category: "Pool cleaning service",
    description: "pool acid and weekly maintenance",
    verticals: ["pool-services"],
  }),
  biz("untagged", "Random Ballito Trader", {
    category: "Local business",
    description: "general services",
  }),
  biz("vet1", "Ballito Vet Hospital", {
    category: "Veterinary Care",
    description: "24 hour emergency veterinary care and night medical services",
    verticals: ["vets"],
  }),
  biz("gp1", "Horizon Medical Group", {
    category: "Medical Center",
    description: "family general practice and medical consultations",
    verticals: ["doctors"],
  }),
  biz("gp2", "Thrive Family Practice", {
    category: "Doctor",
    description: "general medical consultation and pediatric care",
    verticals: ["doctors"],
  }),
  biz("dent1", "Dolphin Coast Dental Care", {
    category: "Dentist",
    description: "after-hours emergency dental care",
    verticals: ["dentists"],
  }),
  biz("opt1", "Neovision Optometrist Ballito Junction", {
    category: "Health",
    description: "eye examination",
    verticals: ["optometrists"],
  }),
  biz("tour1", "Dolphin Coast Tourist Services", {
    category: "Airport Shuttle Service",
    description: "airport transfers and shuttle",
    verticals: ["travel"],
  }),
];

function names(list: BusinessResult[]): string[] {
  return list.map((b) => b.name);
}

assertVerticalPoliciesComplete();

assert.equal(isExactVerticalHint("fabrication"), true);
assert.equal(isExactVerticalHint("plumbers"), true);
assert.equal(isExactVerticalHint("attractions"), false);
assert.equal(isExactVerticalHint("spas"), false);
assert.equal(allowsUntaggedForHint("fabrication"), false);
assert.equal(allowsUntaggedForHint("attractions"), true);
assert.deepEqual(allowlistForHint("fabrication"), ["fabrication"]);
assert.ok(policyForHint("fabrication")?.adjacent === undefined);

// Fabrication allowlist must not include automotive
assert.ok(!allowlistForHint("fabrication")!.includes("automotive"));
assert.ok(!allowlistForHint("automotive")!.includes("fabrication"));

const trailerAsk = "i need to do some custom fabrication work to my trailer";
const kind = detectTradeKind(trailerAsk);
assert.equal(kind, "fabricator");

const fabFiltered = filterToTradeKind(pool, kind!, { strict: true });
assert.ok(names(fabFiltered).includes("R & R Engineering"));
assert.ok(names(fabFiltered).includes("Imvubu Steel (Pty) Ltd"));
assert.ok(!names(fabFiltered).includes("Ballito Auto Fix Centre"));
assert.ok(!names(fabFiltered).includes("Prestige Auto Ballito (Panel & Paint)"));
assert.ok(!names(fabFiltered).includes("North Coast Plumbers"));

const fabVertical = filterByVerticalHint(pool, "fabrication");
assert.ok(names(fabVertical).includes("R & R Engineering"));
assert.ok(!names(fabVertical).includes("Ballito Auto Fix Centre"));
assert.ok(!names(fabVertical).includes("Random Ballito Trader"));

assert.equal(
  matchesVerticalHint(
    biz("x", "Untagged", { description: "anything" }),
    "plumbers",
  ),
  false,
);

const plumberAsk = detectTradeKind("24 hour plumber ballito");
assert.equal(plumberAsk, "plumber");
const plumbers = filterToTradeKind(pool, plumberAsk!, { strict: true });
assert.deepEqual(names(plumbers), ["North Coast Plumbers"]);

const poolVertical = filterByVerticalHint(pool, "pool-services");
assert.deepEqual(names(poolVertical), ["Blue Wave Pool Care"]);

// Soft miss disabled by default: empty pool for locksmith stays empty
const locksmiths = filterToTradeKind(pool, "locksmith");
assert.equal(locksmiths.length, 0);

// Prestige must not match fabricator even when tagged fabrication
assert.equal(
  matchesTradeKind(
    pool.find((b) => b.id === "paint1")!,
    "fabricator",
  ),
  false,
);

// --- Human medical: "doctor open now" must not be a trade ask ---
assert.equal(isTradeOrAfterHoursServiceAsk("doctor open now"), false);
assert.equal(isTradeOrAfterHoursServiceAsk("docotor open noq"), false);
assert.equal(isHumanMedicalAsk("doctor open now"), true);
assert.equal(isHumanMedicalAsk("emergency medical attention Ballito"), true);
assert.equal(isHumanMedicalAsk("emergency vet open now"), false);
assert.equal(resolveHealthcareVerticalHint("doctor open now"), "doctors");
assert.equal(
  resolveHealthcareVerticalHint("emergency medical attention"),
  "hospitals",
);
assert.ok(!allowlistForHint("healthcare")!.includes("vets"));

const doctors = filterByVerticalHint(pool, "doctors");
assert.ok(names(doctors).includes("Horizon Medical Group"));
assert.ok(names(doctors).includes("Thrive Family Practice"));
assert.ok(!names(doctors).includes("Ballito Vet Hospital"));
assert.ok(!names(doctors).includes("Ballito Auto Fix Centre"));
assert.ok(!names(doctors).includes("Dolphin Coast Tourist Services"));
assert.ok(!names(doctors).includes("Dolphin Coast Dental Care"));
assert.ok(!names(doctors).includes("Neovision Optometrist Ballito Junction"));

assert.equal(
  matchesVerticalHint(pool.find((b) => b.id === "vet1")!, "doctors"),
  false,
);
assert.equal(
  matchesVerticalHint(pool.find((b) => b.id === "vet1")!, "hospitals"),
  false,
);

console.log("smoke-intent-strictness: ok");
