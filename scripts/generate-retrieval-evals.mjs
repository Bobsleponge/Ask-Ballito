/**
 * Generate Ballito retrieval gold questions for eval (offline fixtures).
 * Run: node scripts/generate-retrieval-evals.mjs
 */
import fs from "node:fs";

const base = [
  { id: "sushi-ballito", query: "Best sushi in Ballito", expectVertical: "restaurants" },
  { id: "coffee-beach", query: "Coffee near Willard Beach", expectVertical: "cafes" },
  { id: "family-dinner", query: "Family friendly dinner tonight", expectVertical: "restaurants" },
  { id: "gel-nails", query: "Gel nails appointment", expectVertical: "beauticians" },
  { id: "balayage", query: "Balayage hair colour", expectVertical: "hair_salons" },
  { id: "vet-emergency", query: "Emergency vet open now", expectVertical: "veterinary" },
  { id: "outdoor-weekend", query: "Fun outdoor activities this weekend", expectVertical: "attractions" },
];

const templates = [
  ["best-breakfast", "Best breakfast in Ballito", "cafes"],
  ["best-coffee", "Best coffee shops", "cafes"],
  ["romantic-dinner", "Romantic restaurants Ballito", "restaurants"],
  ["dog-friendly", "Dog friendly restaurants", "restaurants"],
  ["rainy-day", "Rainy day activities Ballito", "attractions"],
  ["family-kids", "Things to do with kids", "attractions"],
  ["beaches", "Best beaches near Ballito", "attractions"],
  ["plumber", "Plumber for burst pipe Ballito", "plumbing"],
  ["electrician", "Electrician Ballito after hours", "electrical"],
  ["gp-open", "Doctor open now Ballito", "doctors"],
  ["pharmacy", "Pharmacy near me Ballito", "pharmacies"],
  ["hotel", "Hotels in Ballito with ocean view", "hotels"],
  ["bnb", "Bed and breakfast Ballito", "hotels"],
  ["spa", "Best spa Ballito", "spas"],
  ["gym", "Gym membership Ballito", "gyms"],
  ["surf", "Surf lessons Ballito", "attractions"],
  ["mall", "Shops at Ballito Junction", "shopping"],
  ["italian", "Italian restaurant Ballito", "restaurants"],
  ["seafood", "Seafood restaurant Ballito", "restaurants"],
  ["cocktails", "Cocktail bars Ballito", "nightlife"],
  ["live-music", "Live music tonight Ballito", "nightlife"],
  ["wifi-cafe", "Cafe with wifi to work", "cafes"],
  ["wheelchair", "Wheelchair accessible restaurant", "restaurants"],
  ["parking", "Restaurant with parking Ballito", "restaurants"],
  ["dentist", "Dentist Ballito", "dentists"],
  ["physio", "Physiotherapist Ballito", "physio"],
  ["estate-agent", "Estate agent Ballito", "estate-agents"],
  ["car-wash", "Car wash Ballito", "car-wash"],
  ["pet-groom", "Dog groomer Ballito", "pet-services"],
  ["market", "Weekend markets Ballito", "attractions"],
];

const more = [];
for (let i = 0; i < templates.length; i++) {
  const [id, query, expectVertical] = templates[i];
  more.push({ id, query, city: "ballito", expectVertical });
  more.push({
    id: `${id}-near`,
    query: `${query} near Salt Rock`,
    city: "ballito",
    expectVertical,
  });
  more.push({
    id: `${id}-best`,
    query: `Where is the best ${query.replace(/^Best /i, "").toLowerCase()}?`,
    city: "ballito",
    expectVertical,
  });
}

// Pad to ~120 with paraphrases
const paraphrases = [
  "Recommend",
  "Find me",
  "Looking for",
  "Any good",
  "Top rated",
];
let n = 0;
while (more.length < 120) {
  const t = templates[n % templates.length];
  const p = paraphrases[n % paraphrases.length];
  more.push({
    id: `gen-${more.length}`,
    query: `${p} ${t[1].replace(/^Best /i, "").toLowerCase()}`,
    city: "ballito",
    expectVertical: t[2],
  });
  n += 1;
}

const existingIds = new Set(base.map((b) => b.id));
const merged = [
  ...base.map((b) => ({ ...b, city: "ballito" })),
  ...more.filter((m) => !existingIds.has(m.id)),
];

fs.writeFileSync(
  "evals/queries.json",
  JSON.stringify(merged.slice(0, 120), null, 2) + "\n",
);
console.log("Wrote", Math.min(120, merged.length), "retrieval fixtures");
