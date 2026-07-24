import type { BusinessResult } from "@/lib/schemas/business";
import { extractAttributes } from "@/lib/schemas/business-attributes";
import {
  isDiningBusiness,
  isRawCategoryUnsuitableForSection,
  leisureBucketFromVerticals,
} from "@/lib/business-vertical-filter";

/** Dining / general experience vibe bucket (restaurants layout). */
export function diningBucket(b: BusinessResult): string | null {
  // Never vibe-bucket non-dining listings into restaurant replies.
  if (!isDiningBusiness(b)) return null;

  const attrs = extractAttributes(b.metadata);
  const cat = (b.category ?? "").toLowerCase();
  const hay = `${b.name} ${b.description ?? ""} ${cat}`.toLowerCase();

  // Meal signals first so breakfast cafés are not swallowed by fine-dining / outdoor.
  if (attrs.breakfast === true || /\bbreakfast|brunch\b/.test(hay)) {
    return "Breakfast & brunch";
  }
  if (/\bcafe|coffee|espresso|bakery\b/.test(hay)) return "Coffee & cafes";

  if (b.priceLevel != null && b.priceLevel >= 3) return "Fine dining";
  if (attrs.seaView === true || /\bsea view|ocean view|beachfront\b/.test(hay)) {
    return "Sea views";
  }
  if (attrs.outdoorSeating === true || /\boutdoor|al fresco|patio\b/.test(hay)) {
    return "Outdoor seating";
  }
  if (attrs.romantic === true || /\bromantic|date night\b/.test(hay)) {
    return "Date night";
  }
  if (
    attrs.familyFriendly === true ||
    attrs.kidsArea === true ||
    (/\bfamily\s*(restaurant|friendly)|kids\s*menu|children'?s?\s*menu\b/i.test(
      hay,
    ) &&
      !/\bdental|dentist|clinic|doctor\b/i.test(hay))
  ) {
    return "Family-friendly";
  }
  if (/\bbar|wine|cocktail|pub\b/.test(hay)) return "Drinks & bars";
  if (b.priceLevel != null && b.priceLevel <= 1) return "Easy on the wallet";

  const fromVertical = leisureBucketFromVerticals(b);
  if (fromVertical === "Food & drink" || fromVertical === "Drinks & nightlife") {
    return fromVertical === "Drinks & nightlife" ? "Drinks & bars" : "Food & drink";
  }
  // Ignore experiences/shopping leisure buckets for dining replies.
  if (fromVertical) return "Food & drink";

  if (isRawCategoryUnsuitableForSection(b.category)) return null;

  return "Food & drink";
}
