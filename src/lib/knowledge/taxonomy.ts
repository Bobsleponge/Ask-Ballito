import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractAttributes } from "@/lib/schemas/business-attributes";

export interface TaxonomyTermRef {
  dimensionSlug: string;
  termSlug: string;
  termId: string;
  synonyms: string[];
}

let cachedTerms: TaxonomyTermRef[] | null = null;
let cachedAt = 0;
const CACHE_MS = 10 * 60 * 1000;

/** Load taxonomy lexicon (cached in-process). */
export async function loadTaxonomyLexicon(): Promise<TaxonomyTermRef[]> {
  if (cachedTerms && Date.now() - cachedAt < CACHE_MS) return cachedTerms;
  const admin = createAdminClient();
  const { data: dims } = await admin
    .from("taxonomy_dimensions")
    .select("id, slug");
  const dimById = new Map((dims ?? []).map((d) => [d.id, d.slug]));
  const { data: terms } = await admin
    .from("taxonomy_terms")
    .select("id, slug, dimension_id, synonyms");
  cachedTerms = (terms ?? []).map((t) => ({
    dimensionSlug: dimById.get(t.dimension_id) ?? "unknown",
    termSlug: t.slug,
    termId: t.id,
    synonyms: t.synonyms ?? [],
  }));
  cachedAt = Date.now();
  return cachedTerms;
}

/** Map boolean attributes → taxonomy term slugs. */
export function attributeTermSlugs(
  metadata: Record<string, unknown> | null | undefined,
): Array<{ dimension: string; term: string }> {
  const attrs = extractAttributes(metadata);
  const out: Array<{ dimension: string; term: string }> = [];
  const push = (dimension: string, term: string, on: boolean | null | undefined) => {
    if (on === true) out.push({ dimension, term });
  };
  push("audience", "family", attrs.familyFriendly);
  push("experience", "romantic", attrs.romantic);
  push("audience", "pets", attrs.petFriendly);
  push("amenities", "kids_area", attrs.kidsArea);
  push("amenities", "ocean_view", attrs.seaView);
  push("accessibility", "wheelchair", attrs.wheelchair);
  push("amenities", "parking", attrs.parking);
  push("amenities", "outdoor_seating", attrs.outdoorSeating);
  push("amenities", "wifi", attrs.wifi);
  push("weather_fit", "rain_friendly", attrs.rainFriendly);
  // Play / activity environment
  push("weather_fit", "outdoor", attrs.outdoorPlay);
  push("weather_fit", "indoor", attrs.indoorPlay);
  push("amenities", "outdoor_play", attrs.outdoorPlay);
  push("amenities", "indoor_play", attrs.indoorPlay);
  if (attrs.outdoorSeating === true && attrs.outdoorPlay !== true) {
    push("weather_fit", "outdoor", true);
  }
  if (attrs.kidsArea === true) {
    push("audience", "kids", true);
  }
  push("nightlife", "late_night", attrs.lateNight);
  push("emergency", "after_hours", attrs.afterHours || attrs.emergencyCallOut);
  push("experience", "remote_work", attrs.laptopFriendly);
  push("nightlife", "cocktails", attrs.cocktails);
  push("nightlife", "live_music", attrs.liveMusic);
  push("dietary", "vegan", attrs.veganOptions);
  push("dietary", "halal", attrs.halalOptions);
  if (attrs.noiseLevel === "quiet") out.push({ dimension: "atmosphere", term: "quiet" });
  if (attrs.noiseLevel === "lively") out.push({ dimension: "atmosphere", term: "lively" });
  return out;
}

/**
 * Attach taxonomy terms to a business from attributes + verticals.
 * Idempotent upserts.
 */
export async function classifyBusinessTerms(opts: {
  businessId: string;
  metadata: Record<string, unknown> | null | undefined;
  verticals?: string[];
  source?: string;
  confidence?: number;
}): Promise<number> {
  const admin = createAdminClient();
  const lexicon = await loadTaxonomyLexicon();
  const byKey = new Map(
    lexicon.map((t) => [`${t.dimensionSlug}:${t.termSlug}`, t]),
  );

  const wanted = attributeTermSlugs(opts.metadata);
  for (const v of opts.verticals ?? []) {
    if (v === "restaurants") wanted.push({ dimension: "business_type", term: "restaurant" });
    if (v === "cafes") wanted.push({ dimension: "business_type", term: "cafe" });
    if (v === "hotels" || v === "accommodation")
      wanted.push({ dimension: "business_type", term: "hotel" });
  }

  let linked = 0;
  const source = opts.source ?? "heuristic";
  const confidence = opts.confidence ?? 0.55;
  const now = new Date().toISOString();

  for (const w of wanted) {
    const ref = byKey.get(`${w.dimension}:${w.term}`);
    if (!ref) continue;
    const { error } = await admin.from("listing_terms").upsert(
      {
        listing_kind: "business",
        listing_id: opts.businessId,
        term_id: ref.termId,
        confidence,
        source,
        verified_at: now,
        verification_method: source,
      },
      { onConflict: "listing_kind,listing_id,term_id" },
    );
    if (!error) linked += 1;
  }
  return linked;
}

/** Expand query tokens using term synonyms. */
export async function expandQuerySynonyms(query: string): Promise<string[]> {
  const lexicon = await loadTaxonomyLexicon();
  const q = query.toLowerCase();
  const extras = new Set<string>();
  for (const t of lexicon) {
    const needles = [t.termSlug.replace(/_/g, " "), ...t.synonyms];
    for (const n of needles) {
      if (n && q.includes(n.toLowerCase())) {
        extras.add(t.termSlug.replace(/_/g, " "));
        for (const s of t.synonyms) extras.add(s);
      }
    }
  }
  return [...extras];
}
