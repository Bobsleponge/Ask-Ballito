import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessMemberRepository } from "@/services/business-portal/business-member.repository";
import type {
  BusinessMemberRole,
  BusinessMemberRow,
} from "@/types/database";

/**
 * Business membership — permanent authorization model for the Business Portal.
 *
 * Read helpers use the service-role client after the caller has already resolved
 * the authenticated user id (avoids local "JWT issued at future" clock skew).
 */
export class BusinessMemberService {
  async getActiveMembership(
    businessId: string,
    userId: string,
  ): Promise<BusinessMemberRow | null> {
    const admin = createAdminClient();
    const repo = new BusinessMemberRepository(admin);
    return repo.findActive(businessId, userId);
  }

  async listActiveForUser(userId: string): Promise<BusinessMemberRow[]> {
    const admin = createAdminClient();
    const repo = new BusinessMemberRepository(admin);
    return repo.listActiveByUser(userId);
  }

  async listMembersForBusiness(
    businessId: string,
  ): Promise<BusinessMemberRow[]> {
    // Callers must authorize via requireBusinessMember first.
    const admin = createAdminClient();
    const repo = new BusinessMemberRepository(admin);
    return repo.listByBusiness(businessId);
  }

  async hasActiveOwner(businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const repo = new BusinessMemberRepository(admin);
    const owner = await repo.findActiveOwner(businessId);
    return owner != null;
  }

  async hasActiveRole(
    businessId: string,
    userId: string,
    role: BusinessMemberRole,
  ): Promise<boolean> {
    const admin = createAdminClient();
    const repo = new BusinessMemberRepository(admin);
    return repo.hasActiveRole(businessId, userId, role);
  }

  /**
   * Create the first active owner membership for a business.
   * Used exclusively by claim approval (and future trusted flows).
   */
  async createOwnerMembership(
    businessId: string,
    userId: string,
  ): Promise<BusinessMemberRow> {
    const admin = createAdminClient();
    const repo = new BusinessMemberRepository(admin);

    const existingOwner = await repo.findActiveOwner(businessId);
    if (existingOwner) {
      throw new Error("Business already has an active owner");
    }

    return repo.insert({
      business_id: businessId,
      user_id: userId,
      role: "owner",
      status: "active",
    });
  }

  async deactivateMember(
    businessId: string,
    memberId: string,
    actorUserId: string,
  ): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessMemberRepository(admin);
    const members = await repo.listByBusiness(businessId);
    const target = members.find((m) => m.id === memberId);
    if (!target || target.business_id !== businessId) {
      throw new Error("Member not found");
    }
    if (target.user_id === actorUserId) {
      throw new Error("You cannot deactivate yourself");
    }
    if (target.role === "owner" && target.status === "active") {
      throw new Error("Cannot deactivate the owner");
    }
    await repo.update(memberId, { status: "inactive" });
  }

  async leaveBusiness(businessId: string, userId: string): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessMemberRepository(admin);
    const membership = await repo.findActive(businessId, userId);
    if (!membership) throw new Error("You are not a member of this business");
    if (membership.role === "owner") {
      throw new Error("Owners cannot leave — transfer ownership first (coming later)");
    }
    await repo.update(membership.id, { status: "inactive" });
  }
}

export const businessMemberService = new BusinessMemberService();
