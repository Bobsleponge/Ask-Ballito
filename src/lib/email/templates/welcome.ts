import { siteConfig } from "@/config/site";

export function welcomeEmail(params: { name?: string | null }) {
  const greeting = params.name ? `Hi ${params.name},` : "Hi there,";
  const subject = `Welcome to ${siteConfig.name}`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 22px; margin: 0 0 12px;">Welcome to ${siteConfig.name}</h1>
    <p style="color:#444; line-height:1.6;">${greeting}</p>
    <p style="color:#444; line-height:1.6;">
      ${siteConfig.name} is your AI concierge for discovering the best local
      businesses and things to do. Just ask, and we'll point you to the right place.
    </p>
    <p style="margin: 24px 0;">
      <a href="${siteConfig.url}" style="background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">
        Start exploring
      </a>
    </p>
    <p style="color:#888; font-size:12px;">${siteConfig.tagline}</p>
  </div>`;

  const text = `${greeting}\n\nWelcome to ${siteConfig.name} — your AI concierge for discovering great local businesses. Start exploring: ${siteConfig.url}`;

  return { subject, html, text };
}
