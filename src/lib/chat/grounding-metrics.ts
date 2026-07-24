import "server-only";
import { captureAbuseEvent } from "@/lib/security/abuse-events";
import { findUngroundedPhones } from "@/lib/chat/ungrounded-phones";

/**
 * Flag narration phones that are not present in retrieved business phone fields.
 * Emits grounding_violation telemetry when violations exist.
 */
export function checkNarrationGrounding(params: {
  narration: string;
  businessPhones: Array<string | null | undefined>;
  userId?: string | null;
  conversationId?: string | null;
}): { violations: string[] } {
  const violations = findUngroundedPhones(params);

  if (violations.length > 0) {
    captureAbuseEvent({
      event: "grounding_violation",
      distinctId: params.userId ?? "anonymous",
      properties: {
        count: violations.length,
        conversationId: params.conversationId ?? null,
      },
    });
  }

  return { violations };
}
