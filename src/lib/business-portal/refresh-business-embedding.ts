import "server-only";
import { embedText, toVectorLiteral } from "@/lib/ai/embeddings";
import { buildEmbeddingText } from "@/lib/business-embedding-text";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HoursOverride } from "@/lib/schemas/business-profile";
import type { Json } from "@/types/database";
import { businessProfileService } from "@/services/business-portal/business-profile.service";
import { businessMenuItemService } from "@/services/business-portal/business-menu-item.service";
import { BusinessSpecialRepository } from "@/services/business-portal/business-special.repository";
import { isSpecialLive } from "@/lib/business-portal/special-live";

/**
 * Rebuild businesses.embedding from directory fields + owner portal content
 * (services, keywords, menu, attributes, hours, live specials).
 */
export async function refreshBusinessSearchEmbedding(
  businessId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("businesses")
    .select(
      "id, name, category, categories, description, address, metadata",
    )
    .eq("id", businessId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load business for embed: ${error.message}`);
  if (!row) return;

  const [profile, menuRows, specials] = await Promise.all([
    businessProfileService.get(businessId),
    businessMenuItemService.list(businessId),
    new BusinessSpecialRepository(admin).listByBusiness(businessId),
  ]);

  const descriptionBits = [
    profile?.tagline?.trim() || null,
    profile?.description?.trim() || row.description || null,
  ]
    .filter(Boolean)
    .join(". ");

  const ownerAttributes =
    profile?.attributes &&
    typeof profile.attributes === "object" &&
    !Array.isArray(profile.attributes)
      ? (profile.attributes as Record<string, unknown>)
      : null;

  const hoursDescriptions = hoursToDescriptions(profile?.hours_override ?? null);
  const now = new Date();
  const liveSpecials = specials
    .filter((s) => s.status === "active" && isSpecialLive(s, now))
    .map((s) => ({
      title: s.title,
      discountLabel: s.discount_label,
      kind: s.kind,
    }));

  const embeddingText = buildEmbeddingText({
    name: row.name,
    category: row.category,
    categories: row.categories,
    description: descriptionBits || null,
    address: row.address,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    ownerServices: profile?.services ?? [],
    ownerKeywords: profile?.keywords ?? [],
    ownerAttributes,
    hoursDescriptions,
    specials: liveSpecials,
    menuItems: menuRows.map((m) => ({
      name: m.name,
      description: m.description,
      category: m.category,
    })),
  });

  const embedding = await embedText(embeddingText);

  // Sync owner services/keywords into businesses.metadata so FTS (search_tsv)
  // picks them up — the tsv trigger only reads metadata, not business_profiles.
  const prevMeta = (row.metadata as Record<string, unknown>) ?? {};
  const nextMeta: Record<string, unknown> = { ...prevMeta };
  if (profile?.services?.length) {
    nextMeta.services = profile.services;
  }
  if (profile?.keywords?.length) {
    nextMeta.keywords = profile.keywords;
  }
  if (ownerAttributes) {
    nextMeta.attributes = {
      ...((prevMeta.attributes as Record<string, unknown>) ?? {}),
      ...ownerAttributes,
    };
    nextMeta.attributesSource = "manual";
  }
  if (hoursDescriptions.length > 0) {
    nextMeta.openingHours = {
      ...((prevMeta.openingHours as Record<string, unknown>) ?? {}),
      weekdayDescriptions: hoursDescriptions,
    };
  }

  const { error: updateError } = await admin
    .from("businesses")
    .update({
      embedding: toVectorLiteral(embedding),
      embedding_text: embeddingText,
      metadata: nextMeta as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (updateError) {
    throw new Error(`Failed to refresh embedding: ${updateError.message}`);
  }
}

function hoursToDescriptions(raw: Json | null): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const hours = raw as HoursOverride;
  const labels: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };
  const out: string[] = [];
  for (const [day, label] of Object.entries(labels)) {
    const row = hours[day as keyof HoursOverride];
    if (!row) continue;
    if (row.closed) out.push(`${label}: Closed`);
    else if (row.open && row.close)
      out.push(`${label}: ${row.open}–${row.close}`);
  }
  return out;
}
