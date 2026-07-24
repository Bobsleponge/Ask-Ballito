/**
 * Wrap place names, phones, and other scannable facts in **bold** for AssistantProse.
 * Existing **segments** are left untouched (not double-wrapped).
 */

const PHONE_RE =
  /(?:\+?\d[\d\s().-]{6,}\d|\b0\d{2}[\s-]?\d{3}[\s-]?\d{4}\b)/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueSorted(
  values: Array<string | null | undefined>,
  minLen: number,
): string[] {
  return [
    ...new Set(
      values
        .filter(
          (v): v is string => typeof v === "string" && v.trim().length >= minLen,
        )
        .map((v) => v.trim()),
    ),
  ].sort((a, b) => b.length - a.length);
}

/** Apply a transform only outside existing **bold** spans. */
function mapPlainSegments(
  text: string,
  transform: (plain: string) => string,
): string {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part) =>
      /^\*\*[^*]+\*\*$/.test(part) ? part : transform(part),
    )
    .join("");
}

/**
 * Bold known place names, phone numbers, and optional ask-relevant terms.
 */
export function emphasizeKeyFacts(
  text: string,
  opts?: {
    names?: Array<string | null | undefined>;
    phones?: Array<string | null | undefined>;
    terms?: Array<string | null | undefined>;
  },
): string {
  if (!text.trim()) return text;

  const names = uniqueSorted(opts?.names ?? [], 2);
  const phones = uniqueSorted(opts?.phones ?? [], 7);
  const terms = uniqueSorted(opts?.terms ?? [], 2);

  let out = text;

  out = mapPlainSegments(out, (plain) => {
    let s = plain;
    for (const phone of phones) {
      const re = new RegExp(escapeRegExp(phone), "gi");
      s = s.replace(re, (m) => `**${m}**`);
    }
    return s;
  });

  out = mapPlainSegments(out, (plain) =>
    plain.replace(PHONE_RE, (m) => {
      const digits = m.replace(/\D/g, "");
      if (digits.length < 7) return m;
      return `**${m.trim()}**`;
    }),
  );

  out = mapPlainSegments(out, (plain) =>
    plain.replace(/\bR\s?\d[\d\s,]*(?:\.\d{2})?\b/g, (m) => `**${m}**`),
  );

  out = mapPlainSegments(out, (plain) => {
    let s = plain;
    for (const name of names) {
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi");
      s = s.replace(re, (m) => `**${m}**`);
    }
    return s;
  });

  out = mapPlainSegments(out, (plain) => {
    let s = plain;
    for (const term of terms) {
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
      s = s.replace(re, (m) => `**${m}**`);
    }
    return s;
  });

  return out;
}
