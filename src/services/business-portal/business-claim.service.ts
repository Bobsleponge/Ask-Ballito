import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { claimSubmittedEmail } from "@/lib/email/templates/claim-submitted";
import { claimApprovedEmail } from "@/lib/email/templates/claim-approved";
import { claimRejectedEmail } from "@/lib/email/templates/claim-rejected";
import { siteConfig } from "@/config/site";
import { businessSearchService } from "@/services/ai/business-search.service";
import { BusinessClaimRepository } from "@/services/business-portal/business-claim.repository";
import { businessMemberService } from "@/services/business-portal/business-member.service";
import type { SubmitBusinessClaimInput } from "@/lib/schemas/business-claim";
import type { BusinessResult } from "@/lib/schemas/business";
import type { BusinessClaimRow } from "@/types/database";

export class BusinessClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessClaimError";
  }
}

export type PendingClaimDetail = BusinessClaimRow & {
  businessName: string;
  businessAddress: string | null;
  searchIngestedAt: string | null;
  claimantProfileEmail: string | null;
  claimantProfileName: string | null;
};

/**
 * Claim lifecycle: search → submit → admin review → membership.
 */
export class BusinessClaimService {
  /**
   * City-aware claim search. Always pass citySlug in Phase 1.
   * Omitting citySlug is reserved for future cross-city search.
   */
  async searchForClaim(params: {
    query: string;
    citySlug?: string;
    limit?: number;
  }): Promise<BusinessResult[]> {
    return businessSearchService.search({
      query: params.query,
      citySlug: params.citySlug,
      limit: params.limit ?? 12,
    });
  }

  async submitClaim(
    userId: string,
    input: SubmitBusinessClaimInput,
  ): Promise<BusinessClaimRow> {
    const admin = createAdminClient();
    const claimRepo = new BusinessClaimRepository(admin);

    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("id, name, city_slug")
      .eq("id", input.businessId)
      .maybeSingle();

    if (businessError) {
      throw new Error(`Failed to load business: ${businessError.message}`);
    }
    if (!business) {
      throw new BusinessClaimError("Business not found");
    }
    if (business.city_slug !== input.citySlug) {
      throw new BusinessClaimError("Business is not in the selected city");
    }

    const hasOwner = await businessMemberService.hasActiveOwner(
      input.businessId,
    );
    if (hasOwner) {
      throw new BusinessClaimError(
        "This business already has an approved owner",
      );
    }

    const pending = await claimRepo.findPendingByBusiness(input.businessId);
    if (pending) {
      throw new BusinessClaimError(
        "A claim for this business is already pending review",
      );
    }

    const claim = await claimRepo.insert({
      business_id: input.businessId,
      user_id: userId,
      status: "pending",
      verification_method: input.verificationMethod ?? "self_attestation",
      claimant_name: input.claimantName,
      claimant_email: input.claimantEmail,
      claimant_phone: input.claimantPhone,
      claimant_role: input.claimantRole,
      notes: input.notes?.trim() ? input.notes.trim() : null,
    });

    const email = claimSubmittedEmail({
      claimantName: input.claimantName,
      businessName: business.name,
    });
    await sendEmail({
      to: input.claimantEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }).catch((err) => {
      console.warn("[email] claim-submitted failed:", err);
    });

    return claim;
  }

  async listPendingClaims(): Promise<PendingClaimDetail[]> {
    const admin = createAdminClient();
    const claimRepo = new BusinessClaimRepository(admin);
    const claims = await claimRepo.listByStatus("pending");
    if (claims.length === 0) return [];

    const businessIds = [...new Set(claims.map((c) => c.business_id))];
    const userIds = [...new Set(claims.map((c) => c.user_id))];

    const [{ data: businesses }, { data: profiles }] = await Promise.all([
      admin
        .from("businesses")
        .select("id, name, address, search_ingested_at")
        .in("id", businessIds),
      admin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds),
    ]);

