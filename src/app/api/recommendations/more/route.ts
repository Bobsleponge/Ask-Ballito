import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCity } from "@/config/cities";
import { env } from "@/lib/env";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import {
  checkChatRateLimit,
  getClientIp,
  isRateLimitConfigured,
} from "@/lib/security/rate-limit";
import { fetchMoreForSection } from "@/services/ai/section-more.service";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({
  city: z.string().min(1).max(64),
  sectionId: z.string().min(1).max(128),
  sectionTitle: z.string().min(1).max(120),
  ask: z.string().max(500).optional(),
  excludeBusinessIds: z.array(z.string().min(1).max(128)).max(100).default([]),
  limit: z.number().int().min(1).max(12).optional().default(6),
});

export async function POST(request: NextRequest) {
  if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const rl = await checkChatRateLimit(`ip:${ip}`);
  if (!rl.configured && env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Service temporarily unavailable." },
      { status: 503 },
    );
  }
  if (!rl.success) {
    captureAbuseEvent({
      event: "rate_limited",
      distinctId: ip,
      properties: { route: "api/recommendations/more", scope: "chat" },
    });
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const city = getCity(parsed.data.city);
  if (!city || !city.enabled) {
    return NextResponse.json({ error: "City not available." }, { status: 400 });
  }

  try {
    const businesses = await fetchMoreForSection({
      city,
      sectionId: parsed.data.sectionId,
      sectionTitle: parsed.data.sectionTitle,
      ask: parsed.data.ask,
      excludeBusinessIds: parsed.data.excludeBusinessIds,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ businesses, hasMore: businesses.length > 0 });
  } catch (err) {
    console.error("[recommendations/more]", err);
    return NextResponse.json(
      { error: "Could not load more options." },
      { status: 500 },
    );
  }
}
