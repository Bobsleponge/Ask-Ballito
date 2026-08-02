/**
 * Smoke: universal hard-constraint eligibility (unknown ≠ true).
 */
import assert from "node:assert/strict";
import {
  environmentEvidence,
  filterByHardEligibility,
  hasHardEligibilityRequirements,
} from "../src/services/planner/eligibility";
import {
  emptyConstraintModel,
  type ConstraintModel,
} from "../src/services/planner/types";
import type { BusinessResult } from "../src/lib/schemas/business";

function biz(
  partial: Partial<BusinessResult> & {
    id: string;
    name: string;
    attrs?: Record<string, unknown>;
  },
): BusinessResult {
  const { attrs, ...rest } = partial;
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
    similarity: 0.8,
    metadata: attrs ? { attributes: attrs } : {},
    ...rest,
  };
}

const outdoorPark = biz({
  id: "1",
  name: "Sugar Rush Park",
  category: "Park",
  attrs: { outdoorPlay: true, familyFriendly: true },
});
const indoorPlay = biz({
  id: "2",
  name: "Cutie Soft Play",
  category: "Indoor Playground",
  attrs: { indoorPlay: true, familyFriendly: true, outdoorPlay: false },
});
const gym = biz({
  id: "3",
  name: "CrossFit Box",
  category: "Gym",
  attrs: {},
});
const patioCafe = biz({
  id: "4",
  name: "Sea Patio Cafe",
  category: "Cafe",
  attrs: { outdoorSeating: true, petFriendly: true, wifi: true },
});
const unknownPark = biz({
  id: "5",
  name: "Mystery Park",
  category: "Park",
  attrs: {},
});

// Outdoor environment: known outdoor passes; indoor/unknown drop
assert.equal(environmentEvidence("outdoor", { outdoorPlay: true }), true);
assert.equal(environmentEvidence("outdoor", { indoorPlay: true }), false);
assert.equal(environmentEvidence("outdoor", {}), null);

const outdoorKids: ConstraintModel = {
  ...emptyConstraintModel(),
  environmentRequired: "outdoor",
  required: {
    ...emptyConstraintModel().required,
    familyFriendly: true,
  },
};

assert.equal(hasHardEligibilityRequirements(outdoorKids), true);

const outdoorResult = filterByHardEligibility(
  [outdoorPark, indoorPlay, gym, unknownPark],
  outdoorKids,
);
assert.deepEqual(
  outdoorResult.eligible.map((b) => b.id),
  ["1"],
);
assert.ok(outdoorResult.dropped.some((d) => d.id === "2"));
assert.ok(outdoorResult.dropped.some((d) => d.id === "5")); // unknown ≠ true

// Pet + wifi required: patio cafe passes; others drop
const petWifi: ConstraintModel = {
  ...emptyConstraintModel(),
  required: {
    ...emptyConstraintModel().required,
    petFriendly: true,
    wifi: true,
  },
};
const petResult = filterByHardEligibility(
  [patioCafe, outdoorPark, gym],
  petWifi,
);
assert.deepEqual(
  petResult.eligible.map((b) => b.id),
  ["4"],
);

// No hard requirements → pass-through
const soft = filterByHardEligibility([gym, indoorPlay], emptyConstraintModel());
assert.equal(soft.eligible.length, 2);
assert.equal(soft.hadHardRequirements, false);

// Hard false: adults_only style kidsArea=false drops known kids venues only
const noKids: ConstraintModel = {
  ...emptyConstraintModel(),
  required: {
    ...emptyConstraintModel().required,
    kidsArea: false,
  },
};
const kidsVenue = biz({
  id: "6",
  name: "Kids Zone",
  attrs: { kidsArea: true },
});
const adultSpa = biz({
  id: "7",
  name: "Quiet Spa",
  attrs: {},
});
const noKidsResult = filterByHardEligibility([kidsVenue, adultSpa], noKids);
assert.deepEqual(
  noKidsResult.eligible.map((b) => b.id),
  ["7"],
);

console.log("smoke-eligibility: ok");
