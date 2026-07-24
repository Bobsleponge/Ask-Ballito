import { siteConfig } from "@/config/site";

export function claimApprovedEmail(params: {
  claimantName: string;
  businessName: string;
  dashboardUrl: string;
}) {
  const subject = `Claim approved — ${params.businessName}`;
  const greeting = `Hi ${params.claimantName},`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 22px; margin: 0 0 12px;">Claim approved</h1>
    <p style="color:#444; line-height:1.6;">${greeting}</p>
    <p style="color:#444; line-height:1.6;">
      Your claim for <strong>${params.businessName}</strong> has been approved.
      You can now access the Business Portal.
    </p>
    <p style="margin: 24px 0;">
      <a href="${params.dashboardUrl}" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">
        Open dashboard
      </a>
    </p>
    <p style="color:#888; font-size:12px;">${siteConfig.name}</p>
  </div>`;

  const text = `${greeting}\n\nYour claim for ${params.businessName} has been approved. Open your dashboard: ${params.dashboardUrl}\n\n— ${siteConfig.name}`;

  return { subject, html, text };
}
