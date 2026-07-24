/** Client-safe public URL for business-media paths (mirrors server helper). */
export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/business-media/${path}`;
}
