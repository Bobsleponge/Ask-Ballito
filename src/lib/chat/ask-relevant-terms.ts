/**
 * Ask-relevant phrases worth bolding in the reply, derived from the user question.
 */

const TERM_RULES: { re: RegExp; terms: string[] }[] = [
  {
    re: /\b(24\s*\/?\s*7|24[\s-]?h(?:r|ours?)?s?|after[\s-]?hours|urgent|call[\s-]?out|emergency)\b/i,
    terms: [
      "24-hour",
      "24 hour",
      "24hr",
      "24/7",
      "after-hours",
      "after hours",
      "emergency",
      "call-out",
      "call out",
      "callout",
    ],
  },
  {
    re: /\b(open\s*now|tonight|late\s*night)\b/i,
    terms: ["open now", "tonight", "late night"],
  },
  {
    re: /\b(kid|kids|child|family)\b/i,
    terms: ["family-friendly", "family friendly", "kids", "child-friendly"],
  },
  {
    re: /\b(sea\s*view|ocean\s*view|beachfront)\b/i,
    terms: ["sea view", "ocean view", "beachfront"],
  },
  {
    re: /\b(pet[\s-]?friendly|dog[\s-]?friendly)\b/i,
    terms: ["pet-friendly", "pet friendly", "dog-friendly"],
  },
  {
    re: /\b(budget|cheap|affordable|pricey|upmarket|fine\s*dining)\b/i,
    terms: ["budget", "affordable", "upmarket", "fine dining"],
  },
  {
    re: /\b(wheelchair|accessible)\b/i,
    terms: ["wheelchair accessible", "accessible"],
  },
];

export function askRelevantTerms(question: string | null | undefined): string[] {
  if (!question?.trim()) return [];
  const out = new Set<string>();
  for (const rule of TERM_RULES) {
    if (rule.re.test(question)) {
      for (const term of rule.terms) out.add(term);
    }
  }
  return [...out];
}
