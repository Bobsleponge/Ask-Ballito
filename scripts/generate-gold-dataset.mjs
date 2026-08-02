/**
 * Generate ≥500 Ballito gold evaluation questions across all intent families.
 * Run: node scripts/generate-gold-dataset.mjs
 *
 * Merges existing evals/queries.json + routing.json signals where useful.
 * Writes evals/gold/questions.json and keeps evals/queries.json in sync (≥100).
 */
import fs from "node:fs";
import path from "node:path";

const CITY = "ballito";
const OUT = path.join("evals", "gold", "questions.json");

/** @typedef {{ id: string, query: string, city: string, intent: string, expectEntityType?: string, expectVertical?: string, expectKnowledgeCard?: string|null, expectCapabilities?: string[], requireLlm: boolean, requireSql: boolean, requireSearch: boolean, requireKnowledgeCard: boolean, labelingTier: "full"|"intent", notes?: string }} GoldQ */

/** @type {GoldQ[]} */
const questions = [];
const seenQueries = new Set();

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/**
 * @param {Omit<GoldQ, "city"|"labelingTier"> & { labelingTier?: "full"|"intent" }} partial
 */
function add(partial) {
  const query = partial.query.replace(/\s+/g, " ").trim();
  const key = query.toLowerCase();
  if (seenQueries.has(key)) return;
  seenQueries.add(key);
  const id = partial.id || `${partial.intent.toLowerCase()}-${slugify(query)}`;
  questions.push({
    ...partial,
    id,
    query,
    city: CITY,
    labelingTier: partial.labelingTier ?? "intent",
  });
}

function caps(...c) {
  return c;
}

// ─── BUSINESS_SEARCH ───────────────────────────────────────────────
const businessSeeds = [
  ["Best breakfast", "cafes", "cafes", "best-breakfast"],
  ["Best pizza", "restaurants", "restaurants", null],
  ["Best sushi", "restaurants", "restaurants", null],
  ["Best steak", "restaurants", "restaurants", null],
  ["Best seafood", "restaurants", "restaurants", null],
  ["Best Thai", "restaurants", "restaurants", null],
  ["Best Indian", "restaurants", "restaurants", null],
  ["Best Italian", "restaurants", "restaurants", null],
  ["Best burgers", "restaurants", "restaurants", null],
  ["Coffee shops with WiFi", "cafes", "cafes", null],
  ["Romantic restaurants", "restaurants", "restaurants", null],
  ["Dog friendly restaurants", "restaurants", "restaurants", "dog-friendly-restaurants"],
  ["Restaurants with generators", "restaurants", "restaurants", null],
  ["Restaurants open after 9pm", "restaurants", "restaurants", null],
  ["Family friendly restaurants", "restaurants", "restaurants", null],
  ["Wheelchair accessible restaurant", "restaurants", "restaurants", null],
  ["Restaurant with parking", "restaurants", "restaurants", null],
  ["Cocktail bars", "nightlife", "nightlife", null],
  ["Live music venues", "nightlife", "nightlife", null],
  ["Gel nails", "beauticians", "beauticians", null],
  ["Balayage hair colour", "hair_salons", "hair_salons", null],
  ["Best spa", "spas", "spas", null],
  ["Gym membership", "gyms", "gyms", null],
  ["Surf lessons", "attractions", "attractions", null],
  ["Car wash", "car-wash", "car-wash", null],
  ["Dog groomer", "pet-services", "pet-services", null],
  ["Estate agent", "estate-agents", "estate-agents", null],
  ["Physiotherapist", "physio", "physio", null],
  ["Dentist", "dentists", "dentists", null],
  ["Pharmacy", "pharmacies", "pharmacies", null],
  ["Vet", "veterinary", "veterinary", null],
  ["Plumber", "plumbing", "plumbing", null],
  ["Electrician", "electrical", "electrical", null],
  ["Italian restaurant", "restaurants", "restaurants", null],
  ["Seafood restaurant", "restaurants", "restaurants", null],
  ["Cafe to work from", "cafes", "cafes", null],
  ["Breakfast near the beach", "cafes", "cafes", null],
  ["Kids menu restaurants", "restaurants", "restaurants", null],
  ["Halal restaurants", "restaurants", "restaurants", null],
  ["Vegan restaurants", "restaurants", "restaurants", null],
  ["Sushi near Ballito Junction", "restaurants", "restaurants", null],
  ["Pizza delivery", "restaurants", "restaurants", null],
  ["Best coffee", "cafes", "cafes", null],
  ["Wine bar", "nightlife", "nightlife", null],
  ["Nail salon", "beauticians", "beauticians", null],
  ["Barber", "hair_salons", "hair_salons", null],
  ["Yoga studio", "gyms", "gyms", null],
  ["Pilates", "gyms", "gyms", null],
  ["Toy shop", "shopping", "shopping", null],
  ["Book store", "shopping", "shopping", null],
];

