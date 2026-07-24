import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEARCH_RESTUDY_DELAY_MS } from "@/lib/business-portal/search-ingest-constants";

/**
 * Mark an ingested business for deferred LLM offerings restudy.
 * First dirty event starts a 48h clock; later edits do not push it out.
 */
export async function scheduleSearchRestudy(businessId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("businesses")
    .select("id, search_ingested_at, search_restudy_due_at")
    .eq("id", businessId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load business: ${error.message}`);
  if (!data?.search_ingested_at) return;
  if (data.search_restudy_due_at) return;

  const due = new Date(Date.now() + SEARCH_RESTUDY_DELAY_MS).toISOString();
  const { error: updateError } = await admin
    .from("businesses")
    .update({
      search_restudy_due_at: due,
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (updateError) {
    throw new Error(`Failed to schedule restudy: ${updateError.message}`);
  }
}
