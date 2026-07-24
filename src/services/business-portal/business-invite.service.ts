import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { BusinessInviteRepository } from "@/services/business-portal/business-invite.repository";
import { BusinessMemberRepository } from "@/services/business-portal/business-member.repository";
import type { BusinessInviteRow, BusinessMemberRow } from "@/types/database";

const INVITE_DAYS = 14;

export class BusinessInviteService {
  async list(businessId: string): Promise<BusinessInviteRow[]> {
    const admin = createAdminClient();
    return new BusinessInviteRepository(admin).listByBusiness(businessId);
  }

  async create(params: {
    businessId: string;
    email: string;
    invitedBy: string;
  }): Promise<{ invite: BusinessInviteRow; acceptPath: string }> {
    const email = params.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Enter a valid email");

    const admin = createAdminClient();
    const inviteRepo = new BusinessInviteRepository(admin);
    const memberRepo = new BusinessMemberRepository(admin);

    // Expire stale pending invites for this email
    const existing = await inviteRepo.listByBusiness(params.businessId);
    for (const inv of existing) {
      if (
        inv.status === "pending" &&
        inv.email.toLowerCase() === email &&
        new Date(inv.expires_at).getTime() < Date.now()
      ) {
        await inviteRepo.update(inv.id, { status: "expired" });
      }
    }

    const pending = existing.find(
      (i) =>
        i.status === "pending" &&
        i.email.toLowerCase() === email &&
        new Date(i.expires_at).getTime() >= Date.now(),
    );
    if (pending) {
      return {
        invite: pending,
        acceptPath: `/business/invite/${pending.token}`,
      };
    }

    const token = randomBytes(24).toString("hex");
    const expires = new Date();
    expires.setDate(expires.getDate() + INVITE_DAYS);

    const invite = await inviteRepo.insert({
      business_id: params.businessId,
      email,
      role: "manager",
      token,
      status: "pending",
      invited_by: params.invitedBy,
      expires_at: expires.toISOString(),
    });

    // Silence unused — checked for future duplicate-member warning
    void memberRepo;

    return { invite, acceptPath: `/business/invite/${token}` };
  }

  async revoke(businessId: string, inviteId: string): Promise<void> {
    const admin = createAdminClient();
    const repo = new BusinessInviteRepository(admin);
    const invites = await repo.listByBusiness(businessId);
    const invite = invites.find((i) => i.id === inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending") throw new Error("Invite is not pending");
    await repo.update(inviteId, { status: "revoked" });
  }

  async getByToken(token: string): Promise<BusinessInviteRow | null> {
    const admin = createAdminClient();
    return new BusinessInviteRepository(admin).findByToken(token);
  }

  async accept(params: {
    token: string;
    userId: string;
    userEmail: string | null | undefined;
  }): Promise<BusinessMemberRow> {
    const admin = createAdminClient();
    const inviteRepo = new BusinessInviteRepository(admin);
    const memberRepo = new BusinessMemberRepository(admin);

    const invite = await inviteRepo.findByToken(params.token);
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "pending") {
      throw new Error("This invite is no longer valid");
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await inviteRepo.update(invite.id, { status: "expired" });
      throw new Error("This invite has expired");
    }

    const userEmail = params.userEmail?.trim().toLowerCase();
    if (!userEmail || userEmail !== invite.email.toLowerCase()) {
      throw new Error(
        `Sign in with ${invite.email} to accept this invite`,
      );
    }

    const existing = await memberRepo.findAny(invite.business_id, params.userId);
    let membership: BusinessMemberRow;
    if (existing) {
      membership = await memberRepo.update(existing.id, {
        role: "manager",
        status: "active",
      });
    } else {
      membership = await memberRepo.insert({
        business_id: invite.business_id,
        user_id: params.userId,
        role: "manager",
        status: "active",
      });
    }

    await inviteRepo.update(invite.id, {
      status: "accepted",
      accepted_at: new Date().toISOString(),
    });

    return membership;
  }
}

export const businessInviteService = new BusinessInviteService();
