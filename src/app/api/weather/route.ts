import { NextResponse, type NextRequest } from "next/server";
import { getCity } from "@/config/cities";
import { env } from "@/lib/env";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import {
  checkPublicDiscoverRateLimit,
  getClientIp,
  isRateLimitConfigured,
} from "@/lib/security/rate-limit";
import { getCityWeather } from "@/services/weather/weather.service";

export const runtime = "nodejs";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
};

export async function GET(request: NextRequest) {
  if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
    return NextResponse.json(
      { error: "Weather unavailable." },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const rl = await checkPublicDiscoverRateLimit(`ip:${ip}`);
  if (!rl.configured && env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Weather unavailable." },
      { status: 503 },
    );
  }
  if (!rl.success) {
    captureAbuseEvent({
      event: "rate_limited",
      distinctId: ip,
      properties: { route: "api/weather", scope: "public_discover" },
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

  const snapshot = await getCityWeather(city, { horizon: "near_term" });
  if (!snapshot) {
    return NextResponse.json(
      { error: "Weather unavailable." },
      { status: 502, headers: CACHE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      summary: snapshot.summary,
      conditionText: snapshot.conditionText,
      conditionType: snapshot.conditionType,
      temperatureC: snapshot.temperatureC,
      isRainingNow: snapshot.isRainingNow,
      isDaytime: snapshot.isDaytime,
      outdoorBias: snapshot.outdoorBias,
    },
    { headers: CACHE_HEADERS },
  );
}
