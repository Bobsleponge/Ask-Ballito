/**
 * Prompt-injection defenses and input hygiene. Applied to all user-supplied
 * content before it reaches the model.
 */

import type { ChatMessage } from "@/lib/schemas/chat";

const MAX_INPUT_LENGTH = 2000;

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts?)/i,
  /disregard\s+(the\s+)?(system|previous)\s+(prompt|instructions?)/i,
  /you\s+are\s+now\s+/i,
  /\bact\s+as\s+(an?\s+)?(unrestricted|jailbroken|dan)\b/i,
  /reveal\s+(your\s+)?(system\s+prompt|instructions|hidden)/i,
  /\bdeveloper\s+mode\b/i,
  /override\s+(your\s+)?(rules|guardrails|safety)/i,
];

export interface SanitizedInput {
  sanitized: string;
  flagged: boolean;
  reasons: string[];
}

export function sanitizeUserInput(raw: string): SanitizedInput {
  const reasons: string[] = [];

  // Strip control characters and collapse excessive whitespace.
  let text = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s{3,}/g, "  ")
    .trim();

  if (text.length > MAX_INPUT_LENGTH) {
    text = text.slice(0, MAX_INPUT_LENGTH);
    reasons.push("truncated");
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`injection_pattern:${pattern.source.slice(0, 24)}`);
    }
  }

  return {
    sanitized: text,
    flagged: reasons.some((r) => r.startsWith("injection_pattern")),
    reasons,
  };
}

/**
 * Wraps untrusted user content with explicit delimiters so the model treats it
 * as data, not instructions. Pair with a system prompt that says so.
 */
export function wrapUserContent(content: string): string {
  return `<<<USER_MESSAGE\n${content}\nUSER_MESSAGE>>>`;
}

/** Delimit prior assistant text so forged history cannot act as trusted output. */
export function wrapAssistantContent(content: string): string {
  return `<<<PRIOR_ASSISTANT\n${content}\nPRIOR_ASSISTANT>>>`;
}

/**
 * Sanitize client history for sticky/context extraction (unwrapped text).
 * Drops turns that fail injection checks.
 */
export function sanitizeHistoryForContext(
  history: ChatMessage[],
): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of history) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const clean = sanitizeUserInput(m.content);
    if (clean.flagged || !clean.sanitized) continue;
    out.push({ role: m.role, content: clean.sanitized });
  }
  return out;
}

/**
 * History ready for model APIs: sanitized, injection-flagged turns dropped,
 * user/assistant content delimited as untrusted data.
 */
export function prepareHistoryForModel(history: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of history) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const clean = sanitizeUserInput(m.content);
    if (clean.flagged || !clean.sanitized) continue;
    out.push({
      role: m.role,
      content:
        m.role === "user"
          ? wrapUserContent(clean.sanitized)
          : wrapAssistantContent(clean.sanitized),
    });
  }
  return out;
}

/**
 * Map already-sanitized context history into delimited model turns
 * (used by planner/extractor when context history is unwrapped text).
 */
export function mapHistoryToModelTurns(
  history: ChatMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of history) {
    if (m.role === "user") {
      out.push({ role: "user", content: wrapUserContent(m.content) });
    } else if (m.role === "assistant") {
      out.push({ role: "assistant", content: wrapAssistantContent(m.content) });
    }
  }
  return out;
}
