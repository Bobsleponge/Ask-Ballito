/**
 * Strip [[biz:id]] markers that are not in the allowed candidate set.
 * When allowedIds is empty / omitted, all markers are removed.
 */
const BIZ_MARKER_RE = /\[\[biz:([^\]]+)\]\]/g;

export function scrubInvalidBizMarkers(
  text: string,
  allowedIds?: ReadonlySet<string> | readonly string[] | null,
): string {
  if (!text) return text;

  const allowed =
    allowedIds == null
      ? null
      : allowedIds instanceof Set
        ? allowedIds
        : new Set(allowedIds);

  const scrubbed = text.replace(BIZ_MARKER_RE, (_match, id: string) => {
    const trimmed = id.trim();
    if (allowed && allowed.has(trimmed)) return `[[biz:${trimmed}]]`;
    return "";
  });

  return scrubbed.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
