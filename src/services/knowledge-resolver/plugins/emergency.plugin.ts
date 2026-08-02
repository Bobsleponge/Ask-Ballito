import "server-only";
import {
  formatEmergencyContacts,
} from "@/config/local-knowledge";
import {
  isTrueSafetyEmergency,
  isTradeOrAfterHoursServiceAsk,
} from "@/services/planner/emergency-guard";
import { loadEmergencyPlaces } from "@/lib/knowledge/city-knowledge";
import type {
  KnowledgeResolution,
  KnowledgeResolverInput,
  KnowledgeResolverPlugin,
} from "../types";

/** Explicit ask for emergency contact list (not trade "emergency plumber"). */
const EMERGENCY_CONTACTS_ASK =
  /\b(emergency\s+(contacts?|numbers?|phones?|services?)|what.*(call|number).*(ambulance|police|emergency)|police\s*(number|contact)|ambulance\s*(number|contact))\b/i;

function shouldResolveEmergency(input: KnowledgeResolverInput): boolean {
  const { message, classification } = input;
  if (isTradeOrAfterHoursServiceAsk(message) && !isTrueSafetyEmergency(message)) {
    return false;
  }
  if (classification.suggestedWorkflow === "emergency") return true;
  if (classification.signals.includes("true_safety_emergency")) return true;
  if (isTrueSafetyEmergency(message)) return true;
  if (EMERGENCY_CONTACTS_ASK.test(message)) return true;
  return false;
}

export const emergencyPlugin: KnowledgeResolverPlugin = {
  id: "emergency",
  async resolve(input: KnowledgeResolverInput): Promise<KnowledgeResolution | null> {
    if (!shouldResolveEmergency(input)) return null;

    const contacts = await loadEmergencyPlaces(input.city.slug);
    if (contacts.length === 0) return null;

    const text = formatEmergencyContacts(contacts);
    return {
      type: "FACT",
      answered: true,
      confidence: 0.99,
      reason: "Matched emergency / safety contact request",
      sources: ["places:emergency", "local-knowledge:emergency"],
      nextStage: "return",
      expectedCost: "none",
      expectedLatencyMs: 20,
      pluginId: "emergency",
      text,
      businesses: [],
      composition: null,
      signals: ["knowledge_resolver:emergency"],
    };
  },
};
