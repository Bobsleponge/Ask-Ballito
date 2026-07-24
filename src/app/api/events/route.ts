import { NextResponse, type NextRequest } from "next/server";
import { getCity } from "@/config/cities";
import { env } from "@/lib/env";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import {
  checkPublicDiscoverRateLimit,
  getClientIp,
  isRateLimitConfigured,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export interface CityEventDto {
  id: string;
  title: string;
  description: string | null;
  venueName: string | null;
  address: string | null;
  startsAt: string;
  endsAt: string | null;
  url: string | null;
  source: string;
}

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

const SEED_FALLBACK: CityEventDto[] = [
  {
    id: "seed-market",
    title: "Ballito Farmers Market",
    description: "Fresh produce, artisan goods, and local food stalls.",
    venueName: "Ballito Lifestyle Centre",
    address: "Ballito Drive, Ballito",
    startsAt: "",
    endsAt: null,
    url: null,
    source: "seed",
  },
  {
    id: "seed-yoga",
    title: "Sunset Yoga on the Beach",
    description: "Beginner-friendly yoga with ocean views.",
    venueName: "Willard Beach",
    address: "Ballito Beachfront",
    startsAt: "",
    endsAt: null,
    url: null,
    source: "seed",
  },
  {
    id: "seed-music",
    title: "Live Music at Salt Rock",
    description: "Local bands and sundowners along the coast.",
    venueName: "Salt Rock Beach Bar",
    address: "Salt Rock",
    startsAt: "",
    endsAt: null,
    url: null,
    source: "seed",
  },
];

function nextWeekendIso(hour: number, dayOffset: number): string {
  const now = new Date();
  const day = now.getDay();
  const toSat = (6 - day + 7) % 7 || 7;
  const d = new Date(now);
  d.setDate(d.getDate() + toSat + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function withSeedDates(): CityEventDto[] {
  return [
    {
      ...SEED_FALLBACK[0]!,
      startsAt: nextWeekendIso(8, 0),
      endsAt: nextWeekendIso(13, 0),
    },
    {
      ...SEED_FALLBACK[1]!,
      startsAt: nextWeekendIso(17, -2),
      endsAt: nextWeekendIso(18, -2),
    },
    {
      ...SEED_FALLBACK[2]!,
      startsAt: nextWeekendIso(18, -1),
      endsAt: nextWeekendIso(22, -1),
    },
  ];
}

export async function GET(request: NextRequest) {
  if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
    return NextResponse.json(
      { error: "Events unavailable." },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const rl = await checkPublicDiscoverRateLimit(`ip:${ip}`);
  if (!rl.configured && env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Events unavailable." },
      { status: 503 },
    );
  }
  if (!rl.success) {
    captureAbuseEvent({
      event: "rate_limited",
      distinctId: ip,
      properties: { route: "api/events", scope: "public_discover" },
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

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("city_events")
      .select(
        "id, title, description, venue_name, address, starts_at, ends_at, url, source",
      )
      .eq("city_slug", city.slug)
      .eq("status", "published")
      .gte("starts_at", now)
      .order("starts_at", { ascending: true })
      .limit(8);

    if (!error && data && data.length > 0) {
      const events: CityEventDto[] = data.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        venueName: row.venue_name,
        address: row.address,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        url: row.url,
        source: row.source,
      }));
      return NextResponse.json(
        { city: city.slug, events },
        { headers: CACHE_HEADERS },
      );
    }
  } catch {
    // Fall through to seed.
  }

  return NextResponse.json(
    {
      city: city.slug,
      events: withSeedDates(),
    },
    { headers: CACHE_HEADERS },
  );
}
