import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import {
  checkPhotoRateLimit,
  getClientIp,
  isRateLimitConfigured,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_REDIRECT_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "places.googleapis.com",
]);

/**
 * Proxies Google Places photo media so the server API key is never exposed to
 * the browser. Expects ?name=<places photo resource name>.
 *
 * Places returns a 302 to googleusercontent — we follow that intentionally.
 */
export async function GET(request: NextRequest) {
  if (env.NODE_ENV === "production" && !isRateLimitConfigured()) {
    return NextResponse.json(
      { error: "Photos unavailable." },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const rl = await checkPhotoRateLimit(`ip:${ip}`);
  if (!rl.configured && env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Photos unavailable." },
      { status: 503 },
    );
  }
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many photo requests." },
      { status: 429 },
    );
  }

  const name = request.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "Missing photo name." }, { status: 400 });
  }
  if (!env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "Photos unavailable." }, { status: 503 });
  }

  // Basic allow-list: only proxy Google Places photo resource names.
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
    return NextResponse.json({ error: "Invalid photo name." }, { status: 400 });
  }

  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.searchParams.set("maxHeightPx", "640");
  url.searchParams.set("key", env.GOOGLE_PLACES_API_KEY);

  // Places media often 302s to lh3.googleusercontent.com — follow manually so
  // we can allow-list the final host (avoid open redirects).
  let upstream = await fetch(url, { redirect: "manual" });
  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (!location) {
      return NextResponse.json({ error: "Photo fetch failed." }, { status: 502 });
    }
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(location, url);
    } catch {
      return NextResponse.json({ error: "Photo fetch failed." }, { status: 502 });
    }
    if (!ALLOWED_REDIRECT_HOSTS.has(redirectUrl.hostname)) {
      return NextResponse.json({ error: "Photo fetch failed." }, { status: 502 });
    }
    upstream = await fetch(redirectUrl, { redirect: "error" });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Photo fetch failed." }, { status: 502 });
  }

  const contentType =
    upstream.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() ??
    "";
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Unexpected photo content type." },
      { status: 502 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control":
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  };
  const length = upstream.headers.get("Content-Length");
  if (length) headers["Content-Length"] = length;

  return new Response(upstream.body, { headers });
}
