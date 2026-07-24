/**
 * $0 remapping: split legacy `home-services` tags onto discrete trade verticals
 * using name/category heuristics. No Google Places or OpenAI calls.
 *
 * Usage: npx tsx --env-file=.env.local scripts/retag-home-services.ts
 */
import { createClient } from "@supabase/supabase-js";

const TRADE_RULES: { slug: string; re: RegExp }[] = [
  {
    slug: "plumbers",
    re: /\bplumbers?|plumbing|geyser|drain|pipe\b/i,
  },
  {
    slug: "electricians",
    re: /\belectricians?|electrical|electrician\b/i,
  },
  {
    slug: "locksmiths",
    re: /\blocksmiths?|lock\s*smith|keys?\b/i,
  },
  {
    slug: "hvac",
    re: /\bhvac|air[\s-]?con|air\s*conditioning|refrigerat/i,
  },
  {
    slug: "handyman",
    re: /\bhandyman|handyman|gate\s*motor|odd\s*jobs?\b/i,
  },
];

function classify(haystack: string): string[] {
  const hits = TRADE_RULES.filter((r) => r.re.test(haystack)).map((r) => r.slug);
  // If nothing matched, keep as handyman catch-all so the listing stays findable.
  return hits.length > 0 ? hits : ["handyman"];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, category, metadata")
    .eq("city_slug", "ballito");

  if (error) throw error;

  const rows = data ?? [];
  let touched = 0;
  const bySlug: Record<string, number> = {};

  for (const row of rows) {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? ({ ...(row.metadata as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : {};
    const verts = Array.isArray(meta.verticals)
      ? meta.verticals.filter((v): v is string => typeof v === "string")
      : [];

    if (!verts.includes("home-services")) continue;

    const haystack = [row.name, row.category ?? ""].join(" ");
    const trades = classify(haystack);
    const next = [
      ...new Set([...verts.filter((v) => v !== "home-services"), ...trades]),
    ];

    meta.verticals = next;

    const { error: upErr } = await supabase
      .from("businesses")
      .update({ metadata: meta })
      .eq("id", row.id);

    if (upErr) throw upErr;

    touched++;
    for (const t of trades) bySlug[t] = (bySlug[t] ?? 0) + 1;
    console.log(`  ${row.name} → ${trades.join(", ")}`);
  }

  console.log(
    JSON.stringify(
      {
        mode: "free-retag-only",
        billedApis: [],
        businessesRetagged: touched,
        bySlug,
        note: "New verticals (property, security, etc.) were not fetched — that requires Google Places + embeddings.",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
