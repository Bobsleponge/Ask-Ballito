/** Prefer highly rated, well-reviewed places when ranking discovery results. */
export function popularityScore(b: {
  rating: number | null;
  ratingCount: number | null;
}): number {
  const rating = b.rating ?? 0;
  const count = b.ratingCount ?? 0;
  return rating * Math.log10(count + 1);
}
