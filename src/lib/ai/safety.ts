/**
 * Prompt-injection defenses and input hygiene. Applied to all user-supplied
 * content before it reaches the model.
 */

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
