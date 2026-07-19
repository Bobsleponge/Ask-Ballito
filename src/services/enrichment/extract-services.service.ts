import "server-only";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, AI_MODEL } from "@/lib/ai/openai";
import { logAiCall } from "@/lib/ai/logging";
import { promptVersion } from "@/lib/ai/prompts";
import {
  ENRICHMENT_PROMPT,
  enrichmentExtractSchema,
  buildEnrichmentSystem,
  buildEnrichmentUserPayload,
  type EnrichmentExtract,
} from "@/lib/ai/prompts/enrichment.v1";

export interface ExtractServicesInput {
  name: string;
  category: string | null;
  types: string[];
  description: string | null;
  address: string | null;
  verticals: string[];
  reviews: string[];
}

const EMPTY: EnrichmentExtract = {
  services: [],
  keywords: [],
  attributes: {},
  summary: null,
};

function normalizeTerms(terms: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const t = raw.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t || t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * LLM extraction of services/keywords/attributes grounded in listing + reviews.
 */
export class ExtractServicesService {
  async extract(input: ExtractServicesInput): Promise<EnrichmentExtract> {
    const start = Date.now();

    try {
      const res = await openai.responses.parse({
        model: AI_MODEL,
        input: [
          { role: "system", content: buildEnrichmentSystem() },
          { role: "user", content: buildEnrichmentUserPayload(input) },
        ],
        text: { format: zodTextFormat(enrichmentExtractSchema, "enrichment") },
      });

      const parsed = res.output_parsed ?? EMPTY;
      const result: EnrichmentExtract = {
        services: normalizeTerms(parsed.services ?? [], 40),
        keywords: normalizeTerms(parsed.keywords ?? [], 60),
        attributes: parsed.attributes ?? {},
        summary: parsed.summary?.trim() || null,
      };

      await logAiCall({
        service: "ExtractServicesService",
        promptVersion: promptVersion("enrichment"),
        model: AI_MODEL,
        input: { name: input.name, reviewCount: input.reviews.length },
        output: result,
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
        latencyMs: Date.now() - start,
        status: "success",
      });

      return result;
    } catch (err) {
      await logAiCall({
        service: "ExtractServicesService",
        promptVersion: `${ENRICHMENT_PROMPT.name}@${ENRICHMENT_PROMPT.version}`,
        model: AI_MODEL,
        input: { name: input.name, reviewCount: input.reviews.length },
        latencyMs: Date.now() - start,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
      return EMPTY;
    }
  }
}

export const extractServicesService = new ExtractServicesService();