    const businessById = new Map(
      (businesses ?? []).map((b) => [b.id, b] as const),
    );
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p] as const));

    return claims.map((claim) => {
      const business = businessById.get(claim.business_id);
      const profile = profileById.get(claim.user_id);
      return {
        ...claim,
        businessName: business?.name ?? "Unknown business",
        businessAddress: business?.address ?? null,
        searchIngestedAt: business?.search_ingested_at ?? null,
        claimantProfileEmail: profile?.email ?? null,
        claimantProfileName: profile?.full_name ?? null,
      };
    });
  }

  async getClaimDetail(claimId: string): Promise<PendingClaimDetail | null> {
    const admin = createAdminClient();
    const claimRepo = new BusinessClaimRepository(admin);
    const claim = await claimRepo.findById(claimId);
    if (!claim) return null;

    const [{ data: business }, { data: profile }] = await Promise.all([
      admin
        .from("businesses")
        .select("id, name, address, search_ingested_at")
        .eq("id", claim.business_id)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", claim.user_id)
        .maybeSingle(),
    ]);

    return {
      ...claim,
      businessName: business?.name ?? "Unknown business",
      businessAddress: business?.address ?? null,
      searchIngestedAt: business?.search_ingested_at ?? null,
      claimantProfileEmail: profile?.email ?? null,
      claimantProfileName: profile?.full_name ?? null,
    };
  }

  async approveClaim(
    claimId: string,
    adminUserId: string,
  ): Promise<BusinessClaimRow> {
    const admin = createAdminClient();
    const claimRepo = new BusinessClaimRepository(admin);
    const claim = await claimRepo.findById(claimId);

    if (!claim) throw new BusinessClaimError("Claim not found");
    if (claim.status !== "pending") {
      throw new BusinessClaimError("Only pending claims can be approved");
    }

    const hasOwner = await businessMemberService.hasActiveOwner(
      claim.business_id,
    );
    if (hasOwner) {
      throw new BusinessClaimError(
        "This business already has an active owner",
      );
    }

    await businessMemberService.createOwnerMembership(
      claim.business_id,
      claim.user_id,
    );

    const updated = await claimRepo.update(claimId, {
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      rejection_reason: null,
    });

    const { data: business } = await admin
      .from("businesses")
      .select("name")
      .eq("id", claim.business_id)
      .maybeSingle();

    const dashboardUrl = `${siteConfig.url}/business/dashboard/${claim.business_id}`;
    const email = claimApprovedEmail({
      claimantName: claim.claimant_name,
      businessName: business?.name ?? "your business",
      dashboardUrl,
    });
    await sendEmail({
      to: claim.claimant_email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }).catch((err) => {
      console.warn("[email] claim-approved failed:", err);
    });

    return updated;
  }

  async rejectClaim(
    claimId: string,
    adminUserId: string,
    reason: string,
  ): Promise<BusinessClaimRow> {
    const admin = createAdminClient();
    const claimRepo = new BusinessClaimRepository(admin);
    const claim = await claimRepo.findById(claimId);

    if (!claim) throw new BusinessClaimError("Claim not found");
    if (claim.status !== "pending") {
      throw new BusinessClaimError("Only pending claims can be rejected");
    }

    const updated = await claimRepo.update(claimId, {
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      rejection_reason: reason.trim(),
    });

    const { data: business } = await admin
      .from("businesses")
      .select("name")
      .eq("id", claim.business_id)
      .maybeSingle();

    const email = claimRejectedEmail({
      claimantName: claim.claimant_name,
      businessName: business?.name ?? "your business",
      reason: reason.trim(),
    });
    await sendEmail({
      to: claim.claimant_email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }).catch((err) => {
      console.warn("[email] claim-rejected failed:", err);
    });

    return updated;
  }

  async getOwnClaim(
    userId: string,
    claimId: string,
  ): Promise<BusinessClaimRow | null> {
    const supabase = await createClient();
    const repo = new BusinessClaimRepository(supabase);
    const claim = await repo.findById(claimId);
    if (!claim || claim.user_id !== userId) return null;
    return claim;
  }
}

export const businessClaimService = new BusinessClaimService();
