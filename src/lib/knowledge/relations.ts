import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RelationPredicate = "LOCATED_IN" | "PART_OF" | "HOSTS";

/**
 * 1-hop: find subjects LOCATED_IN / PART_OF / HOSTS a place matched by name.
 */
export async function expandLocatedIn(opts: {
  citySlug: string;
  placeLabel: string;
  predicate?: RelationPredicate;
}): Promise<Array<{ kind: string; id: string }>> {
  const admin = createAdminClient();
  const label = opts.placeLabel.trim().toLowerCase();

  const { data: places } = await admin
    .from("places")
    .select("id, title, slug")
    .eq("city_slug", opts.citySlug)
    .eq("status", "published");

  const place = (places ?? []).find(
    (p) =>
      p.title.toLowerCase() === label ||
      p.slug === label.replace(/\s+/g, "-") ||
      p.title.toLowerCase().includes(label),
  );
  if (!place) return [];

  const predicate = opts.predicate ?? "LOCATED_IN";
  const { data: rels } = await admin
    .from("listing_relations")
    .select("subject_kind, subject_id")
    .eq("city_slug", opts.citySlug)
    .eq("predicate", predicate)
    .eq("object_kind", "place")
    .eq("object_id", place.id);

  return (rels ?? []).map((r) => ({
    kind: r.subject_kind,
    id: r.subject_id,
  }));
}
