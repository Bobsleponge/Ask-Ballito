import "server-only";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadGoldDataset, coreQuestions } from "@/services/eval/gold";

export type SearchQualityDashboard = {
  gold: {
    totalQuestions: number;
    coreQuestions: number;
    entityLabeled: number;
  };
  latestRun: {
    id: string;
    startedAt: string;
    finishedAt: string | null;
    questionCount: number;
    gitSha: string | null;
    summary: Record<string, unknown>;
  } | null;
  previousRun: {
    id: string;
    startedAt: string;
    summary: Record<string, unknown>;
  } | null;
  worstResults: Array<{
    questionId: string;
    query: string;
    passIntent: boolean | null;
    passTop1: boolean | null;
    passTop3: boolean | null;
    suggestions: unknown;
  }>;
  coverage: {
    businessesMissingCategory: number;
    businessesMissingDescription: number;
    knowledgeCards: number;
    listingRelations: number;
    taxonomyTerms: number;
  };
  localRunFiles: string[];
};

function asSummary(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function loadSearchQualityDashboard(): Promise<SearchQualityDashboard> {
  await requireAdmin();

  let gold = { totalQuestions: 0, coreQuestions: 0, entityLabeled: 0 };
  try {
    const dataset = loadGoldDataset();
    const core = coreQuestions(dataset);
    gold = {
      totalQuestions: dataset.questions.length,
      coreQuestions: core.length,
      entityLabeled: core.filter(
        (q) => Array.isArray(q.expectTop1Ids) && q.expectTop1Ids.length > 0,
      ).length,
    };
  } catch {
    // gold file missing in some deploy contexts
  }

  const admin = createAdminClient();

  const { data: runs } = await admin
    .from("eval_runs")
    .select(
      "id, started_at, finished_at, question_count, git_sha, summary",
    )
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(2);

  const latest = runs?.[0] ?? null;
  const previous = runs?.[1] ?? null;

  let worstResults: SearchQualityDashboard["worstResults"] = [];
  if (latest) {
    const { data: fails } = await admin
      .from("eval_results")
      .select(
        "question_id, query, pass_intent, pass_top1, pass_top3, suggestions",
      )
      .eq("run_id", latest.id)
      .or("pass_intent.eq.false,pass_top1.eq.false,pass_top3.eq.false")
      .limit(40);
    worstResults = (fails ?? []).map((r) => ({
      questionId: r.question_id,
      query: r.query,
      passIntent: r.pass_intent,
      passTop1: r.pass_top1,
      passTop3: r.pass_top3,
      suggestions: r.suggestions,
    }));
  }

  const [
    missingCategory,
    missingDescription,
    knowledgeCards,
    listingRelations,
    taxonomyTerms,
  ] = await Promise.all([
    admin
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("city_slug", "ballito")
      .or("category.is.null,category.eq."),
    admin
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("city_slug", "ballito")
      .or("description.is.null,description.eq."),
    admin
      .from("knowledge_cards")
      .select("id", { count: "exact", head: true })
      .eq("city_slug", "ballito"),
    admin
      .from("listing_relations")
      .select("id", { count: "exact", head: true })
      .eq("city_slug", "ballito"),
    admin.from("taxonomy_terms").select("id", { count: "exact", head: true }),
  ]);

  let localRunFiles: string[] = [];
  const runsDir = join(process.cwd(), "evals", "runs");
  if (existsSync(runsDir)) {
    localRunFiles = readdirSync(runsDir)
      .filter((f) => f.endsWith(".json") && !f.startsWith("compare-"))
      .sort()
      .reverse()
      .slice(0, 10);
  }

  // Prefer latest local JSON summary if DB empty
  if (!latest && localRunFiles[0]) {
    try {
      const raw = JSON.parse(
        readFileSync(join(runsDir, localRunFiles[0]!), "utf8"),
      ) as { summary?: Record<string, unknown> };
      return {
        gold,
        latestRun: {
          id: localRunFiles[0]!,
          startedAt: "",
          finishedAt: null,
          questionCount:
            typeof raw.summary?.questionCount === "number"
              ? raw.summary.questionCount
              : 0,
          gitSha: null,
          summary: raw.summary ?? {},
        },
        previousRun: null,
        worstResults: [],
        coverage: {
          businessesMissingCategory: missingCategory.count ?? 0,
          businessesMissingDescription: missingDescription.count ?? 0,
          knowledgeCards: knowledgeCards.count ?? 0,
          listingRelations: listingRelations.count ?? 0,
          taxonomyTerms: taxonomyTerms.count ?? 0,
        },
        localRunFiles,
      };
    } catch {
      // ignore
    }
  }

  return {
    gold,
    latestRun: latest
      ? {
          id: latest.id,
          startedAt: latest.started_at,
          finishedAt: latest.finished_at,
          questionCount: latest.question_count,
          gitSha: latest.git_sha,
          summary: asSummary(latest.summary),
        }
      : null,
    previousRun: previous
      ? {
          id: previous.id,
          startedAt: previous.started_at,
          summary: asSummary(previous.summary),
        }
      : null,
    worstResults,
    coverage: {
      businessesMissingCategory: missingCategory.count ?? 0,
      businessesMissingDescription: missingDescription.count ?? 0,
      knowledgeCards: knowledgeCards.count ?? 0,
      listingRelations: listingRelations.count ?? 0,
      taxonomyTerms: taxonomyTerms.count ?? 0,
    },
    localRunFiles,
  };
}
