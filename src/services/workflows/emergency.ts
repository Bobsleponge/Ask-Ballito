import {
  BALLITO_EMERGENCY,
  formatEmergencyContacts,
} from "@/config/local-knowledge";
import { buildEmergencySystem } from "@/lib/ai/prompts/workflows/emergency.v1";
import type { Workflow } from "./types";

export const emergencyWorkflow: Workflow = {
  id: "emergency",
  requiredFields: () => [],
  clarificationMessage: () =>
    "If this is an emergency, call 10111 or 10177 now. Tell me if you need a specific kind of help.",
  searchStrategy: () => ({ queries: [], limitPerQuery: 0 }),
  rankConfig: { limit: 0 },
  fastPath: () => formatEmergencyContacts(BALLITO_EMERGENCY),
  promptName: "emergency",
  buildSystemPrompt: buildEmergencySystem,
};
