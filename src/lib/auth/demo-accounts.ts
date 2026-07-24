import "server-only";
import { env } from "@/lib/env";
import {
  DEMO_ACCOUNTS,
  type DemoAccountRole,
  getDemoAccount,
} from "@/config/demo-accounts";
import {
  DEFAULT_DEMO_ACCOUNT_PASSWORD,
  resolveDemoLoginEnabled,
} from "@/lib/auth/demo-login-policy";

export { DEFAULT_DEMO_ACCOUNT_PASSWORD, resolveDemoLoginEnabled };

/** Server-only emails — never import this map from client components. */
const DEMO_EMAILS: Record<DemoAccountRole, string> = {
  admin: "admin@demo.askballito.local",
  business: "business@demo.askballito.local",
  user: "user@demo.askballito.local",
};

/**
 * Shared password for local demo accounts only.
 * Override via DEMO_LOGIN_PASSWORD. Production requires a non-default value.
 */
export const DEMO_ACCOUNT_PASSWORD =
  process.env.DEMO_LOGIN_PASSWORD?.trim() || DEFAULT_DEMO_ACCOUNT_PASSWORD;

export function isDemoLoginEnabled(): boolean {
  return resolveDemoLoginEnabled({
    nodeEnv: env.NODE_ENV,
    enableDemoLogin: process.env.ENABLE_DEMO_LOGIN,
    demoLoginPassword: process.env.DEMO_LOGIN_PASSWORD,
  });
}

export function getDemoAccountCredentials(role: DemoAccountRole): {
  email: string;
  password: string;
  label: string;
} {
  const account = getDemoAccount(role);
  return {
    email: DEMO_EMAILS[role],
    password: DEMO_ACCOUNT_PASSWORD,
    label: account.label,
  };
}

export function getDemoAccountEmail(role: DemoAccountRole): string {
  return DEMO_EMAILS[role];
}

export { DEMO_ACCOUNTS, DEMO_EMAILS };
export type { DemoAccountRole };
