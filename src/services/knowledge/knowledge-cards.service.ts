import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  KNOWLEDGE_CARD_SEEDS,
  matchKnowledgeCardSeed,
  type KnowledgeCardSeed,
} from "@/config/knowledge-cards";
import { businessSearchService } from "@/services/ai/business-search.service";
import { rankBusinesses, type RankContext } from "@/services/ai/ranking.engine";
import { loadRankConfig } from "@/services/ai/rank-config";
import {
  emptyConstraintModel,
  emptyEntityModel,
} from "@/services/planner/types";
import type { BusinessResult } from "@/lib/schemas/business";
import type { Json } from "@/types/database";

export interface KnowledgeCardMember {
  kind: "business" | "place";
  id: string;
  rank: number;
  score: number;
  reasons: string[];
}

export interface KnowledgeCardRule {
  version: number;
  listing_kinds: Array<"business" | "place">;
  require_terms?: string[];
  prefer_terms?: string[];
  business_types?: string[];
  min_rating?: number;
  min_term_confidence?: number;
  limit?: number;
  search_queries?: string[];
  vertical_hint?: string | null;
}

export interface KnowledgeCardRender {
  headline: string;
  disclaimer?: string;
  cta?: string;
}

export interface KnowledgeCardRecord {
  id?: string;
  citySlug: string;
  slug: string;
  title: string;
  queryClass: string;
  matchPatterns: string[];
  searchQueries: string[];
  businessIds: string[];
  bodyMd: string;
  rule: KnowledgeCardRule;
  members: KnowledgeCardMember[];
  render: KnowledgeCardRender;
  contentHash: string | null;
  version: number;
  refreshedAt: string | null;
}

function contentHash(members: KnowledgeCardMember[], render: KnowledgeCardRender): string {
  return createHash("sha256")
    .update(JSON.stringify({ members, render }))
    .digest("hex")
    .slice(0, 24);
}

function emptyRankContext(): RankContext {
  return {
    locationRef: null,
    entities: emptyEntityModel(),
    constraints: emptyConstraintModel(),
  };
}

function ruleFromSeed(seed: KnowledgeCardSeed): KnowledgeCardRule {
  return {
    version: 1,
    listing_kinds: ["business"],
    search_queries: [...seed.searchQueries],
    vertical_hint: seed.verticalHint ?? null,
    limit: 8,
    min_rating: 0,
    ...(seed.slug.includes("romantic")
      ? { require_terms: ["experience:romantic"], prefer_terms: ["amenities:ocean_view"] }
      : {}),
    ...(seed.slug.includes("dog") || seed.slug.includes("pet")
      ? { require_terms: ["audience:pets"] }
      : {}),
    ...(seed.slug.includes("rainy")
      ? { prefer_terms: ["weather_fit:rain_friendly", "experience:rainy_day"] }
      : {}),
    ...(seed.slug.includes("family")
      ? { prefer_terms: ["audience:family"] }
      : {}),
  };
}

function renderFromSeed(seed: KnowledgeCardSeed): KnowledgeCardRender {
  return {
    headline: seed.bodyTemplate,
    disclaimer: undefined,
  };
}

function mapRow(data: Record<string, unknown>, fallback?: KnowledgeCardSeed): KnowledgeCardRecord {
  const rule = (data.rule as KnowledgeCardRule) ?? (fallback ? ruleFromSeed(fallback) : { version: 1, listing_kinds: ["business"] });
  const members = Array.isArray(data.members)
    ? (data.members as KnowledgeCardMember[])
    : [];
  const render =
    (data.render as KnowledgeCardRender) ??
    (fallback ? renderFromSeed(fallback) : { headline: String(data.title ?? "") });
  const businessIds =
    members.length > 0
      ? members.filter((m) => m.kind === "business").map((m) => m.id)
      : ((data.business_ids as string[]) ?? []);

  return {
    id: data.id as string | undefined,
    citySlug: String(data.city_slug),
    slug: String(data.slug),
    title: String(data.title),
    queryClass: String(data.query_class ?? "DISCOVERY"),
    matchPatterns: (data.match_patterns as string[]) ?? [],
    searchQueries: (data.search_queries as string[]) ?? rule.search_queries ?? [],
    businessIds,
    bodyMd: String(data.body_md ?? render.headline ?? ""),
    rule,
    members,
    render,
    contentHash: (data.content_hash as string | null) ?? null,
    version: Number(data.version ?? 1),
    refreshedAt: (data.refreshed_at as string | null) ?? null,
  };
}

