import { z } from "zod";

export const businessMemberRoleSchema = z.enum(["owner", "manager"]);
export const businessMemberStatusSchema = z.enum(["active", "inactive"]);
export const businessClaimStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export const businessClaimantRoleSchema = z.enum([
  "owner",
  "manager",
  "marketing",
  "other",
]);

export const submitBusinessClaimSchema = z.object({
  businessId: z.string().uuid(),
  citySlug: z.string().min(1).max(64),
  claimantName: z.string().trim().min(1, "Name is required").max(120),
  claimantEmail: z.string().trim().email("Valid email is required").max(254),
  claimantPhone: z.string().trim().min(7, "Phone is required").max(40),
  claimantRole: businessClaimantRoleSchema,
  verificationMethod: z
    .enum(["self_attestation", "email_domain", "phone_otp", "document"])
    .default("self_attestation"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  confirmed: z
    .boolean()
    .refine((v) => v === true, {
      message: "You must confirm you represent this business",
    }),
});

export const searchBusinessClaimSchema = z.object({
  query: z.string().trim().min(1, "Search query is required").max(200),
  citySlug: z.string().min(1).max(64),
});

export const rejectBusinessClaimSchema = z.object({
  claimId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Rejection reason is required")
    .max(1000),
});

export const approveBusinessClaimSchema = z.object({
  claimId: z.string().uuid(),
});

export const ingestBusinessForSearchSchema = z.object({
  businessId: z.string().uuid(),
  /** Re-run even if already ingested. */
  force: z.boolean().optional(),
});

export const approveAndIngestBusinessClaimSchema = z.object({
  claimId: z.string().uuid(),
  forceIngest: z.boolean().optional(),
});

export type SubmitBusinessClaimInput = z.infer<typeof submitBusinessClaimSchema>;
export type SearchBusinessClaimInput = z.infer<typeof searchBusinessClaimSchema>;
export type RejectBusinessClaimInput = z.infer<typeof rejectBusinessClaimSchema>;
export type ApproveBusinessClaimInput = z.infer<
  typeof approveBusinessClaimSchema
>;
export type IngestBusinessForSearchInput = z.infer<
  typeof ingestBusinessForSearchSchema
>;
export type ApproveAndIngestBusinessClaimInput = z.infer<
  typeof approveAndIngestBusinessClaimSchema
>;