for (const [q, vertical, entity, card] of businessSeeds) {
  add({
    id: `biz-${slugify(q)}`,
    query: `${q} in Ballito`,
    intent: "BUSINESS_SEARCH",
    expectVertical: vertical,
    expectEntityType: entity,
    expectKnowledgeCard: card,
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: Boolean(card),
  });
  add({
    id: `biz-${slugify(q)}-near`,
    query: `${q} near Salt Rock`,
    intent: "BUSINESS_SEARCH",
    expectVertical: vertical,
    expectEntityType: entity,
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
  add({
    id: `biz-${slugify(q)}-where`,
    query: `Where can I find ${q.toLowerCase()}?`,
    intent: "BUSINESS_SEARCH",
    expectVertical: vertical,
    expectEntityType: entity,
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
}

const bizParaphrases = ["Recommend", "Find me", "Looking for", "Any good", "Top rated", "Suggest"];
for (let i = 0; i < businessSeeds.length; i++) {
  const [q, vertical, entity] = businessSeeds[i];
  const p = bizParaphrases[i % bizParaphrases.length];
  add({
    id: `biz-para-${i}`,
    query: `${p} ${q.toLowerCase()} Ballito`,
    intent: "BUSINESS_SEARCH",
    expectVertical: vertical,
    expectEntityType: entity,
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
}

// ─── DISCOVERY ─────────────────────────────────────────────────────
const discovery = [
  ["Things to do with toddlers", "attractions", "rainy-day-activities"],
  ["Rainy day activities", "attractions", "rainy-day-activities"],
  ["Date ideas", "attractions", null],
  ["Weekend activities", "attractions", null],
  ["Beaches for kids", "attractions", "best-beaches"],
  ["Best beaches", "attractions", "best-beaches"],
  ["Outdoor activities", "attractions", null],
  ["Family day out", "attractions", null],
  ["Things to do this weekend", "attractions", null],
  ["Kids activities indoors", "attractions", "rainy-day-activities"],
  ["Adventure activities", "attractions", null],
  ["What to do when it's raining", "attractions", "rainy-day-activities"],
  ["Fun things for teenagers", "attractions", null],
  ["Picnic spots", "attractions", null],
  ["Sunset spots", "attractions", null],
  ["Whale watching", "attractions", null],
  ["Markets to visit", "attractions", null],
  ["Art galleries", "attractions", null],
  ["Nature walks", "attractions", null],
  ["Water parks", "attractions", null],
];

for (const [q, vertical, card] of discovery) {
  add({
    id: `disc-${slugify(q)}`,
    query: `${q} in Ballito`,
    intent: "DISCOVERY",
    expectVertical: vertical,
    expectEntityType: "attractions",
    expectKnowledgeCard: card,
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: Boolean(card),
  });
  add({
    id: `disc-${slugify(q)}-ask`,
    query: `What are the best ${q.toLowerCase()}?`,
    intent: "DISCOVERY",
    expectVertical: vertical,
    expectEntityType: "attractions",
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
}

// ─── EMERGENCY ─────────────────────────────────────────────────────
const emergency = [
  ["Emergency plumber", "plumbing"],
  ["Dentist open today", "dentists"],
  ["Closest pharmacy", "pharmacies"],
  ["Emergency vet open now", "veterinary"],
  ["Doctor open now", "doctors"],
  ["After hours electrician", "electrical"],
  ["24 hour pharmacy", "pharmacies"],
  ["Emergency dentist", "dentists"],
  ["Burst pipe plumber", "plumbing"],
  ["Hospital nearby", "hospitals"],
  ["Urgent care clinic", "doctors"],
  ["Locksmith emergency", "locksmith"],
  ["Tow truck", "towing"],
  ["Ambulance number", "hospitals"],
  ["Police station Ballito", "government"],
];

for (const [q, vertical] of emergency) {
  add({
    id: `emg-${slugify(q)}`,
    query: q.includes("Ballito") ? q : `${q} Ballito`,
    intent: "EMERGENCY",
    expectVertical: vertical,
    expectEntityType: vertical,
    expectCapabilities: caps("business_search", "faq"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
  add({
    id: `emg-${slugify(q)}-now`,
    query: `${q} open now`,
    intent: "EMERGENCY",
    expectVertical: vertical,
    expectEntityType: vertical,
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
    expectSearchFilters: { openNow: true },
  });
}

// ─── NAVIGATION / PLACE ────────────────────────────────────────────
const navigation = [
  ["Where is Lifestyle Centre?", "places"],
  ["Where is Ballito Junction?", "places"],
  ["Restaurants near Salt Rock", "restaurants"],
  ["Coffee near Willard Beach", "cafes"],
  ["How do I get to Salt Rock?", "places"],
  ["Directions to Ballito Lifestyle Centre", "places"],
  ["Shops at Ballito Junction", "shopping"],
  ["Parking at Ballito Junction", "places"],
  ["Where is Zimbali?", "places"],
  ["Where is Simbithi?", "places"],
  ["Beaches near Salt Rock", "attractions"],
  ["Pharmacies near Ballito Junction", "pharmacies"],
  ["ATMs near Lifestyle Centre", "shopping"],
  ["Fuel stations near N2 Ballito", "shopping"],
  ["Where is Thompson's Bay?", "places"],
];

for (const [q, entity] of navigation) {
  add({
    id: `nav-${slugify(q)}`,
    query: q,
    intent: q.toLowerCase().startsWith("where") || q.toLowerCase().includes("directions")
      ? "NAVIGATION"
      : "PLACE_SEARCH",
    expectEntityType: entity,
    expectVertical: entity === "places" ? "places" : entity,
    expectCapabilities: caps("business_search", "static_dataset"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
}

// ─── EVENTS ────────────────────────────────────────────────────────
const events = [
  "What's happening this weekend?",
  "Markets this Saturday",
  "Events in Ballito tonight",
  "Live music this weekend",
  "Farmers market Ballito",
  "Community events this week",
  "What's on at Ballito Junction?",
  "Kids events this weekend",
  "Christmas markets Ballito",
  "New Year's Eve events Ballito",
  "Beach cleanups Ballito",
  "Parkrun Ballito",
  "Surfing competitions nearby",
  "Food festivals Ballito",
  "Art markets this month",
];

for (const q of events) {
  add({
    id: `evt-${slugify(q)}`,
    query: q,
    intent: "EVENT_SEARCH",
    expectEntityType: "events",
    expectVertical: "attractions",
    expectCapabilities: caps("business_search", "static_dataset"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
}

// ─── ACCOMMODATION ─────────────────────────────────────────────────
const accommodation = [
  ["Family accommodation", "hotels"],
  ["Pet friendly accommodation", "hotels"],
  ["Hotels with ocean view", "hotels"],
  ["Bed and breakfast", "hotels"],
  ["Self catering apartments", "hotels"],
  ["Luxury resorts", "hotels"],
  ["Budget stays", "hotels"],
  ["Airbnb style accommodation", "hotels"],
  ["Guest houses Salt Rock", "hotels"],
  ["Zimbali accommodation", "hotels"],
  ["Hotels with pool", "hotels"],
  ["Family hotels near beach", "hotels"],
  ["Weekend getaway packages", "hotels"],
  ["Conference hotels", "hotels"],
  ["Glamping Ballito", "hotels"],
];

for (const [q, vertical] of accommodation) {
  add({
    id: `acc-${slugify(q)}`,
    query: q.includes("Ballito") || q.includes("Salt") || q.includes("Zimbali")
      ? q
      : `${q} in Ballito`,
    intent: "ACCOMMODATION",
    expectVertical: vertical,
    expectEntityType: "hotels",
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
  add({
    id: `acc-${slugify(q)}-ask`,
    query: `Looking for ${q.toLowerCase()}`,
    intent: "ACCOMMODATION",
    expectVertical: vertical,
    expectEntityType: "hotels",
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
}

// ─── CONVERSATION / FACT ───────────────────────────────────────────
const conversation = [
  ["Why is Ballito popular?", true],
  ["Tell me about Salt Rock", true],
  ["What is Ask Ballito?", false],
  ["How does this app work?", false],
  ["Tell me about Ballito", true],
  ["History of Ballito", true],
  ["Is Ballito safe?", true],
  ["Best time to visit Ballito", true],
  ["What's the weather like in Ballito generally?", true],
  ["Tell me about Zimbali coastal resort", true],
  ["What makes Ballito special?", true],
  ["Who lives in Ballito?", true],
  ["Ballito vs Durban", true],
  ["Is Salt Rock part of Ballito?", false],
  ["What language is spoken in Ballito?", true],
];

for (const [q, needsLlm] of conversation) {
  add({
    id: `conv-${slugify(q)}`,
    query: q,
    intent: q.toLowerCase().includes("ask ballito") || q.toLowerCase().includes("app work")
      ? "FACT"
      : "CONVERSATION",
    expectCapabilities: caps("faq"),
    requireLlm: needsLlm,
    requireSql: false,
    requireSearch: false,
    requireKnowledgeCard: false,
  });
}

// ─── PLANNING ──────────────────────────────────────────────────────
const planning = [
  "Plan a family day under R1000",
  "Plan a romantic weekend",
  "Plan a day with toddlers",
  "Plan a rainy day itinerary",
  "Weekend itinerary for visitors",
  "Plan a birthday lunch for 8 people",
  "Plan a beach day with kids",
  "Three day Ballito itinerary",
  "Plan a date night under R800",
  "Plan a wellness day spa and lunch",
  "Family holiday week plan",
  "Plan activities for teenagers",
  "Corporate team day in Ballito",
  "Plan a proposal evening",
  "Budget backpacker day Ballito",
];

for (const q of planning) {
  add({
    id: `plan-${slugify(q)}`,
    query: q,
    intent: "PLANNING",
    expectCapabilities: caps("business_search"),
    requireLlm: true,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
  add({
    id: `plan-${slugify(q)}-help`,
    query: `Can you help me ${q.toLowerCase()}?`,
    intent: "PLANNING",
    expectCapabilities: caps("business_search"),
    requireLlm: true,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
}

// ─── COMPARISON ────────────────────────────────────────────────────
const comparisons = [
  "Salt Rock vs Ballito",
  "Zimbali vs Simbithi",
  "Ballito Junction vs Lifestyle Centre",
  "Willard Beach vs Thompson's Bay",
  "Best pizza place vs sushi for a date",
  "Hotels vs self catering for families",
  "Salt Rock beach vs Ballito beach",
  "Compare spas in Ballito",
  "Zimbali vs Ballito for tourists",
  "Simbithi vs Zimbali lifestyle",
  "Coffee shops: Junction vs beachfront",
  "Family restaurants vs fine dining",
  "Ballito vs Umhlanga",
  "Ballito vs Compagnes Drift",
  "Indoor vs outdoor activities this weekend",
];

for (const q of comparisons) {
  add({
    id: `cmp-${slugify(q)}`,
    query: q,
    intent: "COMPARISON",
    expectCapabilities: caps("business_search"),
    requireLlm: true,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
}

// ─── LIVE INFORMATION ──────────────────────────────────────────────
const live = [
  "What's open now?",
  "Is it raining?",
  "Load shedding today",
  "Weather in Ballito today",
  "Restaurants open now",
  "Pharmacies open now",
  "What's the surf like?",
  "Traffic to Ballito from Durban",
  "Beach flags today",
  "Is Willard Beach open?",
  "Cafes open early tomorrow",
  "Sunday trading hours Ballito",
  "Public holiday shops open?",
  "Current temperature Ballito",
  "Wind forecast today",
];

for (const q of live) {
  add({
    id: `live-${slugify(q)}`,
    query: q,
    intent: "LIVE_INFORMATION",
    expectCapabilities: caps("business_search", "static_dataset"),
    requireLlm: false,
    requireSql: q.toLowerCase().includes("open"),
    requireSearch: q.toLowerCase().includes("open") || q.toLowerCase().includes("restaurant") || q.toLowerCase().includes("pharmac"),
    requireKnowledgeCard: false,
    expectSearchFilters: q.toLowerCase().includes("open now") ? { openNow: true } : undefined,
  });
}

// Merge existing queries.json
try {
  const legacy = JSON.parse(fs.readFileSync("evals/queries.json", "utf8"));
  for (const row of legacy) {
    add({
      id: `legacy-${row.id}`,
      query: row.query,
      intent: "BUSINESS_SEARCH",
      expectVertical: row.expectVertical,
      expectEntityType: row.expectVertical,
      expectCapabilities: caps("business_search"),
      requireLlm: false,
      requireSql: true,
      requireSearch: true,
      requireKnowledgeCard: false,
    });
  }
} catch {
  // ignore
}

// Pad with more business paraphrases if under 500
const padTemplates = [
  ["breakfast", "cafes"],
  ["brunch", "cafes"],
  ["lunch specials", "restaurants"],
  ["dinner with a view", "restaurants"],
  ["tapas", "restaurants"],
  ["mexican food", "restaurants"],
  ["chinese takeaway", "restaurants"],
  ["fish and chips", "restaurants"],
  ["ice cream", "cafes"],
  ["bakery", "cafes"],
  ["florist", "shopping"],
  ["hardware store", "shopping"],
  ["bike shop", "shopping"],
  ["phone repair", "shopping"],
  ["dry cleaner", "shopping"],
  ["laundromat", "shopping"],
  ["opticometrist", "optometrists"],
  ["chiropractor", "physio"],
  ["massage therapist", "spas"],
  ["tattoo studio", "beauticians"],
  ["driving school", "services"],
  ["photographer", "services"],
  ["wedding venue", "attractions"],
  ["conference venue", "hotels"],
  ["coworking space", "cafes"],
];

const padPrefixes = [
  "Best",
  "Cheap",
  "Good",
  "Nearby",
  "Recommend a",
  "I need a",
  "Where is a",
  "Any",
];

let pad = 0;
while (questions.length < 520 && pad < 500) {
  const [term, vertical] = padTemplates[pad % padTemplates.length];
  const prefix = padPrefixes[pad % padPrefixes.length];
  add({
    id: `pad-${pad}`,
    query: `${prefix} ${term} in Ballito`,
    intent: "BUSINESS_SEARCH",
    expectVertical: vertical,
    expectEntityType: vertical,
    expectCapabilities: caps("business_search"),
    requireLlm: false,
    requireSql: true,
    requireSearch: true,
    requireKnowledgeCard: false,
  });
  pad += 1;
}

// Mark ~180 high-value business/discovery queries as core (full tier, IDs filled later)
const coreIds = new Set(
  questions
    .filter(
      (q) =>
        (q.intent === "BUSINESS_SEARCH" ||
          q.intent === "DISCOVERY" ||
          q.intent === "EMERGENCY" ||
          q.intent === "ACCOMMODATION") &&
        !q.id.startsWith("pad-") &&
        !q.id.startsWith("biz-para-") &&
        !q.id.includes("-ask") &&
        !q.id.includes("-help") &&
        !q.id.includes("-where"),
    )
    .slice(0, 180)
    .map((q) => q.id),
);

for (const q of questions) {
  if (coreIds.has(q.id)) {
    q.labelingTier = "full";
    q.expectTop1Ids = q.expectTop1Ids ?? [];
    q.expectTop3Ids = q.expectTop3Ids ?? [];
  }
}

const dataset = {
  version: 1,
  description:
    "Ask Ballito gold evaluation set — intent/capability labels for all; entity Top-k on labelingTier=full core.",
  questions,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(dataset, null, 2) + "\n");

// Keep legacy queries.json as a projection for offline CI (≥100)
const projection = questions
  .filter((q) => q.requireSearch && q.expectVertical)
  .slice(0, 120)
  .map((q) => ({
    id: q.id,
    query: q.query,
    city: q.city,
    expectVertical: q.expectVertical,
  }));
fs.writeFileSync(
  "evals/queries.json",
  JSON.stringify(projection, null, 2) + "\n",
);

console.log(`Wrote ${questions.length} gold questions → ${OUT}`);
console.log(`Core (full tier): ${coreIds.size}`);
console.log(`Synced ${projection.length} → evals/queries.json`);
