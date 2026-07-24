import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyAccountControls } from "@/components/auth/privacy-account-controls";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          Home
        </Link>
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="text-muted-foreground">
        Last updated: 21 July 2026. Ask Ballito processes personal information
        in line with South Africa&apos;s Protection of Personal Information Act
        (POPIA). This page summarises what we collect and why.
      </p>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Account details (email, name, avatar) when you sign in</li>
          <li>Chat messages and recommendations for the concierge experience</li>
          <li>Business ownership claims and portal content you submit</li>
          <li>Technical logs (IP for rate limits, device/browser via analytics)</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">How we use it</h2>
        <p className="text-muted-foreground">
          To provide recommendations, secure the service (rate limits, abuse
          prevention), improve the product, and communicate about your account
          or claims. AI providers process prompts to generate answers.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Retention</h2>
        <p className="text-muted-foreground">
          Operational AI logs (<code className="text-xs">ai_logs</code>) are
          retained for about 90 days, then purged. Account and conversation data
          remain while your account is active.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Your rights</h2>
        <p className="text-muted-foreground">
          You may export or delete your account below when signed in. You can
          also request access or correction via the operator listed on the site.
        </p>
        <PrivacyAccountControls />
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Processors</h2>
        <p className="text-muted-foreground">
          We use Supabase (auth/database), OpenAI (models), Vercel (hosting),
          Upstash (rate limits), Resend (email), PostHog (analytics), and Sentry
          (errors). See their policies for subprocessors.
        </p>
      </section>
    </main>
  );
}
