import { NextResponse, type NextRequest } from "next/server";
import { getCity } from "@/config/cities";
import { SEED_TRENDING } from "@/config/discover";
import { env } from "@/lib/env";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import {
  checkPublicDiscoverRateLimit,
  getClientIp,
  isRateLimitConfigured,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MIN_LIVE = 3;
const LIMIT = 6;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET(request: NextRequest) {
  if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
    return NextResponse.json(
      { error: "Trending unavailable." },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const rl = await checkPublicDiscoverRateLimit(`ip:${ip}`);
  if (!rl.configured && env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Trending unavailable." },
      { status: 503 },
    );
  }
  if (!rl.success) {
    captureAbuseEvent({
      event: "rate_limited",
      distinctId: ip,
      properties: { route: "api/trending", scope: "public_discover" },
    });
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  const citySlug = request.nextUrl.searchParams.get("city") ?? "ballito";
  const city = getCity(citySlug);
  if (!city || !city.enabled) {
    return NextResponse.json({ error: "City not available." }, { status: 400 });
  }

  let queries: { query: string; hitCount?: number; source: "live" | "seed" }[] =
    [];

  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("search_events")
      .select("query_norm, query_raw")
      .eq("city_slug", city.slug)
      .gte("created_at", since)
      .limit(500);

    if (!error && data?.length) {
      const counts = new Map<
        string,
        { count: number; display: string }
      >();
      for (const row of data) {
        const norm = row.query_norm;
        const existing = counts.get(norm);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(norm, { count: 1, display: row.query_raw });
        }
      }
      queries = [...counts.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, LIMIT)
        .map(([, v]) => ({
          query: v.display,
          hitCount: v.count,
          source: "live" as const,
        }));
    }
  } catch {
    // Fall through to seeds.
  }

  if (queries.length < MIN_LIVE) {
    const liveSet = new Set(queries.map((q) => q.query.toLowerCase()));
    for (const seed of SEED_TRENDING) {
      if (queries.length >= LIMIT) break;
      if (liveSet.has(seed.query.toLowerCase())) continue;
      queries.push({ query: seed.query, source: "seed" });
    }
  }

  return NextResponse.json(
    {
      city: city.slug,
      queries: queries.slice(0, LIMIT),
    },
    { headers: CACHE_HEADERS },
  );
}
