/**
 * Niche service terms → broader semantic search queries when exact match fails.
 * Deterministic only — no LLM. Keep lists short; orchestrator caps queries.
 */

export interface RelatedServiceExpansion {
  /** User-facing label for the niche ask (e.g. "ombre"). */
  requestedLabel: string;
  /** Broader search queries to try (already deduped, capped). */
  queries: string[];
  /** Fixed note for prompts / grounding metadata. */
  note: string;
}

interface RelatedServiceRule {
  /** Phrases matched case-insensitively against message + draftQueries. */
  terms: string[];
  /** Canonical label used in the honesty caveat. */
  label: string;
  /** Broader retrieval queries. */
  queries: string[];
}

const RELATED_SERVICE_RULES: RelatedServiceRule[] = [
  {
    terms: ["ombre", "ombré"],
    label: "ombre",
    queries: ["hair colour salon", "hair salon", "balayage hair"],
  },
  {
    terms: ["balayage"],
    label: "balayage",
    queries: ["hair colour salon", "hair salon", "balayage hair"],
  },
  {
    terms: ["highlights", "hair highlights", "foils"],
    label: "hair highlights",
    queries: ["hair colour salon", "hair salon"],
  },
  {
    terms: ["hair colour", "hair color", "hair dye"],
    label: "hair colour",
    queries: ["hair colour salon", "hair salon"],
  },
  {
    terms: ["acrylic nails", "acrylics", "gel nails", "gel manicure"],
    label: "acrylic or gel nails",
    queries: ["nail salon", "beautician nail salon"],
  },
  {
    terms: ["manicure", "pedicure"],
    label: "manicure or pedicure",
    queries: ["nail salon", "beautician"],
  },
  {
    terms: ["keratin", "brazilian blowout", "hair treatment"],
    label: "hair treatment",
    queries: ["hair salon", "hair treatment salon"],
  },
];

const MAX_RELATED_QUERIES = 3;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function corpusContainsTerm(corpus: string, term: string): boolean {
  const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
  return re.test(corpus);
}

/**
 * If the user asked for a niche service we know how to broaden, return related
 * search queries. Otherwise null (no fallback).
 */
export function expandRelatedServiceQueries(
  message: string,
  draftQueries: string[] = [],
): RelatedServiceExpansion | null {
  const corpus = [message, ...draftQueries]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
  if (!corpus) return null;

  for (const rule of RELATED_SERVICE_RULES) {
    const matched = rule.terms.find((term) => corpusContainsTerm(corpus, term));
    if (!matched) continue;

    const queries = [...new Set(rule.queries.map((q) => q.trim()).filter(Boolean))]
      .slice(0, MAX_RELATED_QUERIES);

    if (queries.length === 0) continue;

    return {
      requestedLabel: rule.label,
      queries,
      note: `No listing confirms "${rule.label}" as a stipulated offered service; showing best related providers.`,
    };
  }

  return null;
}
