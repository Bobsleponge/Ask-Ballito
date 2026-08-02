/**
 * Enforce Query Intelligence hard exclusions in code (not narration).
 */

import type { BusinessResult } from "@/lib/schemas/business";

/**
 * Drop businesses whose name/category/description match any hard exclusion needle.
 */
export function filterByHardExclusions<T extends BusinessResult>(
  businesses: T[],
  hardExclusions: string[] | undefined | null,
): T[] {
  if (!hardExclusions || hardExclusions.length === 0) return businesses;
  const needles = hardExclusions
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length >= 3);
  if (needles.length === 0) return businesses;

  return businesses.filter((b) => {
    const hay = `${b.name} ${b.category ?? ""} ${b.description ?? ""}`.toLowerCase();
    return !needles.some((n) => hay.includes(n));
  });
}
