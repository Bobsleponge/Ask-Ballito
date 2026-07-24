import { siteConfig } from "@/config/site";

export function claimRejectedEmail(params: {
  claimantName: string;
  businessName: string;
  reason: string;
}) {
  const subject = `Claim update — ${params.businessName}`;
  const greeting = `Hi ${params.claimantName},`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 22px; margin: 0 0 12px;">Claim not approved</h1>
    <p style="color:#444; line-height:1.6;">${greeting}</p>
    <p style="color:#444; line-height:1.6;">
      Unfortunately we could not approve your claim for
      <strong>${params.businessName}</strong>.
    </p>
    <p style="color:#444; line-height:1.6;">
      <strong>Reason:</strong> ${params.reason}
    </p>
    <p style="color:#888; font-size:12px; margin-top:24px;">${siteConfig.name}</p>
  </div>`;

  const text = `${greeting}\n\nUnfortunately we could not approve your claim for ${params.businessName}.\n\nReason: ${params.reason}\n\n— ${siteConfig.name}`;

  return { subject, html, text };
}
