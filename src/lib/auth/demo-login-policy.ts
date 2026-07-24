/**
 * Pure demo-login policy (no server-only imports — safe for smoke tests).
 */

/** Hard-coded default — must never be used in production even if demo login is forced. */
export const DEFAULT_DEMO_ACCOUNT_PASSWORD = "AskBallitoDemo!2026";

/**
 * Production: ENABLE_DEMO_LOGIN=true AND a non-default DEMO_LOGIN_PASSWORD.
 * Non-production: on unless ENABLE_DEMO_LOGIN=false (local DX default-on).
 */
export function resolveDemoLoginEnabled(params: {
  nodeEnv: string;
  enableDemoLogin?: string | null;
  demoLoginPassword?: string | null;
}): boolean {
  const flag = params.enableDemoLogin?.trim();
  const password = params.demoLoginPassword?.trim() || "";

  if (params.nodeEnv === "production") {
    if (flag !== "true") return false;
    return Boolean(password && password !== DEFAULT_DEMO_ACCOUNT_PASSWORD);
  }

  if (flag === "false") return false;
  return true;
}