/** Plain-text render from structured card (no markdown essay as source of truth). */
export function renderKnowledgeCardText(card: KnowledgeCardRecord): string {
  const lines: string[] = [card.render.headline || card.title];
  if (card.render.disclaimer) lines.push("", card.render.disclaimer);
  return lines.join("\n");
}

/**
 * Look up a stored knowledge card for a user message.
 */
export async function findKnowledgeCard(params: {
  citySlug: string;
  message: string;
}): Promise<KnowledgeCardRecord | null> {
  const seed = matchKnowledgeCardSeed(params.message);
  if (!seed) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_cards")
    .select("*")
    .eq("city_slug", params.citySlug)
    .eq("slug", seed.slug)
    .maybeSingle();

  if (error || !data) {
    return {
      citySlug: params.citySlug,
      slug: seed.slug,
      title: seed.title,
      queryClass: seed.queryClass,
      matchPatterns: [...seed.matchPatterns],
      searchQueries: [...seed.searchQueries],
      businessIds: [],
      bodyMd: seed.bodyTemplate,
      rule: ruleFromSeed(seed),
      members: [],
      render: renderFromSeed(seed),
      contentHash: null,
      version: 1,
      refreshedAt: null,
    };
  }

  return mapRow(data as Record<string, unknown>, seed);
}

/**
 * Refresh one knowledge card by running hybrid search + deterministic rank.
 * Stores structured members + render hints (body_md kept for back-compat).
 */
export async function refreshKnowledgeCard(params: {
  citySlug: string;
  seed: KnowledgeCardSeed;
}): Promise<KnowledgeCardRecord> {
  const { citySlug, seed } = params;
  const rule = ruleFromSeed(seed);
  const render = renderFromSeed(seed);

  const candidates = await businessSearchService.searchMany({
    citySlug,
    queries: [...seed.searchQueries],
    limitPerQuery: 15,
  });

  const ranked = rankBusinesses(
    candidates,
    emptyRankContext(),
    loadRankConfig({
      limit: rule.limit ?? 8,
      minKeep: 3,
      verticalHint: seed.verticalHint ?? null,
    }),
  );

  const members: KnowledgeCardMember[] = ranked.map((b: BusinessResult, i) => ({
    kind: "business" as const,
    id: b.id,
    rank: i + 1,
    score: b.score ?? Math.round((b.similarity ?? 0) * 100),
    reasons: [
      b.rating != null ? `rating:${b.rating}` : null,
      seed.verticalHint ? `vertical:${seed.verticalHint}` : null,
      ...(rule.require_terms ?? []),
    ].filter((x): x is string => Boolean(x)),
  }));

  const businessIds = members.map((m) => m.id);
  const lines = ranked.map(
    (b, i) =>
      `${i + 1}. **${b.name}**${b.rating ? ` (${b.rating.toFixed(1)}★)` : ""}${
        b.category ? ` — ${b.category}` : ""
      }`,
  );
  const bodyMd = [render.headline, "", ...lines].join("\n");
  const hash = contentHash(members, render);

  const admin = createAdminClient();
  const row = {
    city_slug: citySlug,
    slug: seed.slug,
    title: seed.title,
    query_class: seed.queryClass,
    match_patterns: [...seed.matchPatterns],
    search_queries: [...seed.searchQueries],
    business_ids: businessIds,
    body_md: bodyMd,
    rule: rule as unknown as Json,
    members: members as unknown as Json,
    render: render as unknown as Json,
    content_hash: hash,
    version: 1,
    refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("knowledge_cards")
    .upsert(row, { onConflict: "city_slug,slug" })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`knowledge_cards upsert failed: ${error.message}`);
  }

  return mapRow((data ?? row) as Record<string, unknown>, seed);
}

/** Refresh all seeded cards for a city. */
export async function refreshAllKnowledgeCards(citySlug: string): Promise<{
  refreshed: number;
  errors: string[];
}> {
  let refreshed = 0;
  const errors: string[] = [];
  for (const seed of KNOWLEDGE_CARD_SEEDS) {
    try {
      await refreshKnowledgeCard({ citySlug, seed });
      refreshed += 1;
    } catch (err) {
      errors.push(
        `${seed.slug}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { refreshed, errors };
}
