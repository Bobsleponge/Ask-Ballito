/**
 * Bootstrap curated labels from candidate dumps using category relevance filters.
 * Skips queries where no relevant candidates exist (those stay unlabeled — true gaps).
 *
 * Usage: node scripts/bootstrap-gold-labels.mjs
 */
import fs from "node:fs";
import path from "node:path";

const candidatesDir = path.join("evals", "gold", "candidates");
const labelsDir = path.join("evals", "gold", "labels");
fs.mkdirSync(labelsDir, { recursive: true });

/** @type {Record<string, RegExp[]>} */
const verticalMatchers = {
  cafes: [/cafe|coffee|bakery|restaurant|bistro/i],
  restaurants: [/restaurant|sushi|seafood|italian|steak|burger|grill|pizza|bistro|diner/i],
  nightlife: [/bar|night|club|pub|cocktail/i],
  beauticians: [/beauty|nail|salon|spa/i],
  hair_salons: [/hair|barber|salon/i],
  spas: [/spa|wellness|massage/i],
  gyms: [/gym|fitness|yoga|pilates/i],
  attractions: [/attraction|beach|park|activity|museum|tour/i],
  hotels: [/hotel|lodge|guest|accommodation|resort|bnb|bed/i],
  pharmacies: [/pharmac/i],
  dentists: [/dentist|dental/i],
  doctors: [/doctor|clinic|gp|medical/i],
  veterinary: [/vet|animal hospital/i],
  plumbing: [/plumb/i],
  electrical: [/electric/i],
  shopping: [/shop|store|mall|retail/i],
};

function relevant(cands, vertical) {
  const matchers = verticalMatchers[vertical] ?? [/./];
  return cands.filter((c) => {
    const hay = `${c.name} ${c.category ?? ""}`;
    // Hard reject pet stores for restaurant queries
    if (
      vertical === "restaurants" &&
      /pet|vet|kennel|groom/i.test(hay) &&
      !/restaurant/i.test(hay)
    ) {
      return false;
    }
    if (vertical === "cafes" && /hotel|guest house|laundry|chicken/i.test(hay)) {
      return false;
    }
    return matchers.some((re) => re.test(hay));
  });
}

let written = 0;
let skipped = 0;

for (const file of fs.readdirSync(candidatesDir).filter((f) => f.endsWith(".json"))) {
  const dump = JSON.parse(
    fs.readFileSync(path.join(candidatesDir, file), "utf8"),
  );
  const vertical = dump.expectVertical ?? "restaurants";
  const picks = relevant(dump.candidates ?? [], vertical);
  if (picks.length === 0) {
    skipped += 1;
    console.log(`skip ${dump.questionId} (no relevant candidates — coverage gap)`);
    continue;
  }

  // Prefer sushi-named for sushi queries
  let ordered = picks;
  if (/sushi/i.test(dump.query)) {
    ordered = [
      ...picks.filter((c) => /sushi|japanese/i.test(`${c.name} ${c.category}`)),
      ...picks.filter((c) => !/sushi|japanese/i.test(`${c.name} ${c.category}`)),
    ];
  }
  if (/pizza/i.test(dump.query)) {
    ordered = [
      ...picks.filter((c) => /pizza/i.test(`${c.name} ${c.category}`)),
      ...picks,
    ];
  }
  // dedupe by id preserving order
  const seen = new Set();
  ordered = ordered.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  const top1 = [ordered[0].id];
  const top3 = ordered.slice(0, 3).map((c) => c.id);

  const label = {
    questionId: dump.questionId,
    expectTop1Ids: top1,
    expectTop3Ids: top3,
    notes: `curated-from-candidates v1; vertical=${vertical}; names=${ordered
      .slice(0, 3)
      .map((c) => c.name)
      .join(" | ")}`,
  };

  fs.writeFileSync(
    path.join(labelsDir, `${dump.questionId}.json`),
    JSON.stringify(label, null, 2) + "\n",
  );
  written += 1;
  console.log(`ok  ${dump.questionId} → ${ordered[0].name}`);
}

console.log(`\nWrote ${written} labels, skipped ${skipped} gaps`);
