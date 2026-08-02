import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BALLITO_FAQ, BALLITO_EMERGENCY, type EmergencyContact } from "@/config/local-knowledge";

/**
 * Resolve FAQ from city_faqs (DB) with TypeScript fallback during migration.
 */
export async function matchCityFaq(opts: {
  citySlug: string;
  message: string;
}): Promise<string | null> {
  const key = opts.message.toLowerCase().replace(/[?!.,']/g, "").trim();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("city_faqs")
      .select("match_patterns, answer")
      .eq("city_slug", opts.citySlug)
      .eq("status", "published");

    for (const row of data ?? []) {
      for (const pattern of row.match_patterns ?? []) {
        if (key.includes(pattern) || pattern.includes(key)) {
          return row.answer;
        }
      }
    }
  } catch {
    // fall through to TS seed
  }

  if (opts.citySlug !== "ballito") return null;
  for (const [pattern, answer] of Object.entries(BALLITO_FAQ)) {
    if (key.includes(pattern) || pattern.includes(key)) return answer;
  }
  return null;
}

export async function loadEmergencyPlaces(citySlug: string): Promise<EmergencyContact[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("places")
      .select("title, summary, props")
      .eq("city_slug", citySlug)
      .eq("place_kind", "emergency")
      .eq("status", "published");

    if (data && data.length > 0) {
      return data.map((p) => ({
        name: p.title,
        phone:
          typeof (p.props as Record<string, unknown>)?.phone === "string"
            ? String((p.props as Record<string, unknown>).phone)
            : "See listing",
        note: p.summary ?? undefined,
      }));
    }
  } catch {
    // fall through
  }
  return citySlug === "ballito" ? [...BALLITO_EMERGENCY] : [];
}

export async function lookupPlaceByAlias(opts: {
  citySlug: string;
  label: string;
}): Promise<{ lat: number; lng: number; title: string; kind: string } | null> {
  const n = opts.label.trim().toLowerCase();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("places")
      .select("title, place_kind, lat, lng, slug")
      .eq("city_slug", opts.citySlug)
      .eq("status", "published");

    for (const p of data ?? []) {
      if (
        p.title.toLowerCase() === n ||
        p.slug === n.replace(/\s+/g, "-") ||
        p.title.toLowerCase().includes(n)
      ) {
        if (p.lat == null || p.lng == null) continue;
        return {
          title: p.title,
          kind: p.place_kind,
          lat: p.lat,
          lng: p.lng,
        };
      }
    }
  } catch {
    // fall through to geo-references in caller
  }
  return null;
}
