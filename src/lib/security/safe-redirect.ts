/**
 * Sanitize a post-auth redirect path so it cannot escape the site origin.
 * Only same-origin relative paths are allowed.
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/";

  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return "/";
  // Protocol-relative and scheme URLs (//evil.com, /\\evil, http:...).
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return "/";
  if (/^\/[^/]*:/i.test(trimmed)) return "/";
  if (trimmed.toLowerCase().includes("javascript:")) return "/";
  if (trimmed.includes("://")) return "/";

  return trimmed;
}
