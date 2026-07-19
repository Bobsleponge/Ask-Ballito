import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Proxies Google Places photo media so the server API key is never exposed to
 * the browser. Expects ?name=<places photo resource name>.
 */
export async function GET(request: NextRequest) {
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

  const upstream = await fetch(url, { redirect: "follow" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Photo fetch failed." }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
