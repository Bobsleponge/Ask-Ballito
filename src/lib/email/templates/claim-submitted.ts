import { siteConfig } from "@/config/site";

export function claimSubmittedEmail(params: {
  claimantName: string;
  businessName: string;
}) {
  const subject = `Claim submitted — ${params.businessName}`;
  const greeting = `Hi ${params.claimantName},`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 22px; margin: 0 0 12px;">Claim submitted</h1>
    <p style="color:#444; line-height:1.6;">${greeting}</p>
    <p style="color:#444; line-height:1.6;">
      We received your claim for <strong>${params.businessName}</strong>.
      Our team typically reviews claims within 1–2 business days.
    </p>
    <p style="color:#888; font-size:12px; margin-top:24px;">${siteConfig.name}</p>
  </div>`;

  const text = `${greeting}\n\nWe received your claim for ${params.businessName}. Our team typically reviews claims within 1–2 business days.\n\n— ${siteConfig.name}`;

  return { subject, html, text };
}
