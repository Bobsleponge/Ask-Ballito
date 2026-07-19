import "server-only";
import { recommendationService } from "./recommendation.service";
import { rankBusinesses } from "./ranking.engine";
import { explanationForWorkflow } from "./explanation-prompt-map";
import { sanitizeUserInput } from "@/lib/ai/safety";
import { logAiCall } from "@/lib/ai/logging";
import {
  buildConversationContext,
  plannerExtractorService,
  resolvePlannerPlan,
  type PlannerPlan,
} from "@/services/planner";
import {
  composeExperience,
  emptyComposition,
  formatCompositionPlain,
  type ExperienceComposition,
} from "@/services/composition";
import { runExecutionPlan } from "@/services/capabilities";
import { getWorkflowDefinition } from "@/services/workflows/definitions";
import type { City } from "@/config/cities";
import type { ChatMessage } from "@/lib/schemas/chat";
import type { BusinessResult } from "@/lib/schemas/business";

export interface ConversationParams {
  city: City;
  message: string;
  history?: ChatMessage[];
  userId?: string | null;
  conversationId?: string | null;
}

export interface ConversationResult {
  plan: PlannerPlan;
  workflowId: PlannerPlan["workflow"];
  businesses: BusinessResult[];
  composition: ExperienceComposition;
  llmInvoked: boolean;
  clarification: boolean;
  stream: AsyncGenerator<string, void, unknown>;
}

async function* textStream(text: string): AsyncGenerator<string, void, unknown> {
  yield text;
}

async function logOrchestration(opts: {
  userId?: string | null;
  conversationId?: string | null;
  plan: PlannerPlan;
  businesses: BusinessResult[];
  composition: ExperienceComposition;
  llmInvoked: boolean;
  latencyMs: number;
  message: string;
}) {
  await logAiCall({
    service: "ConversationOrchestrator",
    promptVersion: null,
    model: null,
    input: { message: opts.message, city: opts.plan.workflow },
    output: {
      plan: opts.plan,
      workflowId: opts.plan.workflow,
      goal: opts.plan.goal,
      clarification: opts.plan.needsClarification,
      responseMode: opts.plan.responseMode,
      compositionStrategy: opts.composition.strategy,
      compositionSections: opts.composition.sections.map((s) => ({
        id: s.id,
        title: s.title,
        count: s.businessIds.length,
      })),
      executionPlan: opts.plan.executionPlan.map((s) => ({
        id: s.id,
        capability: s.capability,
        query: s.query,
      })),
      retrievedIds: opts.businesses.map((b) => b.id),
      ranking: opts.businesses.map((b) => ({
        id: b.id,
        name: b.name,
        score: b.score ?? 0,
      })),
      llmInvoked: opts.llmInvoked,
      locationRef: opts.plan.locationRef,
      diagnostics: opts.plan.diagnostics,
    },
    latencyMs: opts.latencyMs,
    status: "success",
    userId: opts.userId,
    conversationId: opts.conversationId,
  });
}

/**
 * Planner v2 orchestrator:
 * sanitize → context → extract → resolve → capabilities → rank → compose → explain
 */
export class ConversationService {
  async handle(params: ConversationParams): Promise<ConversationResult> {
    const { city, message, history = [], userId, conversationId } = params;
    const start = Date.now();
    const clean = sanitizeUserInput(message);

    const context = buildConversationContext({ city, history });
    const draft = await plannerExtractorService.extract({
      context,
      message: clean.sanitized,
      userId,
      conversationId,
    });
    const plan = resolvePlannerPlan(draft, context);
    const def = getWorkflowDefinition(plan.workflow);
    const explain = explanationForWorkflow(plan.workflow);
    const empty = emptyComposition(plan.composition.strategy);

    if (plan.responseMode === "clarify") {
      const text =
        plan.clarificationQuestion ??
        "What are you looking for in Ballito?";
      await logOrchestration({
        userId,
        conversationId,
        plan,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        latencyMs: Date.now() - start,
        message: clean.sanitized,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: true,
        stream: textStream(text),
      };
    }

    const execution = await runExecutionPlan({
      plan,
      city,
      message: clean.sanitized,
    });

    if (
      plan.responseMode === "fast_path" ||
      (execution.fastPathText &&
        (plan.workflow === "emergency" ||
          (plan.workflow === "general" && execution.businesses.length === 0)))
    ) {
      const text =
        execution.fastPathText ??
        def.responseBehaviour.emptyResultsMessage;
      await logOrchestration({
        userId,
        conversationId,
        plan,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        latencyMs: Date.now() - start,
        message: clean.sanitized,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses: [],
        composition: empty,
        llmInvoked: false,
        clarification: false,
        stream: textStream(text),
      };
    }

    let ranked: BusinessResult[] = [];
    if (execution.businesses.length > 0) {
      ranked = rankBusinesses(execution.businesses, plan, def.rankConfig);
    }

    const composition = composeExperience(ranked, plan);
    const businesses = composition.businesses;

    if (!plan.llmRequired) {
      const text =
        businesses.length === 0
          ? def.responseBehaviour.emptyResultsMessage
          : formatCompositionPlain(composition) ||
            businesses.map((b) => b.name).join(", ");
      await logOrchestration({
        userId,
        conversationId,
        plan,
        businesses,
        composition,
        llmInvoked: false,
        latencyMs: Date.now() - start,
        message: clean.sanitized,
      });
      return {
        plan,
        workflowId: plan.workflow,
        businesses,
        composition,
        llmInvoked: false,
        clarification: false,
        stream: textStream(text),
      };
    }

    await logOrchestration({
      userId,
      conversationId,
      plan,
      businesses,
      composition,
      llmInvoked: true,
      latencyMs: Date.now() - start,
      message: clean.sanitized,
    });

    const stream = recommendationService.stream({
      system: explain.buildSystemPrompt(city.name),
      userMessage: clean.sanitized,
      promptName: explain.promptName,
      history,
      composition,
      userId,
      conversationId,
    });

    return {
      plan,
      workflowId: plan.workflow,
      businesses,
      composition,
      llmInvoked: true,
      clarification: false,
      stream,
    };
  }

  async complete(params: ConversationParams): Promise<{
    plan: PlannerPlan;
    workflowId: PlannerPlan["workflow"];
    businesses: BusinessResult[];
    composition: ExperienceComposition;
    llmInvoked: boolean;
    clarification: boolean;
    text: string;
  }> {
    const result = await this.handle(params);
    let text = "";
    for await (const delta of result.stream) {
      text += delta;
    }
    return {
      plan: result.plan,
      workflowId: result.workflowId,
      businesses: result.businesses,
      composition: result.composition,
      llmInvoked: result.llmInvoked,
      clarification: result.clarification,
      text,
    };
  }
}

export const conversationService = new ConversationService();
