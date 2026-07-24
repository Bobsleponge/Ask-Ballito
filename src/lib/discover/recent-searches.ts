const MAX_RECENT = 8;

function storageKey(citySlug: string) {
  return `ask-ballito:recent:${citySlug}`;
}

export function loadRecentSearches(citySlug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(citySlug));
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentSearch(citySlug: string, query: string): string[] {
  if (typeof window === "undefined") return [];
  const trimmed = query.trim();
  if (!trimmed) return loadRecentSearches(citySlug);

  const prev = loadRecentSearches(citySlug).filter(
    (q) => q.toLowerCase() !== trimmed.toLowerCase(),
  );
  const next = [trimmed, ...prev].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(storageKey(citySlug), JSON.stringify(next));
  } catch {
    // quota / private mode
  }
  return next;
}
