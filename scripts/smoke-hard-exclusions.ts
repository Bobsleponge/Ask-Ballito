/**
 * Smoke: QI hard exclusions filter businesses in code.
 */
import assert from "node:assert/strict";
import { filterByHardExclusions } from "../src/services/planner/hard-exclusions";
import type { BusinessResult } from "../src/lib/schemas/business";

function biz(
  partial: Partial<BusinessResult> & { id: string; name: string },
): BusinessResult {
  return {
    category: null,
    description: null,
    address: null,
    phone: null,
    website: null,
    rating: null,
    ratingCount: null,
    priceLevel: null,
    lat: null,
    lng: null,
    photos: [],
    similarity: 0.5,
    ...partial,
  };
}

const pool = [
  biz({
    id: "1",
    name: "Coast Hotel Ballito",
    category: "Hotel",
    description: "seaside hotel",
  }),
  biz({
    id: "2",
    name: "Party Platters Co",
    category: "Caterer",
    description: "house party catering",
  }),
  biz({
    id: "3",
    name: "Sugar Soft Play",
    category: "Soft play centre",
    description: "kids soft play",
  }),
];

const filtered = filterByHardExclusions(pool, ["hotel", "soft play"]);
assert.equal(filtered.length, 1);
assert.equal(filtered[0]!.id, "2");

const untouched = filterByHardExclusions(pool, []);
assert.equal(untouched.length, 3);

console.log("smoke-hard-exclusions: ok");
