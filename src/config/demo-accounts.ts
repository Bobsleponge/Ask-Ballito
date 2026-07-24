/**
 * Demo account personas for local development quick-login.
 * Emails/passwords live only in server code — never ship them to the client.
 */
export type DemoAccountRole = "admin" | "business" | "user";

export interface DemoAccountPublic {
  role: DemoAccountRole;
  label: string;
  description: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccountPublic[] = [
  {
    role: "admin",
    label: "Admin",
    description: "Website admin — review claims",
  },
  {
    role: "business",
    label: "Business",
    description: "Business owner — portal access",
  },
  {
    role: "user",
    label: "User",
    description: "Regular visitor account",
  },
] as const;

export function getDemoAccount(role: DemoAccountRole): DemoAccountPublic {
  const account = DEMO_ACCOUNTS.find((a) => a.role === role);
  if (!account) throw new Error(`Unknown demo role: ${role}`);
  return account;
}
