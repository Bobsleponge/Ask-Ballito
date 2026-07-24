import "server-only";
import { redirect } from "next/navigation";
import {
  ForbiddenError,
  requireUser,
} from "@/lib/auth/require-admin";
import { businessMemberService } from "@/services/business-portal/business-member.service";
import type {
  BusinessMemberRole,
  BusinessMemberRow,
} from "@/types/database";
import type { User } from "@supabase/supabase-js";

/**
 * Verify the current user has an active membership for the business.
 * Optionally require a specific role (e.g. "owner").
 *
 * This is the permanent authorization layer for Business Portal features.
 */
export async function requireBusinessMember(
  businessId: string,
  requiredRole?: BusinessMemberRole,
): Promise<{ user: User; membership: BusinessMemberRow }> {
  const user = await requireUser();
  const membership = await businessMemberService.getActiveMembership(
    businessId,
    user.id,
  );

  if (!membership) {
    throw new ForbiddenError("Business membership required");
  }

  if (requiredRole && membership.role !== requiredRole) {
    throw new ForbiddenError(`Role '${requiredRole}' required`);
  }

  return { user, membership };
}

/**
 * Page-level membership gate. Redirects to claim flow when unauthorized.
 */
export async function requireBusinessMemberOrRedirect(
  businessId: string,
  requiredRole?: BusinessMemberRole,
): Promise<{ user: User; membership: BusinessMemberRow }> {
  try {
    return await requireBusinessMember(businessId, requiredRole);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/business/dashboard");
    }
    throw error;
  }
}
