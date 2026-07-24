import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/user";
import { getCurrentProfile } from "@/lib/auth/require-admin";
import { businessMemberService } from "@/services/business-portal/business-member.service";
import { toSessionUser } from "@/lib/auth/session-user";
import type { SessionUser } from "@/components/user-menu";

export type HeaderAuth = {
  user: SessionUser | null;
  isAdmin: boolean;
  hasBusiness: boolean;
};

/**
 * Shared auth context for consumer SiteHeader (admin / business nav links).
 */
export const getHeaderAuth = cache(async (): Promise<HeaderAuth> => {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return { user: null, isAdmin: false, hasBusiness: false };
  }

  const [profile, memberships] = await Promise.all([
    getCurrentProfile(),
    businessMemberService.listActiveForUser(authUser.id),
  ]);

  return {
    user: toSessionUser(authUser),
    isAdmin: profile?.is_admin === true,
    hasBusiness: memberships.length > 0,
  };
});
