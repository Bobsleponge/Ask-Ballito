/**
 * Flag narration phones that are not present in retrieved business phone fields.
 * Pure heuristic — no telemetry (safe for offline evals).
 */

function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Normalize SA / intl variants so 031… and +27 31… compare equal. */
function phoneFingerprints(digits: string): string[] {
  if (digits.length < 7) return [];
  const out = new Set<string>([digits]);
  let d = digits;
  if (d.startsWith("27") && d.length >= 11) d = d.slice(2);
  if (d.startsWith("0") && d.length >= 9) d = d.slice(1);
  out.add(d);
  if (d.length >= 9) out.add(d.slice(-9));
  return [...out];
}

export function findUngroundedPhones(params: {
  narration: string;
  businessPhones: Array<string | null | undefined>;
}): string[] {
  const PHONE_RE = /(?:\+?\d[\d\s()-]{8,}\d)/g;
  const allowed = new Set<string>();
  for (const p of params.businessPhones) {
    if (!p) continue;
    for (const fp of phoneFingerprints(phoneDigits(String(p)))) {
      allowed.add(fp);
    }
  }

  const found = params.narration.match(PHONE_RE) ?? [];
  const violations: string[] = [];
  for (const raw of found) {
    const fps = phoneFingerprints(phoneDigits(raw));
    if (fps.length === 0) continue;
    const ok = fps.some((fp) => allowed.has(fp));
    if (!ok) violations.push(raw.trim());
  }
  return violations;
}
