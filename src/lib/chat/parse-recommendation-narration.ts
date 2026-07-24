/**
 * Parse structured recommendation narration into an overall intro + per-section blurbs.
 *
 * Expected LLM format:
 *   <<<INTRO>>>
 *   One short overall sentence.
 *   <<<SECTION:Kids & family>>>
 *   One or two sentences for this section.
 */

const INTRO_MARK = "<<<INTRO>>>";
const SECTION_MARK_RE = /<<<SECTION:\s*([^>]+?)>>>/gi;

export interface ParsedRecommendationNarration {
  intro: string;
  sectionBlurbs: Record<string, string>;
  /** True when markers were found (even if some sections missing). */
  structured: boolean;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanBlock(text: string): string {
  return text
    .replace(/\[\[biz:[^\]]+\]\]/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseRecommendationNarration(
  raw: string,
  sectionTitles: readonly string[] = [],
): ParsedRecommendationNarration {
  const text = raw ?? "";
  if (!text.trim()) {
    return { intro: "", sectionBlurbs: {}, structured: false };
  }

  const hasIntro = text.includes(INTRO_MARK);
  const hasSection = /<<<SECTION:/i.test(text);
  if (!hasIntro && !hasSection) {
    return {
      intro: cleanBlock(text),
      sectionBlurbs: {},
      structured: false,
    };
  }

  const titleByNorm = new Map(
    sectionTitles.map((t) => [normalizeTitle(t), t] as const),
  );

  const sectionBlurbs: Record<string, string> = {};
  const parts = text.split(SECTION_MARK_RE);
  // split with capture: [before, title1, body1, title2, body2, ...]
  let introPart = parts[0] ?? "";
  if (hasIntro) {
    const idx = introPart.indexOf(INTRO_MARK);
    introPart =
      idx >= 0 ? introPart.slice(idx + INTRO_MARK.length) : introPart;
  }
  const intro = cleanBlock(introPart);

  for (let i = 1; i < parts.length; i += 2) {
    const rawTitle = (parts[i] ?? "").trim();
    const body = cleanBlock(parts[i + 1] ?? "");
    if (!rawTitle || !body) continue;
    const canonical = titleByNorm.get(normalizeTitle(rawTitle)) ?? rawTitle;
    sectionBlurbs[canonical] = body;
    // Also index by raw title for loose matching in the UI.
    if (canonical !== rawTitle) {
      sectionBlurbs[rawTitle] = body;
    }
  }

  return { intro, sectionBlurbs, structured: true };
}

/** Resolve a section blurb with loose title matching. */
export function blurbForSection(
  blurbs: Record<string, string>,
  title: string,
): string | null {
  if (blurbs[title]) return blurbs[title]!;
  const want = normalizeTitle(title);
  for (const [key, value] of Object.entries(blurbs)) {
    if (normalizeTitle(key) === want) return value;
  }
  return null;
}
