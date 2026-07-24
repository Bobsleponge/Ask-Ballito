/** Chunk size for PostgREST `.in()` filters — large UUID lists overflow URL length. */
export const SUPABASE_IN_FILTER_CHUNK = 80;

export function chunkIds<T>(ids: T[], size = SUPABASE_IN_FILTER_CHUNK): T[][] {
  if (ids.length === 0) return [];
  if (ids.length <= size) return [ids];
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}
