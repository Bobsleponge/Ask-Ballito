/**
 * Classify upstream AI / OpenAI failures for soft-fail UX.
 */
export function isUpstreamAiError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    status?: number;
    code?: string;
    message?: string;
    name?: string;
  };
  const status = e.status;
  if (typeof status === "number" && (status === 429 || status >= 500)) {
    return true;
  }
  const msg = `${e.code ?? ""} ${e.message ?? ""} ${e.name ?? ""}`.toLowerCase();
  return (
    msg.includes("rate_limit") ||
    msg.includes("timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("overloaded") ||
    msg.includes("service unavailable") ||
    msg.includes("internal server error")
  );
}

export function upstreamAiUserMessage(): string {
  return "The concierge is temporarily unavailable. Please try again in a moment.";
}
