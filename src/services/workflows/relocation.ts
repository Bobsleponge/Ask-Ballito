import { buildRelocationSystem } from "@/lib/ai/prompts/workflows/relocation.v1";
import { buildClarificationMessage, defaultSearchQueries } from "./base";
import type { Workflow } from "./types";

const RELOCATION_DEFAULT_QUERIES = [
  "estate agents",
  "schools",
  "fibre internet providers",
  "moving companies",
  "doctors and medical clinics",
  "security companies",
  "municipality and municipal services",
];

export const relocationWorkflow: Workflow = {
  id: "relocation",
  requiredFields: () => [],
  clarificationMessage: (plan) =>
    buildClarificationMessage(plan, [
      "Are you focused on housing, schools, or settling-in services first?",
    ]),
  searchStrategy: (plan) => ({
    queries: defaultSearchQueries(plan, RELOCATION_DEFAULT_QUERIES),
    limitPerQuery: 8,
  }),
  rankConfig: { limit: 10, typeBoost: 0.14 },
  promptName: "relocation",
  buildSystemPrompt: buildRelocationSystem,
};
