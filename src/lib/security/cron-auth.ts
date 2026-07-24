import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Constant-time compare for Bearer cron secrets. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function authorizeCronRequest(
  request: Request,
  secret: string | undefined,
): "ok" | "missing_secret" | "unauthorized" {
  if (!secret) return "missing_secret";
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!timingSafeEqualString(auth, expected)) return "unauthorized";
  return "ok";
}
