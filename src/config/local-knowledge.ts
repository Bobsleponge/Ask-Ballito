/**
 * Static local knowledge for fast-path answers (no LLM).
 * City-scoped; Phase 2 focuses on Ballito.
 */

export interface EmergencyContact {
  name: string;
  phone: string;
  note?: string;
}

export const BALLITO_EMERGENCY: EmergencyContact[] = [
  { name: "Emergency (police / ambulance / fire)", phone: "10111", note: "National emergency" },
  { name: "Ambulance", phone: "10177" },
  { name: "Netcare 911", phone: "082 911" },
  { name: "ER24", phone: "084 124" },
  {
    name: "Ballito Medical Centre (non-emergency enquiry)",
    phone: "032 946 8000",
    note: "Confirm hours before visiting",
  },
];

export const BALLITO_FAQ: Record<string, string> = {
  "what is ask ballito":
    "Ask Ballito is a local AI concierge for Ballito. Ask in plain language for restaurants, things to do, places to stay, and practical local help — I'll find options from our local directory and explain the best fits.",
  "how does this work":
    "Tell me what you need (dinner, coffee, beach day, moving here, etc.). I plan the request, search local businesses, rank the best matches, and explain why they fit.",
};

export function formatEmergencyContacts(contacts: EmergencyContact[]): string {
  const lines = [
    "If this is a life-threatening emergency, call 10111 or 10177 immediately.",
    "",
    "Useful contacts for Ballito / KZN:",
    ...contacts.map((c) =>
      c.note ? `• ${c.name}: ${c.phone} (${c.note})` : `• ${c.name}: ${c.phone}`,
    ),
  ];
  return lines.join("\n");
}

export function matchFaq(message: string): string | null {
  const key = message.toLowerCase().replace(/[?!.,]/g, "").trim();
  for (const [pattern, answer] of Object.entries(BALLITO_FAQ)) {
    if (key.includes(pattern) || pattern.includes(key)) return answer;
  }
  return null;
}
