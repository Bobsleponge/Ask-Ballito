import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a transactional email via Resend. No-ops (returns skipped) when Resend
 * is not yet configured.
 */
export async function sendEmail(params: SendEmailParams) {
  const resend = getClient();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set; skipping send.");
    return { skipped: true as const };
  }

  const { data, error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) throw new Error(`Resend send failed: ${error.message}`);
  return { skipped: false as const, id: data?.id };
}
